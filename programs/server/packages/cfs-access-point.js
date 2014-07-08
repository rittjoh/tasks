(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var FS = Package['cfs-base-package'].FS;
var check = Package.check.check;
var Match = Package.check.Match;
var EJSON = Package.ejson.EJSON;
var HTTP = Package['http-methods'].HTTP;

/* Package-scope variables */
var baseUrl, getHeaders, httpDelHandler, httpGetHandler, httpPutInsertHandler, httpPutUpdateHandler, _existingMountPoints, mountUrls;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/cfs-access-point/access-point-common.js                                                                  //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
baseUrl = '/cfs';                                                                                                    // 1
FS.HTTP = FS.HTTP || {};                                                                                             // 2
                                                                                                                     // 3
// Note the upload URL so that client uploader packages know what it is                                              // 4
FS.HTTP.uploadUrl = baseUrl + '/files';                                                                              // 5
                                                                                                                     // 6
/**                                                                                                                  // 7
 * @method FS.HTTP.setBaseUrl                                                                                        // 8
 * @public                                                                                                           // 9
 * @param {String} newBaseUrl - Change the base URL for the HTTP GET and DELETE endpoints.                           // 10
 * @returns {undefined}                                                                                              // 11
 */                                                                                                                  // 12
FS.HTTP.setBaseUrl = function setBaseUrl(newBaseUrl) {                                                               // 13
                                                                                                                     // 14
  // Adjust the baseUrl if necessary                                                                                 // 15
  if (newBaseUrl.slice(0, 1) !== '/') {                                                                              // 16
    newBaseUrl = '/' + newBaseUrl;                                                                                   // 17
  }                                                                                                                  // 18
  if (newBaseUrl.slice(-1) === '/') {                                                                                // 19
    newBaseUrl = newBaseUrl.slice(0, -1);                                                                            // 20
  }                                                                                                                  // 21
                                                                                                                     // 22
  // Update the base URL                                                                                             // 23
  baseUrl = newBaseUrl;                                                                                              // 24
                                                                                                                     // 25
  // Change the upload URL so that client uploader packages know what it is                                          // 26
  FS.HTTP.uploadUrl = baseUrl + '/files';                                                                            // 27
                                                                                                                     // 28
  // Remount URLs with the new baseUrl, unmounting the old, on the server only.                                      // 29
  // If existingMountPoints is empty, then we haven't run the server startup                                         // 30
  // code yet, so this new URL will be used at that point for the initial mount.                                     // 31
  if (Meteor.isServer && !FS.Utility.isEmpty(_existingMountPoints)) {                                                // 32
    mountUrls();                                                                                                     // 33
  }                                                                                                                  // 34
};                                                                                                                   // 35
                                                                                                                     // 36
/*                                                                                                                   // 37
 * FS.File extensions                                                                                                // 38
 */                                                                                                                  // 39
                                                                                                                     // 40
/**                                                                                                                  // 41
 * @method FS.File.prototype.url Construct the file url                                                              // 42
 * @public                                                                                                           // 43
 * @param {object} [options]                                                                                         // 44
 * @param {string} [options.store] Name of the store to get from. If not defined,                                    // 45
 * the first store defined in `options.stores` for the collection is used.                                           // 46
 * @param {boolean} [options.auth=null] Wether or not the authenticate                                               // 47
 * @param {boolean} [options.download=false] Should headers be set to force a download                               // 48
 * @param {boolean} [options.brokenIsFine=false] Return the URL even if                                              // 49
 * we know it's currently a broken link because the file hasn't been saved in                                        // 50
 * the requested store yet.                                                                                          // 51
 *                                                                                                                   // 52
 * Return the http url for getting the file - on server set auth if wanting to                                       // 53
 * use authentication on client set auth to true or token                                                            // 54
 */                                                                                                                  // 55
FS.File.prototype.url = function(options) {                                                                          // 56
  var self = this;                                                                                                   // 57
  options = options || {};                                                                                           // 58
  options = FS.Utility.extend({                                                                                      // 59
    store: null,                                                                                                     // 60
    auth: null,                                                                                                      // 61
    download: false,                                                                                                 // 62
    metadata: false,                                                                                                 // 63
    brokenIsFine: false,                                                                                             // 64
    uploading: null, // return this URL while uploading                                                              // 65
    storing: null // return this URL while storing                                                                   // 66
  }, options.hash || options); // check for "hash" prop if called as helper                                          // 67
                                                                                                                     // 68
  // Primarily useful for displaying a temporary image while uploading an image                                      // 69
  if (options.uploading && !self.isUploaded()) {                                                                     // 70
    return options.uploading;                                                                                        // 71
  }                                                                                                                  // 72
                                                                                                                     // 73
  if (self.isMounted()) {                                                                                            // 74
    // See if we've stored in the requested store yet                                                                // 75
    var storeName = options.store || self.collection.primaryStore.name;                                              // 76
    if (!self.hasStored(storeName)) {                                                                                // 77
      if (options.storing) {                                                                                         // 78
        return options.storing;                                                                                      // 79
      } else if (!options.brokenIsFine) {                                                                            // 80
        // We want to return null if we know the URL will be a broken                                                // 81
        // link because then we can avoid rendering broken links, broken                                             // 82
        // images, etc.                                                                                              // 83
        return null;                                                                                                 // 84
      }                                                                                                              // 85
    }                                                                                                                // 86
                                                                                                                     // 87
    // Add filename to end of URL if we can determine one                                                            // 88
    var filename = self.name({store: storeName});                                                                    // 89
    if (typeof filename === "string" && filename.length) {                                                           // 90
      filename = '/' + filename;                                                                                     // 91
    } else {                                                                                                         // 92
      filename = '';                                                                                                 // 93
    }                                                                                                                // 94
                                                                                                                     // 95
    // TODO: Could we somehow figure out if the collection requires login?                                           // 96
    var authToken = '';                                                                                              // 97
    if (Meteor.isClient && typeof Accounts !== "undefined" && typeof Accounts._storedLoginToken === "function") {    // 98
      if (options.auth !== false) {                                                                                  // 99
        // Add reactive deps on the user                                                                             // 100
        Meteor.userId();                                                                                             // 101
                                                                                                                     // 102
        var authObject = {                                                                                           // 103
          authToken: Accounts._storedLoginToken() || ''                                                              // 104
        };                                                                                                           // 105
                                                                                                                     // 106
        // If it's a number, we use that as the expiration time (in seconds)                                         // 107
        if (options.auth === +options.auth) {                                                                        // 108
          authObject.expiration = FS.HTTP.now() + options.auth * 1000;                                               // 109
        }                                                                                                            // 110
                                                                                                                     // 111
        // Set the authToken                                                                                         // 112
        var authString = JSON.stringify(authObject);                                                                 // 113
        authToken = FS.Utility.btoa(authString);                                                                     // 114
      }                                                                                                              // 115
    } else if (typeof options.auth === "string") {                                                                   // 116
      // If the user supplies auth token the user will be responsible for                                            // 117
      // updating                                                                                                    // 118
      authToken = options.auth;                                                                                      // 119
    }                                                                                                                // 120
                                                                                                                     // 121
    // Construct query string                                                                                        // 122
    var params = {};                                                                                                 // 123
    if (authToken !== '') {                                                                                          // 124
      params.token = authToken;                                                                                      // 125
    }                                                                                                                // 126
    if (options.download) {                                                                                          // 127
      params.download = true;                                                                                        // 128
    }                                                                                                                // 129
    if (options.store) {                                                                                             // 130
      // We use options.store here instead of storeName because we want to omit the queryString                      // 131
      // whenever possible, allowing users to have "clean" URLs if they want. The server will                        // 132
      // assume the first store defined on the server, which means that we are assuming that                         // 133
      // the first on the client is also the first on the server. If that's not the case, the                        // 134
      // store option should be supplied.                                                                            // 135
      params.store = options.store;                                                                                  // 136
    }                                                                                                                // 137
    var queryString = FS.Utility.encodeParams(params);                                                               // 138
    if (queryString.length) {                                                                                        // 139
      queryString = '?' + queryString;                                                                               // 140
    }                                                                                                                // 141
                                                                                                                     // 142
    // Determine which URL to use                                                                                    // 143
    var area;                                                                                                        // 144
    if (options.metadata) {                                                                                          // 145
      area = '/record';                                                                                              // 146
    } else {                                                                                                         // 147
      area = '/files';                                                                                               // 148
    }                                                                                                                // 149
                                                                                                                     // 150
    // Construct and return the http method url                                                                      // 151
    return baseUrl + area + '/' + self.collection.name + '/' + self._id + filename + queryString;                    // 152
  }                                                                                                                  // 153
                                                                                                                     // 154
};                                                                                                                   // 155
                                                                                                                     // 156
                                                                                                                     // 157
                                                                                                                     // 158
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/cfs-access-point/access-point-handlers.js                                                                //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
getHeaders = [];                                                                                                     // 1
                                                                                                                     // 2
/**                                                                                                                  // 3
 * @method httpDelHandler                                                                                            // 4
 * @private                                                                                                          // 5
 * @returns {any} response                                                                                           // 6
 *                                                                                                                   // 7
 * HTTP DEL request handler                                                                                          // 8
 */                                                                                                                  // 9
httpDelHandler = function httpDelHandler(ref) {                                                                      // 10
  var self = this;                                                                                                   // 11
  var opts = FS.Utility.extend({}, self.query || {}, self.params || {});                                             // 12
                                                                                                                     // 13
  // If DELETE request, validate with 'remove' allow/deny, delete the file, and return                               // 14
  FS.Utility.validateAction(ref.collection.files._validators['remove'], ref.file, self.userId);                      // 15
                                                                                                                     // 16
  /*                                                                                                                 // 17
   * From the DELETE spec:                                                                                           // 18
   * A successful response SHOULD be 200 (OK) if the response includes an                                            // 19
   * entity describing the status, 202 (Accepted) if the action has not                                              // 20
   * yet been enacted, or 204 (No Content) if the action has been enacted                                            // 21
   * but the response does not include an entity.                                                                    // 22
   */                                                                                                                // 23
  self.setStatusCode(200);                                                                                           // 24
                                                                                                                     // 25
  return {                                                                                                           // 26
    deleted: !!ref.file.remove()                                                                                     // 27
  };                                                                                                                 // 28
};                                                                                                                   // 29
                                                                                                                     // 30
/**                                                                                                                  // 31
 * @method httpGetHandler                                                                                            // 32
 * @private                                                                                                          // 33
 * @returns {any} response                                                                                           // 34
 *                                                                                                                   // 35
 * HTTP GET request handler                                                                                          // 36
 */                                                                                                                  // 37
httpGetHandler = function httpGetHandler(ref) {                                                                      // 38
  var self = this;                                                                                                   // 39
  // Once we have the file, we can test allow/deny validators                                                        // 40
  // XXX: pass on the "share" query eg. ?share=342hkjh23ggj for shared url access?                                   // 41
  FS.Utility.validateAction(ref.collection._validators['download'], ref.file, self.userId /*, self.query.shareId*/); // 42
                                                                                                                     // 43
  var storeName = ref.storeName;                                                                                     // 44
                                                                                                                     // 45
  // If no storeName was specified, use the first defined storeName                                                  // 46
  if (typeof storeName !== "string") {                                                                               // 47
    // No store handed, we default to primary store                                                                  // 48
    storeName = ref.collection.primaryStore.name;                                                                    // 49
  }                                                                                                                  // 50
                                                                                                                     // 51
  // Get the storage reference                                                                                       // 52
  var storage = ref.collection.storesLookup[storeName];                                                              // 53
                                                                                                                     // 54
  if (!storage) {                                                                                                    // 55
    throw new Meteor.Error(404, "Not Found", 'There is no store "' + storeName + '"');                               // 56
  }                                                                                                                  // 57
                                                                                                                     // 58
  // Get the file                                                                                                    // 59
  var copyInfo = ref.file.copies[storeName];                                                                         // 60
                                                                                                                     // 61
  if (!copyInfo) {                                                                                                   // 62
    throw new Meteor.Error(404, "Not Found", 'This file was not stored in the ' + storeName + ' store');             // 63
  }                                                                                                                  // 64
                                                                                                                     // 65
  if (typeof copyInfo.type === "string") {                                                                           // 66
    self.setContentType(copyInfo.type);                                                                              // 67
  } else {                                                                                                           // 68
    self.setContentType('application/octet-stream');                                                                 // 69
  }                                                                                                                  // 70
                                                                                                                     // 71
  // Add 'Content-Disposition' header if requested a download/attachment URL                                         // 72
  var start, end;                                                                                                    // 73
  if (typeof ref.download !== "undefined") {                                                                         // 74
    self.addHeader('Content-Disposition', 'attachment; filename="' + copyInfo.name + '"');                           // 75
                                                                                                                     // 76
    // If a chunk/range was requested instead of the whole file, serve that                                          // 77
    var unit, range = self.requestHeaders.range;                                                                     // 78
    if (range) {                                                                                                     // 79
      // Parse range header                                                                                          // 80
      range = range.split('=');                                                                                      // 81
                                                                                                                     // 82
      unit = range[0];                                                                                               // 83
      if (unit !== 'bytes')                                                                                          // 84
        throw new Meteor.Error(416, "Requested Range Not Satisfiable");                                              // 85
                                                                                                                     // 86
      range = range[1];                                                                                              // 87
      // Spec allows multiple ranges, but we will serve only the first                                               // 88
      range = range.split(',')[0];                                                                                   // 89
      // Get start and end byte positions                                                                            // 90
      range = range.split('-');                                                                                      // 91
      start = range[0];                                                                                              // 92
      end = range[1] || '';                                                                                          // 93
      // Convert to numbers and adjust invalid values when possible                                                  // 94
      start = start.length ? Math.max(Number(start), 0) : 0;                                                         // 95
      end = end.length ? Math.min(Number(end), copyInfo.size - 1) : copyInfo.size - 1;                               // 96
      if (end < start)                                                                                               // 97
        throw new Meteor.Error(416, "Requested Range Not Satisfiable");                                              // 98
                                                                                                                     // 99
      self.setStatusCode(206, 'Partial Content');                                                                    // 100
      self.addHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + copyInfo.size);                           // 101
      end = end + 1; //HTTP end byte is inclusive and ours are not                                                   // 102
    } else {                                                                                                         // 103
      self.setStatusCode(200);                                                                                       // 104
    }                                                                                                                // 105
  } else {                                                                                                           // 106
    self.addHeader('Content-Disposition', 'inline');                                                                 // 107
    self.setStatusCode(200);                                                                                         // 108
  }                                                                                                                  // 109
                                                                                                                     // 110
  // Add any other custom headers                                                                                    // 111
  // TODO support customizing headers per collection                                                                 // 112
  FS.Utility.each(getHeaders, function(header) {                                                                     // 113
    self.addHeader(header[0], header[1]);                                                                            // 114
  });                                                                                                                // 115
                                                                                                                     // 116
  // Inform clients that we accept ranges for resumable chunked downloads                                            // 117
  self.addHeader('Accept-Ranges', 'bytes');                                                                          // 118
                                                                                                                     // 119
  //ref.file.createReadStream(storeName).pipe(self.createWriteStream());                                             // 120
  var readStream = storage.adapter.createReadStream(ref.file);                                                       // 121
                                                                                                                     // 122
  readStream.on('error', function(err) {                                                                             // 123
    // Send proper error message on get error                                                                        // 124
    if (err.message && err.statusCode) {                                                                             // 125
      self.Error(new Meteor.Error(err.statusCode, err.message));                                                     // 126
    } else {                                                                                                         // 127
      self.Error(new Meteor.Error(503, 'Service unavailable'));                                                      // 128
    }                                                                                                                // 129
  });                                                                                                                // 130
  readStream.pipe(self.createWriteStream());                                                                         // 131
                                                                                                                     // 132
};                                                                                                                   // 133
                                                                                                                     // 134
httpPutInsertHandler = function httpPutInsertHandler(ref) {                                                          // 135
  var self = this;                                                                                                   // 136
  var opts = FS.Utility.extend({}, self.query || {}, self.params || {});                                             // 137
                                                                                                                     // 138
  FS.debug && console.log("HTTP PUT (insert) handler");                                                              // 139
                                                                                                                     // 140
  // Create the nice FS.File                                                                                         // 141
  var fileObj = new FS.File();                                                                                       // 142
                                                                                                                     // 143
  // Set its name                                                                                                    // 144
  fileObj.name(opts.filename || null);                                                                               // 145
                                                                                                                     // 146
  // Attach the readstream as the file's data                                                                        // 147
  fileObj.attachData(self.createReadStream(), self.requestHeaders['content-type'] || 'application/octet-stream');    // 148
                                                                                                                     // 149
  // Validate with insert allow/deny                                                                                 // 150
  FS.Utility.validateAction(ref.collection.files._validators['insert'], file, self.userId);                          // 151
                                                                                                                     // 152
  // Insert file into collection, triggering readStream storage                                                      // 153
  ref.collection.insert(fileObj);                                                                                    // 154
                                                                                                                     // 155
  // Send response                                                                                                   // 156
  self.setStatusCode(200);                                                                                           // 157
                                                                                                                     // 158
  // Return the new file id                                                                                          // 159
  return {_id: fileObj._id};                                                                                         // 160
};                                                                                                                   // 161
                                                                                                                     // 162
httpPutUpdateHandler = function httpPutUpdateHandler(ref) {                                                          // 163
  var self = this;                                                                                                   // 164
  var opts = FS.Utility.extend({}, self.query || {}, self.params || {});                                             // 165
                                                                                                                     // 166
  var chunk = parseInt(opts.chunk, 10);                                                                              // 167
  if (isNaN(chunk)) chunk = 0;                                                                                       // 168
                                                                                                                     // 169
  FS.debug && console.log("HTTP PUT (update) handler received chunk: ", chunk);                                      // 170
                                                                                                                     // 171
  // Validate with insert allow/deny; also mounts and retrieves the file                                             // 172
  FS.Utility.validateAction(ref.collection.files._validators['insert'], ref.file, self.userId);                      // 173
                                                                                                                     // 174
  self.createReadStream().pipe( FS.TempStore.createWriteStream(ref.file, chunk) );                                   // 175
                                                                                                                     // 176
  // Send response                                                                                                   // 177
  self.setStatusCode(200);                                                                                           // 178
                                                                                                                     // 179
  return { _id: ref.file._id, chunk: chunk };                                                                        // 180
};                                                                                                                   // 181
                                                                                                                     // 182
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/cfs-access-point/access-point-server.js                                                                  //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
var path = Npm.require("path");                                                                                      // 1
                                                                                                                     // 2
HTTP.publishFormats({                                                                                                // 3
  fileRecordFormat: function (input) {                                                                               // 4
    // Set the method scope content type to json                                                                     // 5
    this.setContentType('application/json');                                                                         // 6
    if (FS.Utility.isArray(input)) {                                                                                 // 7
      return EJSON.stringify(FS.Utility.map(input, function (obj) {                                                  // 8
        return FS.Utility.cloneFileRecord(obj);                                                                      // 9
      }));                                                                                                           // 10
    } else {                                                                                                         // 11
      return EJSON.stringify(FS.Utility.cloneFileRecord(input));                                                     // 12
    }                                                                                                                // 13
  }                                                                                                                  // 14
});                                                                                                                  // 15
                                                                                                                     // 16
FS.HTTP.setHeadersForGet = function setHeadersForGet(headers) {                                                      // 17
  getHeaders = headers;                                                                                              // 18
};                                                                                                                   // 19
                                                                                                                     // 20
/**                                                                                                                  // 21
 * @method FS.HTTP.publish                                                                                           // 22
 * @public                                                                                                           // 23
 * @param {FS.Collection} collection                                                                                 // 24
 * @param {Function} func - Publish function that returns a cursor.                                                  // 25
 * @returns {undefined}                                                                                              // 26
 *                                                                                                                   // 27
 * Publishes all documents returned by the cursor at a GET URL                                                       // 28
 * with the format baseUrl/record/collectionName. The publish                                                        // 29
 * function `this` is similar to normal `Meteor.publish`.                                                            // 30
 */                                                                                                                  // 31
FS.HTTP.publish = function fsHttpPublish(collection, func) {                                                         // 32
  var name = baseUrl + '/record/' + collection.name;                                                                 // 33
  // Mount collection listing URL using http-publish package                                                         // 34
  HTTP.publish({                                                                                                     // 35
    name: name,                                                                                                      // 36
    defaultFormat: 'fileRecordFormat',                                                                               // 37
    collection: collection,                                                                                          // 38
    collectionGet: true,                                                                                             // 39
    collectionPost: false,                                                                                           // 40
    documentGet: true,                                                                                               // 41
    documentPut: false,                                                                                              // 42
    documentDelete: false                                                                                            // 43
  }, func);                                                                                                          // 44
                                                                                                                     // 45
  FS.debug && console.log("Registered HTTP method GET URLs:\n\n" + name + '\n' + name + '/:id\n');                   // 46
};                                                                                                                   // 47
                                                                                                                     // 48
/**                                                                                                                  // 49
 * @method FS.HTTP.unpublish                                                                                         // 50
 * @public                                                                                                           // 51
 * @param {FS.Collection} collection                                                                                 // 52
 * @returns {undefined}                                                                                              // 53
 *                                                                                                                   // 54
 * Unpublishes a restpoint created by a call to `FS.HTTP.publish`                                                    // 55
 */                                                                                                                  // 56
FS.HTTP.unpublish = function fsHttpUnpublish(collection) {                                                           // 57
  // Mount collection listing URL using http-publish package                                                         // 58
  HTTP.unpublish(baseUrl + '/record/' + collection.name);                                                            // 59
};                                                                                                                   // 60
                                                                                                                     // 61
_existingMountPoints = {};                                                                                           // 62
                                                                                                                     // 63
/**                                                                                                                  // 64
 * @method defaultSelectorFunction                                                                                   // 65
 * @private                                                                                                          // 66
 * @returns { collection, file }                                                                                     // 67
 *                                                                                                                   // 68
 * This is the default selector function                                                                             // 69
 */                                                                                                                  // 70
var defaultSelectorFunction = function() {                                                                           // 71
  var self = this;                                                                                                   // 72
  // Selector function                                                                                               // 73
  //                                                                                                                 // 74
  // This function will have to return the collection and the                                                        // 75
  // file. If file not found undefined is returned - if null is returned the                                         // 76
  // search was not possible                                                                                         // 77
  var opts = FS.Utility.extend({}, self.query || {}, self.params || {});                                             // 78
                                                                                                                     // 79
  // Get the collection name from the url                                                                            // 80
  var collectionName = opts.collectionName;                                                                          // 81
                                                                                                                     // 82
  // Get the id from the url                                                                                         // 83
  var id = opts.id;                                                                                                  // 84
                                                                                                                     // 85
  // Get the collection                                                                                              // 86
  var collection = FS._collections[collectionName];                                                                  // 87
                                                                                                                     // 88
  // Get the file if possible else return null                                                                       // 89
  var file = (id && collection)? collection.findOne({ _id: id }): null;                                              // 90
                                                                                                                     // 91
  // Return the collection and the file                                                                              // 92
  return {                                                                                                           // 93
    collection: collection,                                                                                          // 94
    file: file,                                                                                                      // 95
    storeName: opts.store,                                                                                           // 96
    download: opts.download                                                                                          // 97
  };                                                                                                                 // 98
};                                                                                                                   // 99
                                                                                                                     // 100
/*                                                                                                                   // 101
 * @method FS.HTTP.mount                                                                                             // 102
 * @public                                                                                                           // 103
 * @param {array of string} mountPoints mount points to map rest functinality on                                     // 104
 * @param {function} selector_f [selector] function returns `{ collection, file }` for mount points to work with     // 105
 *                                                                                                                   // 106
*/                                                                                                                   // 107
FS.HTTP.mount = function(mountPoints, selector_f) {                                                                  // 108
  // We take mount points as an array and we get a selector function                                                 // 109
  var selectorFunction = selector_f || defaultSelectorFunction;                                                      // 110
                                                                                                                     // 111
  var accessPoint = {                                                                                                // 112
    'stream': true,                                                                                                  // 113
    'auth': expirationAuth,                                                                                          // 114
    'post': function(data) {                                                                                         // 115
      // Use the selector for finding the collection and file reference                                              // 116
      var ref = selectorFunction.call(this);                                                                         // 117
                                                                                                                     // 118
      // We dont support post - this would be normal insert eg. of filerecord?                                       // 119
      throw new Meteor.Error(501, "Not implemented", "Post is not supported");                                       // 120
    },                                                                                                               // 121
    'put': function(data) {                                                                                          // 122
      // Use the selector for finding the collection and file reference                                              // 123
      var ref = selectorFunction.call(this);                                                                         // 124
                                                                                                                     // 125
      // Make sure we have a collection reference                                                                    // 126
      if (!ref.collection)                                                                                           // 127
        throw new Meteor.Error(404, "Not Found", "No collection found");                                             // 128
                                                                                                                     // 129
      // Make sure we have a file reference                                                                          // 130
      if (ref.file === null) {                                                                                       // 131
        // No id supplied so we will create a new FS.File instance and                                               // 132
        // insert the supplied data.                                                                                 // 133
        return httpPutInsertHandler.apply(this, [ref]);                                                              // 134
      } else {                                                                                                       // 135
        if (ref.file) {                                                                                              // 136
          return httpPutUpdateHandler.apply(this, [ref]);                                                            // 137
        } else {                                                                                                     // 138
          throw new Meteor.Error(404, "Not Found", 'No file found');                                                 // 139
        }                                                                                                            // 140
      }                                                                                                              // 141
    },                                                                                                               // 142
    'get': function(data) {                                                                                          // 143
      // Use the selector for finding the collection and file reference                                              // 144
      var ref = selectorFunction.call(this);                                                                         // 145
                                                                                                                     // 146
      // Make sure we have a collection reference                                                                    // 147
      if (!ref.collection)                                                                                           // 148
        throw new Meteor.Error(404, "Not Found", "No collection found");                                             // 149
                                                                                                                     // 150
      // Make sure we have a file reference                                                                          // 151
      if (ref.file === null) {                                                                                       // 152
        // No id supplied so we will return the published list of files ala                                          // 153
        // http.publish in json format                                                                               // 154
        return httpGetListHandler.apply(this, [ref]);                                                                // 155
      } else {                                                                                                       // 156
        if (ref.file) {                                                                                              // 157
          return httpGetHandler.apply(this, [ref]);                                                                  // 158
        } else {                                                                                                     // 159
          throw new Meteor.Error(404, "Not Found", 'No file found');                                                 // 160
        }                                                                                                            // 161
      }                                                                                                              // 162
    },                                                                                                               // 163
    'delete': function(data) {                                                                                       // 164
      // Use the selector for finding the collection and file reference                                              // 165
      var ref = selectorFunction.call(this);                                                                         // 166
                                                                                                                     // 167
      // Make sure we have a collection reference                                                                    // 168
      if (!ref.collection)                                                                                           // 169
        throw new Meteor.Error(404, "Not Found", "No collection found");                                             // 170
                                                                                                                     // 171
      // Make sure we have a file reference                                                                          // 172
      if (ref.file) {                                                                                                // 173
        return httpDelHandler.apply(this, [ref]);                                                                    // 174
      } else {                                                                                                       // 175
        throw new Meteor.Error(404, "Not Found", 'No file found');                                                   // 176
      }                                                                                                              // 177
    }                                                                                                                // 178
  };                                                                                                                 // 179
                                                                                                                     // 180
  var accessPoints = {};                                                                                             // 181
                                                                                                                     // 182
  // Add debug message                                                                                               // 183
  FS.debug && console.log('Registered HTTP method URLs:');                                                           // 184
                                                                                                                     // 185
  FS.Utility.each(mountPoints, function(mountPoint) {                                                                // 186
    // Couple mountpoint and accesspoint                                                                             // 187
    accessPoints[mountPoint] = accessPoint;                                                                          // 188
    // Remember our mountpoints                                                                                      // 189
    _existingMountPoints[mountPoint] = mountPoint;                                                                   // 190
    // Add debug message                                                                                             // 191
    FS.debug && console.log(mountPoint);                                                                             // 192
  });                                                                                                                // 193
                                                                                                                     // 194
  // XXX: HTTP:methods should unmount existing mounts in case of overwriting?                                        // 195
  HTTP.methods(accessPoints);                                                                                        // 196
                                                                                                                     // 197
};                                                                                                                   // 198
                                                                                                                     // 199
/**                                                                                                                  // 200
 * @method FS.HTTP.unmount                                                                                           // 201
 * @public                                                                                                           // 202
 * @param {string | array of string} [mountPoints] Optional, if not specified all mountpoints are unmounted          // 203
 *                                                                                                                   // 204
 */                                                                                                                  // 205
FS.HTTP.unmount = function(mountPoints) {                                                                            // 206
  // The mountPoints is optional, can be string or array if undefined then                                           // 207
  // _existingMountPoints will be used                                                                               // 208
  var unmountList;                                                                                                   // 209
  // Container for the mount points to unmount                                                                       // 210
  var unmountPoints = {};                                                                                            // 211
                                                                                                                     // 212
  if (typeof mountPoints === 'undefined') {                                                                          // 213
    // Use existing mount points - unmount all                                                                       // 214
    unmountList = _existingMountPoints;                                                                              // 215
  } else if (mountPoints === ''+mountPoints) {                                                                       // 216
    // Got a string                                                                                                  // 217
    unmountList = [mountPoints];                                                                                     // 218
  } else if (mountPoints.length) {                                                                                   // 219
    // Got an array                                                                                                  // 220
    unmountList = mountPoints;                                                                                       // 221
  }                                                                                                                  // 222
                                                                                                                     // 223
  // If we have a list to unmount                                                                                    // 224
  if (unmountList) {                                                                                                 // 225
    // Iterate over each item                                                                                        // 226
    FS.Utility.each(unmountList, function(mountPoint) {                                                              // 227
      // Check _existingMountPoints to make sure the mount point exists in our                                       // 228
      // context / was created by the FS.HTTP.mount                                                                  // 229
      if (_existingMountPoints[mountPoint]) {                                                                        // 230
        // Mark as unmount                                                                                           // 231
        unmountPoints[mountPoint] = false;                                                                           // 232
        // Release                                                                                                   // 233
        delete _existingMountPoints[mountPoint];                                                                     // 234
      }                                                                                                              // 235
    });                                                                                                              // 236
    FS.debug && console.log('FS.HTTP.unmount:');                                                                     // 237
    FS.debug && console.log(unmountPoints);                                                                          // 238
    // Complete unmount                                                                                              // 239
    HTTP.methods(unmountPoints);                                                                                     // 240
  }                                                                                                                  // 241
};                                                                                                                   // 242
                                                                                                                     // 243
// ### FS.Collection maps on HTTP pr. default on the following restpoints:                                           // 244
// *                                                                                                                 // 245
//    baseUrl + '/files/:collectionName/:id/:filename',                                                              // 246
//    baseUrl + '/files/:collectionName/:id',                                                                        // 247
//    baseUrl + '/files/:collectionName'                                                                             // 248
//                                                                                                                   // 249
// Change/ replace the existing mount point by:                                                                      // 250
// ```js                                                                                                             // 251
//   // unmount all existing                                                                                         // 252
//   FS.HTTP.unmount();                                                                                              // 253
//   // Create new mount point                                                                                       // 254
//   FS.HTTP.mount([                                                                                                 // 255
//    '/cfs/files/:collectionName/:id/:filename',                                                                    // 256
//    '/cfs/files/:collectionName/:id',                                                                              // 257
//    '/cfs/files/:collectionName'                                                                                   // 258
//  ]);                                                                                                              // 259
//  ```                                                                                                              // 260
//                                                                                                                   // 261
mountUrls = function mountUrls() {                                                                                   // 262
  // We unmount first in case we are calling this a second time                                                      // 263
  FS.HTTP.unmount();                                                                                                 // 264
                                                                                                                     // 265
  FS.HTTP.mount([                                                                                                    // 266
    baseUrl + '/files/:collectionName/:id/:filename',                                                                // 267
    baseUrl + '/files/:collectionName/:id',                                                                          // 268
    baseUrl + '/files/:collectionName'                                                                               // 269
  ]);                                                                                                                // 270
};                                                                                                                   // 271
                                                                                                                     // 272
// Returns the userId from URL token                                                                                 // 273
var expirationAuth = function expirationAuth() {                                                                     // 274
  var self = this;                                                                                                   // 275
                                                                                                                     // 276
  // Read the token from '/hello?token=base64'                                                                       // 277
  var encodedToken = self.query.token;                                                                               // 278
                                                                                                                     // 279
  FS.debug && console.log("token: "+encodedToken);                                                                   // 280
                                                                                                                     // 281
  if (!encodedToken || !Meteor.users) return false;                                                                  // 282
                                                                                                                     // 283
  // Check the userToken before adding it to the db query                                                            // 284
  // Set the this.userId                                                                                             // 285
  var tokenString = FS.Utility.atob(encodedToken);                                                                   // 286
                                                                                                                     // 287
  var tokenObject;                                                                                                   // 288
  try {                                                                                                              // 289
    tokenObject = JSON.parse(tokenString);                                                                           // 290
  } catch(err) {                                                                                                     // 291
    throw new Meteor.Error(400, 'Bad Request');                                                                      // 292
  }                                                                                                                  // 293
                                                                                                                     // 294
  // XXX: Do some check here of the object                                                                           // 295
  var userToken = tokenObject.authToken;                                                                             // 296
  if (userToken !== ''+userToken) {                                                                                  // 297
    throw new Meteor.Error(400, 'Bad Request');                                                                      // 298
  }                                                                                                                  // 299
                                                                                                                     // 300
  // If we have an expiration token we should check that it's still valid                                            // 301
  if (tokenObject.expiration != null) {                                                                              // 302
    // check if its too old                                                                                          // 303
    var now = Date.now();                                                                                            // 304
    if (tokenObject.expiration < now) {                                                                              // 305
      FS.debug && console.log('Expired token: ' + tokenObject.expiration + ' is less than ' + now);                  // 306
      throw new Meteor.Error(500, 'Expired token');                                                                  // 307
    }                                                                                                                // 308
  }                                                                                                                  // 309
                                                                                                                     // 310
  // We are not on a secure line - so we have to look up the user...                                                 // 311
  var user = Meteor.users.findOne({                                                                                  // 312
    $or: [                                                                                                           // 313
      {'services.resume.loginTokens.hashedToken': Accounts._hashLoginToken(userToken)},                              // 314
      {'services.resume.loginTokens.token': userToken}                                                               // 315
    ]                                                                                                                // 316
  });                                                                                                                // 317
                                                                                                                     // 318
  // Set the userId in the scope                                                                                     // 319
  return user && user._id;                                                                                           // 320
};                                                                                                                   // 321
                                                                                                                     // 322
HTTP.methods(                                                                                                        // 323
  {'/cfs/servertime': {                                                                                              // 324
    get: function(data) {                                                                                            // 325
      return Date.now().toString();                                                                                  // 326
    }                                                                                                                // 327
  }                                                                                                                  // 328
});                                                                                                                  // 329
                                                                                                                     // 330
// Unify client / server api                                                                                         // 331
FS.HTTP.now = function() {                                                                                           // 332
  return Date.now();                                                                                                 // 333
};                                                                                                                   // 334
                                                                                                                     // 335
// Start up the basic mount points                                                                                   // 336
Meteor.startup(function () {                                                                                         // 337
  mountUrls();                                                                                                       // 338
});                                                                                                                  // 339
                                                                                                                     // 340
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['cfs-access-point'] = {};

})();

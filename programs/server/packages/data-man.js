(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var EJSON = Package.ejson.EJSON;

/* Package-scope variables */
var DataMan;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/data-man/server/data-man-api.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var fs = Npm.require("fs");                                                                                            // 1
var Readable = Npm.require('stream').Readable;                                                                         // 2
                                                                                                                       // 3
/**                                                                                                                    // 4
 * @method DataMan                                                                                                     // 5
 * @public                                                                                                             // 6
 * @constructor                                                                                                        // 7
 * @param {Buffer|ArrayBuffer|Uint8Array|String} data The data that you want to manipulate.                            // 8
 * @param {String} [type] The data content (MIME) type, if known. Required if the first argument is a Buffer, ArrayBuffer, Uint8Array, or URL
 * @param {Object} [options] Currently used only to pass options for the GET request when `data` is a URL.             // 10
 */                                                                                                                    // 11
DataMan = function DataMan(data, type, options) {                                                                      // 12
  var self = this;                                                                                                     // 13
                                                                                                                       // 14
  if (!data) {                                                                                                         // 15
    throw new Error("DataMan constructor requires a data argument");                                                   // 16
  }                                                                                                                    // 17
                                                                                                                       // 18
  // The end result of all this is that we will have this.source set to a correct                                      // 19
  // data type handler. We are simply detecting what the data arg is.                                                  // 20
  //                                                                                                                   // 21
  // Unless we already have in-memory data, we don't load anything into memory                                         // 22
  // and instead rely on obtaining a read stream when the time comes.                                                  // 23
  if (typeof Buffer !== "undefined" && data instanceof Buffer) {                                                       // 24
    if (!type) {                                                                                                       // 25
      throw new Error("DataMan constructor requires a type argument when passed a Buffer");                            // 26
    }                                                                                                                  // 27
    self.source = new DataMan.Buffer(data, type);                                                                      // 28
  } else if (typeof ArrayBuffer !== "undefined" && data instanceof ArrayBuffer) {                                      // 29
    if (typeof Buffer === "undefined") {                                                                               // 30
      throw new Error("Buffer support required to handle an ArrayBuffer");                                             // 31
    }                                                                                                                  // 32
    if (!type) {                                                                                                       // 33
      throw new Error("DataMan constructor requires a type argument when passed an ArrayBuffer");                      // 34
    }                                                                                                                  // 35
    var buffer = new Buffer(new Uint8Array(data));                                                                     // 36
    self.source = new DataMan.Buffer(buffer, type);                                                                    // 37
  } else if (EJSON.isBinary(data)) {                                                                                   // 38
    if (typeof Buffer === "undefined") {                                                                               // 39
      throw new Error("Buffer support required to handle an ArrayBuffer");                                             // 40
    }                                                                                                                  // 41
    if (!type) {                                                                                                       // 42
      throw new Error("DataMan constructor requires a type argument when passed a Uint8Array");                        // 43
    }                                                                                                                  // 44
    var buffer = new Buffer(data);                                                                                     // 45
    self.source = new DataMan.Buffer(buffer, type);                                                                    // 46
  } else if (typeof Readable !== "undefined" && data instanceof Readable) {                                            // 47
    if (!type) {                                                                                                       // 48
      throw new Error("DataMan constructor requires a type argument when passed a stream.Readable");                   // 49
    }                                                                                                                  // 50
    self.source = new DataMan.ReadStream(data, type);                                                                  // 51
  } else if (typeof data === "string") {                                                                               // 52
    if (data.slice(0, 5) === "data:") {                                                                                // 53
      self.source = new DataMan.DataURI(data);                                                                         // 54
    } else if (data.slice(0, 5) === "http:" || data.slice(0, 6) === "https:") {                                        // 55
      if (!type) {                                                                                                     // 56
        throw new Error("DataMan constructor requires a type argument when passed a URL");                             // 57
      }                                                                                                                // 58
      self.source = new DataMan.URL(data, type, options);                                                              // 59
    } else {                                                                                                           // 60
      // assume it's a filepath                                                                                        // 61
      self.source = new DataMan.FilePath(data, type);                                                                  // 62
    }                                                                                                                  // 63
  } else {                                                                                                             // 64
    throw new Error("DataMan constructor received data that it doesn't support");                                      // 65
  }                                                                                                                    // 66
};                                                                                                                     // 67
                                                                                                                       // 68
/**                                                                                                                    // 69
 * @method DataMan.prototype.getBuffer                                                                                 // 70
 * @public                                                                                                             // 71
 * @param {function} [callback] callback(err, buffer)                                                                  // 72
 * @returns {Buffer|undefined}                                                                                         // 73
 *                                                                                                                     // 74
 * Returns a Buffer representing this data, or passes the Buffer to a callback.                                        // 75
 */                                                                                                                    // 76
DataMan.prototype.getBuffer = function dataManGetBuffer(callback) {                                                    // 77
  var self = this;                                                                                                     // 78
  return callback ? self.source.getBuffer(callback) : Meteor._wrapAsync(bind(self.source.getBuffer, self.source))();   // 79
};                                                                                                                     // 80
                                                                                                                       // 81
function _saveToFile(readStream, filePath, callback) {                                                                 // 82
  var writeStream = fs.createWriteStream(filePath);                                                                    // 83
  writeStream.on('close', Meteor.bindEnvironment(function () {                                                         // 84
    callback();                                                                                                        // 85
  }, function (error) { callback(error); }));                                                                          // 86
  writeStream.on('error', Meteor.bindEnvironment(function (error) {                                                    // 87
    callback(error);                                                                                                   // 88
  }, function (error) { callback(error); }));                                                                          // 89
  readStream.pipe(writeStream);                                                                                        // 90
}                                                                                                                      // 91
                                                                                                                       // 92
/**                                                                                                                    // 93
 * @method DataMan.prototype.saveToFile                                                                                // 94
 * @public                                                                                                             // 95
 * @param {String} filePath                                                                                            // 96
 * @param {Function} callback                                                                                          // 97
 * @returns {undefined}                                                                                                // 98
 *                                                                                                                     // 99
 * Saves this data to a filepath on the local filesystem.                                                              // 100
 */                                                                                                                    // 101
DataMan.prototype.saveToFile = function dataManSaveToFile(filePath, callback) {                                        // 102
  var readStream = this.createReadStream();                                                                            // 103
  return callback ? _saveToFile(readStream, filePath, callback) : Meteor._wrapAsync(_saveToFile)(readStream, filePath);
};                                                                                                                     // 105
                                                                                                                       // 106
/**                                                                                                                    // 107
 * @method DataMan.prototype.getDataUri                                                                                // 108
 * @public                                                                                                             // 109
 * @param {function} [callback] callback(err, dataUri)                                                                 // 110
 *                                                                                                                     // 111
 * If no callback, returns the data URI.                                                                               // 112
 */                                                                                                                    // 113
DataMan.prototype.getDataUri = function dataManGetDataUri(callback) {                                                  // 114
  var self = this;                                                                                                     // 115
  return callback ? self.source.getDataUri(callback) : Meteor._wrapAsync(bind(self.source.getDataUri, self.source))(); // 116
};                                                                                                                     // 117
                                                                                                                       // 118
/**                                                                                                                    // 119
 * @method DataMan.prototype.createReadStream                                                                          // 120
 * @public                                                                                                             // 121
 *                                                                                                                     // 122
 * Returns a read stream for the data.                                                                                 // 123
 */                                                                                                                    // 124
DataMan.prototype.createReadStream = function dataManCreateReadStream() {                                              // 125
  return this.source.createReadStream();                                                                               // 126
};                                                                                                                     // 127
                                                                                                                       // 128
/**                                                                                                                    // 129
 * @method DataMan.prototype.size                                                                                      // 130
 * @public                                                                                                             // 131
 * @param {function} [callback] callback(err, size)                                                                    // 132
 *                                                                                                                     // 133
 * If no callback, returns the size in bytes of the data.                                                              // 134
 */                                                                                                                    // 135
DataMan.prototype.size = function dataManSize(callback) {                                                              // 136
  var self = this;                                                                                                     // 137
  return callback ? self.source.size(callback) : Meteor._wrapAsync(bind(self.source.size, self.source))();             // 138
};                                                                                                                     // 139
                                                                                                                       // 140
/**                                                                                                                    // 141
 * @method DataMan.prototype.type                                                                                      // 142
 * @public                                                                                                             // 143
 *                                                                                                                     // 144
 * Returns the type of the data.                                                                                       // 145
 */                                                                                                                    // 146
DataMan.prototype.type = function dataManType() {                                                                      // 147
  return this.source.type();                                                                                           // 148
};                                                                                                                     // 149
                                                                                                                       // 150
/*                                                                                                                     // 151
 * "bind" shim; from underscorejs, but we avoid a dependency                                                           // 152
 */                                                                                                                    // 153
var slice = Array.prototype.slice;                                                                                     // 154
var nativeBind = Function.prototype.bind;                                                                              // 155
var ctor = function(){};                                                                                               // 156
function isFunction(obj) {                                                                                             // 157
  return Object.prototype.toString.call(obj) == '[object Function]';                                                   // 158
}                                                                                                                      // 159
function bind(func, context) {                                                                                         // 160
  var args, bound;                                                                                                     // 161
  if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));                 // 162
  if (!isFunction(func)) throw new TypeError;                                                                          // 163
  args = slice.call(arguments, 2);                                                                                     // 164
  return bound = function() {                                                                                          // 165
    if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));                      // 166
    ctor.prototype = func.prototype;                                                                                   // 167
    var self = new ctor;                                                                                               // 168
    ctor.prototype = null;                                                                                             // 169
    var result = func.apply(self, args.concat(slice.call(arguments)));                                                 // 170
    if (Object(result) === result) return result;                                                                      // 171
    return self;                                                                                                       // 172
  };                                                                                                                   // 173
}                                                                                                                      // 174
                                                                                                                       // 175
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/data-man/server/data-man-buffer.js                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var bufferStreamReader = Npm.require('buffer-stream-reader');                                                          // 1
                                                                                                                       // 2
/**                                                                                                                    // 3
 * @method DataMan.Buffer                                                                                              // 4
 * @public                                                                                                             // 5
 * @constructor                                                                                                        // 6
 * @param {Buffer} buffer                                                                                              // 7
 * @param {String} type The data content (MIME) type.                                                                  // 8
 */                                                                                                                    // 9
DataMan.Buffer = function DataManBuffer(buffer, type) {                                                                // 10
  var self = this;                                                                                                     // 11
  self.buffer = buffer;                                                                                                // 12
  self._type = type;                                                                                                   // 13
};                                                                                                                     // 14
                                                                                                                       // 15
/**                                                                                                                    // 16
 * @method DataMan.Buffer.prototype.getBuffer                                                                          // 17
 * @private                                                                                                            // 18
 * @param {function} callback callback(err, buffer)                                                                    // 19
 * @returns {Buffer|undefined}                                                                                         // 20
 *                                                                                                                     // 21
 * Passes a Buffer representing the data to a callback.                                                                // 22
 */                                                                                                                    // 23
DataMan.Buffer.prototype.getBuffer = function dataManBufferGetBuffer(callback) {                                       // 24
  callback(null, this.buffer);                                                                                         // 25
};                                                                                                                     // 26
                                                                                                                       // 27
/**                                                                                                                    // 28
 * @method DataMan.Buffer.prototype.getDataUri                                                                         // 29
 * @private                                                                                                            // 30
 * @param {function} callback callback(err, dataUri)                                                                   // 31
 *                                                                                                                     // 32
 * Passes a data URI representing the data in the buffer to a callback.                                                // 33
 */                                                                                                                    // 34
DataMan.Buffer.prototype.getDataUri = function dataManBufferGetDataUri(callback) {                                     // 35
  var self = this;                                                                                                     // 36
  if (!self._type) {                                                                                                   // 37
    callback(new Error("DataMan.getDataUri couldn't get a contentType"));                                              // 38
  } else {                                                                                                             // 39
    var dataUri = "data:" + self._type + ";base64," + self.buffer.toString("base64");                                  // 40
    callback(null, dataUri);                                                                                           // 41
  }                                                                                                                    // 42
};                                                                                                                     // 43
                                                                                                                       // 44
/**                                                                                                                    // 45
 * @method DataMan.Buffer.prototype.createReadStream                                                                   // 46
 * @private                                                                                                            // 47
 *                                                                                                                     // 48
 * Returns a read stream for the data.                                                                                 // 49
 */                                                                                                                    // 50
DataMan.Buffer.prototype.createReadStream = function dataManBufferCreateReadStream() {                                 // 51
  return new bufferStreamReader(this.buffer);                                                                          // 52
};                                                                                                                     // 53
                                                                                                                       // 54
/**                                                                                                                    // 55
 * @method DataMan.Buffer.prototype.size                                                                               // 56
 * @param {function} callback callback(err, size)                                                                      // 57
 * @private                                                                                                            // 58
 *                                                                                                                     // 59
 * Passes the size in bytes of the data in the buffer to a callback.                                                   // 60
 */                                                                                                                    // 61
DataMan.Buffer.prototype.size = function dataManBufferSize(callback) {                                                 // 62
  var self = this;                                                                                                     // 63
                                                                                                                       // 64
  if (typeof self._size === "number") {                                                                                // 65
    callback(null, self._size);                                                                                        // 66
    return;                                                                                                            // 67
  }                                                                                                                    // 68
                                                                                                                       // 69
  self._size = self.buffer.length;                                                                                     // 70
  callback(null, self._size);                                                                                          // 71
};                                                                                                                     // 72
                                                                                                                       // 73
/**                                                                                                                    // 74
 * @method DataMan.Buffer.prototype.type                                                                               // 75
 * @private                                                                                                            // 76
 *                                                                                                                     // 77
 * Returns the type of the data.                                                                                       // 78
 */                                                                                                                    // 79
DataMan.Buffer.prototype.type = function dataManBufferType() {                                                         // 80
  return this._type;                                                                                                   // 81
};                                                                                                                     // 82
                                                                                                                       // 83
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/data-man/server/data-man-datauri.js                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**                                                                                                                    // 1
 * @method DataMan.DataURI                                                                                             // 2
 * @public                                                                                                             // 3
 * @constructor                                                                                                        // 4
 * @param {String} dataUri                                                                                             // 5
 */                                                                                                                    // 6
DataMan.DataURI = function DataManDataURI(dataUri) {                                                                   // 7
  var self = this;                                                                                                     // 8
  var pieces = dataUri.match(/^data:(.*);base64,(.*)$/);                                                               // 9
  var buffer = new Buffer(pieces[2], 'base64');                                                                        // 10
  return new DataMan.Buffer(buffer, pieces[1]);                                                                        // 11
};                                                                                                                     // 12
                                                                                                                       // 13
DataMan.DataURI.prototype = DataMan.Buffer.prototype;                                                                  // 14
                                                                                                                       // 15
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/data-man/server/data-man-filepath.js                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var mime = Npm.require('mime');                                                                                        // 1
var fs = Npm.require("fs");                                                                                            // 2
                                                                                                                       // 3
/**                                                                                                                    // 4
 * @method DataMan.FilePath                                                                                            // 5
 * @public                                                                                                             // 6
 * @constructor                                                                                                        // 7
 * @param {String} filepath                                                                                            // 8
 * @param {String} [type] The data content (MIME) type. Will lookup from file if not passed.                           // 9
 */                                                                                                                    // 10
DataMan.FilePath = function DataManFilePath(filepath, type) {                                                          // 11
  var self = this;                                                                                                     // 12
  self.filepath = filepath;                                                                                            // 13
  self._type = type || mime.lookup(filepath);                                                                          // 14
};                                                                                                                     // 15
                                                                                                                       // 16
/**                                                                                                                    // 17
 * @method DataMan.FilePath.prototype.getBuffer                                                                        // 18
 * @private                                                                                                            // 19
 * @param {function} callback callback(err, buffer)                                                                    // 20
 * @returns {Buffer|undefined}                                                                                         // 21
 *                                                                                                                     // 22
 * Passes a Buffer representing the data to a callback.                                                                // 23
 */                                                                                                                    // 24
DataMan.FilePath.prototype.getBuffer = function dataManFilePathGetBuffer(callback) {                                   // 25
  var self = this;                                                                                                     // 26
                                                                                                                       // 27
  // Call node readFile                                                                                                // 28
  fs.readFile(self.filepath, Meteor.bindEnvironment(function(err, buffer) {                                            // 29
    callback(err, buffer);                                                                                             // 30
  }, function(err) {                                                                                                   // 31
    callback(err);                                                                                                     // 32
  }));                                                                                                                 // 33
};                                                                                                                     // 34
                                                                                                                       // 35
/**                                                                                                                    // 36
 * @method DataMan.FilePath.prototype.getDataUri                                                                       // 37
 * @private                                                                                                            // 38
 * @param {function} callback callback(err, dataUri)                                                                   // 39
 *                                                                                                                     // 40
 * Passes a data URI representing the data to a callback.                                                              // 41
 */                                                                                                                    // 42
DataMan.FilePath.prototype.getDataUri = function dataManFilePathGetDataUri(callback) {                                 // 43
  var self = this;                                                                                                     // 44
                                                                                                                       // 45
  self.getBuffer(function (error, buffer) {                                                                            // 46
    if (error) {                                                                                                       // 47
      callback(error);                                                                                                 // 48
    } else {                                                                                                           // 49
      if (!self._type) {                                                                                               // 50
        callback(new Error("DataMan.getDataUri couldn't get a contentType"));                                          // 51
      } else {                                                                                                         // 52
        var dataUri = "data:" + self._type + ";base64," + buffer.toString("base64");                                   // 53
        buffer = null;                                                                                                 // 54
        callback(null, dataUri);                                                                                       // 55
      }                                                                                                                // 56
    }                                                                                                                  // 57
  });                                                                                                                  // 58
};                                                                                                                     // 59
                                                                                                                       // 60
/**                                                                                                                    // 61
 * @method DataMan.FilePath.prototype.createReadStream                                                                 // 62
 * @private                                                                                                            // 63
 *                                                                                                                     // 64
 * Returns a read stream for the data.                                                                                 // 65
 */                                                                                                                    // 66
DataMan.FilePath.prototype.createReadStream = function dataManFilePathCreateReadStream() {                             // 67
  // Stream from filesystem                                                                                            // 68
  return fs.createReadStream(this.filepath);                                                                           // 69
};                                                                                                                     // 70
                                                                                                                       // 71
/**                                                                                                                    // 72
 * @method DataMan.FilePath.prototype.size                                                                             // 73
 * @param {function} callback callback(err, size)                                                                      // 74
 * @private                                                                                                            // 75
 *                                                                                                                     // 76
 * Passes the size in bytes of the data to a callback.                                                                 // 77
 */                                                                                                                    // 78
DataMan.FilePath.prototype.size = function dataManFilePathSize(callback) {                                             // 79
  var self = this;                                                                                                     // 80
                                                                                                                       // 81
  if (typeof self._size === "number") {                                                                                // 82
    callback(null, self._size);                                                                                        // 83
    return;                                                                                                            // 84
  }                                                                                                                    // 85
                                                                                                                       // 86
  // We can get the size without buffering                                                                             // 87
  fs.stat(self.filepath, Meteor.bindEnvironment(function (error, stats) {                                              // 88
    if (stats && typeof stats.size === "number") {                                                                     // 89
      self._size = stats.size;                                                                                         // 90
      callback(null, self._size);                                                                                      // 91
    } else {                                                                                                           // 92
      callback(error);                                                                                                 // 93
    }                                                                                                                  // 94
  }, function (error) {                                                                                                // 95
    callback(error);                                                                                                   // 96
  }));                                                                                                                 // 97
};                                                                                                                     // 98
                                                                                                                       // 99
/**                                                                                                                    // 100
 * @method DataMan.FilePath.prototype.type                                                                             // 101
 * @private                                                                                                            // 102
 *                                                                                                                     // 103
 * Returns the type of the data.                                                                                       // 104
 */                                                                                                                    // 105
DataMan.FilePath.prototype.type = function dataManFilePathType() {                                                     // 106
  return this._type;                                                                                                   // 107
};                                                                                                                     // 108
                                                                                                                       // 109
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/data-man/server/data-man-url.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var request = Npm.require("request");                                                                                  // 1
                                                                                                                       // 2
/**                                                                                                                    // 3
 * @method DataMan.URL                                                                                                 // 4
 * @public                                                                                                             // 5
 * @constructor                                                                                                        // 6
 * @param {String} url                                                                                                 // 7
 * @param {String} type The data content (MIME) type.                                                                  // 8
 */                                                                                                                    // 9
DataMan.URL = function DataManURL(url, type, options) {                                                                // 10
  var self = this;                                                                                                     // 11
  options = options || {};                                                                                             // 12
                                                                                                                       // 13
  self.url = url;                                                                                                      // 14
  self._type = type;                                                                                                   // 15
                                                                                                                       // 16
  // This is some code borrowed from the http package. Hopefully                                                       // 17
  // we can eventually use HTTP pkg directly instead of 'request'                                                      // 18
  // once it supports streams and buffers and such. (`request` takes                                                   // 19
  // and `auth` option, too, but not of the same form as `HTTP`.)                                                      // 20
  if (options.auth) {                                                                                                  // 21
    if (options.auth.indexOf(':') < 0)                                                                                 // 22
      throw new Error('auth option should be of the form "username:password"');                                        // 23
    options.headers = options.headers || {};                                                                           // 24
    options.headers['Authorization'] = "Basic "+                                                                       // 25
      (new Buffer(options.auth, "ascii")).toString("base64");                                                          // 26
    delete options.auth;                                                                                               // 27
  }                                                                                                                    // 28
                                                                                                                       // 29
  self.urlOpts = options;                                                                                              // 30
};                                                                                                                     // 31
                                                                                                                       // 32
/**                                                                                                                    // 33
 * @method DataMan.URL.prototype.getBuffer                                                                             // 34
 * @private                                                                                                            // 35
 * @param {function} callback callback(err, buffer)                                                                    // 36
 * @returns {Buffer|undefined}                                                                                         // 37
 *                                                                                                                     // 38
 * Passes a Buffer representing the data at the URL to a callback.                                                     // 39
 */                                                                                                                    // 40
DataMan.URL.prototype.getBuffer = function dataManUrlGetBuffer(callback) {                                             // 41
  var self = this;                                                                                                     // 42
                                                                                                                       // 43
  request(_.extend({                                                                                                   // 44
    url: self.url,                                                                                                     // 45
    method: "GET",                                                                                                     // 46
    encoding: null,                                                                                                    // 47
    jar: false                                                                                                         // 48
  }, self.urlOpts), Meteor.bindEnvironment(function(err, res, body) {                                                  // 49
    if (err) {                                                                                                         // 50
      callback(err);                                                                                                   // 51
    } else {                                                                                                           // 52
      self._type = res.headers['content-type'];                                                                        // 53
      callback(null, body);                                                                                            // 54
    }                                                                                                                  // 55
  }, function(err) {                                                                                                   // 56
    callback(err);                                                                                                     // 57
  }));                                                                                                                 // 58
};                                                                                                                     // 59
                                                                                                                       // 60
/**                                                                                                                    // 61
 * @method DataMan.URL.prototype.getDataUri                                                                            // 62
 * @private                                                                                                            // 63
 * @param {function} callback callback(err, dataUri)                                                                   // 64
 *                                                                                                                     // 65
 * Passes a data URI representing the data at the URL to a callback.                                                   // 66
 */                                                                                                                    // 67
DataMan.URL.prototype.getDataUri = function dataManUrlGetDataUri(callback) {                                           // 68
  var self = this;                                                                                                     // 69
                                                                                                                       // 70
  self.getBuffer(function (error, buffer) {                                                                            // 71
    if (error) {                                                                                                       // 72
      callback(error);                                                                                                 // 73
    } else {                                                                                                           // 74
      if (!self._type) {                                                                                               // 75
        callback(new Error("DataMan.getDataUri couldn't get a contentType"));                                          // 76
      } else {                                                                                                         // 77
        var dataUri = "data:" + self._type + ";base64," + buffer.toString("base64");                                   // 78
        callback(null, dataUri);                                                                                       // 79
      }                                                                                                                // 80
    }                                                                                                                  // 81
  });                                                                                                                  // 82
};                                                                                                                     // 83
                                                                                                                       // 84
/**                                                                                                                    // 85
 * @method DataMan.URL.prototype.createReadStream                                                                      // 86
 * @private                                                                                                            // 87
 *                                                                                                                     // 88
 * Returns a read stream for the data.                                                                                 // 89
 */                                                                                                                    // 90
DataMan.URL.prototype.createReadStream = function dataManUrlCreateReadStream() {                                       // 91
  var self = this;                                                                                                     // 92
  // Stream from URL                                                                                                   // 93
  return request(_.extend({                                                                                            // 94
    url: self.url,                                                                                                     // 95
    method: "GET"                                                                                                      // 96
  }, self.urlOpts));                                                                                                   // 97
};                                                                                                                     // 98
                                                                                                                       // 99
/**                                                                                                                    // 100
 * @method DataMan.URL.prototype.size                                                                                  // 101
 * @param {function} callback callback(err, size)                                                                      // 102
 * @private                                                                                                            // 103
 *                                                                                                                     // 104
 * Returns the size in bytes of the data at the URL.                                                                   // 105
 */                                                                                                                    // 106
DataMan.URL.prototype.size = function dataManUrlSize(callback) {                                                       // 107
  var self = this;                                                                                                     // 108
                                                                                                                       // 109
  if (typeof self._size === "number") {                                                                                // 110
    callback(null, self._size);                                                                                        // 111
    return;                                                                                                            // 112
  }                                                                                                                    // 113
                                                                                                                       // 114
  self.getBuffer(function (error, buffer) {                                                                            // 115
    if (error) {                                                                                                       // 116
      callback(error);                                                                                                 // 117
    } else {                                                                                                           // 118
      self._size = buffer.length;                                                                                      // 119
      callback(null, self._size);                                                                                      // 120
    }                                                                                                                  // 121
  });                                                                                                                  // 122
};                                                                                                                     // 123
                                                                                                                       // 124
/**                                                                                                                    // 125
 * @method DataMan.URL.prototype.type                                                                                  // 126
 * @private                                                                                                            // 127
 *                                                                                                                     // 128
 * Returns the type of the data.                                                                                       // 129
 */                                                                                                                    // 130
DataMan.URL.prototype.type = function dataManUrlType() {                                                               // 131
  return this._type;                                                                                                   // 132
};                                                                                                                     // 133
                                                                                                                       // 134
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/data-man/server/data-man-readstream.js                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var passThrough = Npm.require('stream').PassThrough;                                                                   // 1
                                                                                                                       // 2
/**                                                                                                                    // 3
 * @method DataMan.ReadStream                                                                                          // 4
 * @public                                                                                                             // 5
 * @constructor                                                                                                        // 6
 * @param {ReadStream} stream                                                                                          // 7
 * @param {String} type The data content (MIME) type.                                                                  // 8
 */                                                                                                                    // 9
DataMan.ReadStream = function DataManBuffer(stream, type) {                                                            // 10
  var self = this;                                                                                                     // 11
  self.stream = stream;                                                                                                // 12
  self._type = type;                                                                                                   // 13
};                                                                                                                     // 14
                                                                                                                       // 15
/**                                                                                                                    // 16
 * @method DataMan.ReadStream.prototype.getBuffer                                                                      // 17
 * @private                                                                                                            // 18
 * @param {function} callback callback(err, buffer)                                                                    // 19
 * @returns {undefined}                                                                                                // 20
 *                                                                                                                     // 21
 * Passes a Buffer representing the data to a callback.                                                                // 22
 */                                                                                                                    // 23
DataMan.ReadStream.prototype.getBuffer = function dataManReadStreamGetBuffer(callback) {                               // 24
  // TODO implement as passthrough stream?                                                                             // 25
};                                                                                                                     // 26
                                                                                                                       // 27
/**                                                                                                                    // 28
 * @method DataMan.ReadStream.prototype.getDataUri                                                                     // 29
 * @private                                                                                                            // 30
 * @param {function} callback callback(err, dataUri)                                                                   // 31
 *                                                                                                                     // 32
 * Passes a data URI representing the data in the stream to a callback.                                                // 33
 */                                                                                                                    // 34
DataMan.ReadStream.prototype.getDataUri = function dataManReadStreamGetDataUri(callback) {                             // 35
  // TODO implement as passthrough stream?                                                                             // 36
};                                                                                                                     // 37
                                                                                                                       // 38
/**                                                                                                                    // 39
 * @method DataMan.ReadStream.prototype.createReadStream                                                               // 40
 * @private                                                                                                            // 41
 *                                                                                                                     // 42
 * Returns a read stream for the data.                                                                                 // 43
 */                                                                                                                    // 44
DataMan.ReadStream.prototype.createReadStream = function dataManReadStreamCreateReadStream() {                         // 45
  return this.stream;                                                                                                  // 46
};                                                                                                                     // 47
                                                                                                                       // 48
/**                                                                                                                    // 49
 * @method DataMan.ReadStream.prototype.size                                                                           // 50
 * @param {function} callback callback(err, size)                                                                      // 51
 * @private                                                                                                            // 52
 *                                                                                                                     // 53
 * Passes the size in bytes of the data in the stream to a callback.                                                   // 54
 */                                                                                                                    // 55
DataMan.ReadStream.prototype.size = function dataManReadStreamSize(callback) {                                         // 56
  // TODO implement as passthrough stream?                                                                             // 57
};                                                                                                                     // 58
                                                                                                                       // 59
/**                                                                                                                    // 60
 * @method DataMan.ReadStream.prototype.type                                                                           // 61
 * @private                                                                                                            // 62
 *                                                                                                                     // 63
 * Returns the type of the data.                                                                                       // 64
 */                                                                                                                    // 65
DataMan.ReadStream.prototype.type = function dataManReadStreamType() {                                                 // 66
  return this._type;                                                                                                   // 67
};                                                                                                                     // 68
                                                                                                                       // 69
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['data-man'] = {
  DataMan: DataMan
};

})();

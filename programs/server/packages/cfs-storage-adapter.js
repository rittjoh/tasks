(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var FS = Package['cfs-base-package'].FS;
var Deps = Package.deps.Deps;
var check = Package.check.check;
var Match = Package.check.Match;
var DDP = Package.livedata.DDP;
var DDPServer = Package.livedata.DDPServer;
var MongoInternals = Package['mongo-livedata'].MongoInternals;
var EJSON = Package.ejson.EJSON;
var EventEmitter = Package.emitter.EventEmitter;

/* Package-scope variables */
var _storageAdapters;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/cfs-storage-adapter/storageAdapter.server.js                                                         //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
// #############################################################################                                 // 1
//                                                                                                               // 2
// STORAGE ADAPTER                                                                                               // 3
//                                                                                                               // 4
// #############################################################################                                 // 5
_storageAdapters = {};                                                                                           // 6
                                                                                                                 // 7
FS.StorageAdapter = function(storeName, options, api) {                                                          // 8
  var self = this;                                                                                               // 9
  options = options || {};                                                                                       // 10
                                                                                                                 // 11
  // If storeName is the only argument, a string and the SA already found                                        // 12
  // we will just return that SA                                                                                 // 13
  if (arguments.length === 1 && storeName === '' + storeName &&                                                  // 14
          typeof _storageAdapters[storeName] !== 'undefined')                                                    // 15
    return _storageAdapters[storeName];                                                                          // 16
                                                                                                                 // 17
  // Verify that the storage adapter defines all the necessary API methods                                       // 18
  if (typeof api === 'undefined') {                                                                              // 19
    throw new Error('FS.StorageAdapter please define an api');                                                   // 20
  }                                                                                                              // 21
                                                                                                                 // 22
  FS.Utility.each('fileKey,remove,typeName,createReadStream,createWriteStream'.split(','), function(name) {      // 23
    if (typeof api[name] === 'undefined') {                                                                      // 24
      throw new Error('FS.StorageAdapter please define an api. "' + name + '" ' + (api.typeName || ''));         // 25
    }                                                                                                            // 26
  });                                                                                                            // 27
                                                                                                                 // 28
  // Create an internal namespace, starting a name with underscore is only                                       // 29
  // allowed for stores marked with options.internal === true                                                    // 30
  if (options.internal !== true && storeName[0] === '_') {                                                       // 31
    throw new Error('A storage adapter name may not begin with "_"');                                            // 32
  }                                                                                                              // 33
                                                                                                                 // 34
  // store reference for easy lookup by storeName                                                                // 35
  if (typeof _storageAdapters[storeName] !== 'undefined') {                                                      // 36
    throw new Error('Storage name already exists: "' + storeName + '"');                                         // 37
  } else {                                                                                                       // 38
    _storageAdapters[storeName] = self;                                                                          // 39
  }                                                                                                              // 40
                                                                                                                 // 41
  // User can customize the file key generation function                                                         // 42
  if (typeof options.fileKeyMaker === "function") {                                                              // 43
    var fileKeyMaker = options.fileKeyMaker;                                                                     // 44
  } else {                                                                                                       // 45
    var fileKeyMaker = api.fileKey;                                                                              // 46
  }                                                                                                              // 47
                                                                                                                 // 48
  // extend self with options and other info                                                                     // 49
  FS.Utility.extend(this, options, {                                                                             // 50
    name: storeName,                                                                                             // 51
    typeName: api.typeName                                                                                       // 52
  });                                                                                                            // 53
                                                                                                                 // 54
  // Create a nicer abstracted adapter interface                                                                 // 55
  self.adapter = {};                                                                                             // 56
                                                                                                                 // 57
  self.adapter.fileKey = function(fileObj) {                                                                     // 58
    return fileKeyMaker(fileObj);                                                                                // 59
  };                                                                                                             // 60
                                                                                                                 // 61
  // Return readable stream for fileKey                                                                          // 62
  self.adapter.createReadStreamForFileKey = function(fileKey, options) {                                         // 63
    FS.debug && console.log('createReadStreamForFileKey ' + storeName);                                          // 64
    return FS.Utility.safeStream( api.createReadStream(fileKey, options) );                                      // 65
  };                                                                                                             // 66
                                                                                                                 // 67
  // Return readable stream for fileObj                                                                          // 68
  self.adapter.createReadStream = function(fileObj, options) {                                                   // 69
    FS.debug && console.log('createReadStream ' + storeName);                                                    // 70
    if (self.internal) {                                                                                         // 71
      // Internal stores take a fileKey                                                                          // 72
      return self.adapter.createReadStreamForFileKey(fileObj, options);                                          // 73
    }                                                                                                            // 74
    return FS.Utility.safeStream( self._transform.createReadStream(fileObj, options) );                          // 75
  };                                                                                                             // 76
                                                                                                                 // 77
  function logEventsForStream(stream) {                                                                          // 78
    if (FS.debug) {                                                                                              // 79
      stream.on('stored', function() {                                                                           // 80
        console.log('-----------STORED STREAM', storeName);                                                      // 81
      });                                                                                                        // 82
                                                                                                                 // 83
      stream.on('close', function() {                                                                            // 84
        console.log('-----------CLOSE STREAM', storeName);                                                       // 85
      });                                                                                                        // 86
                                                                                                                 // 87
      stream.on('end', function() {                                                                              // 88
        console.log('-----------END STREAM', storeName);                                                         // 89
      });                                                                                                        // 90
                                                                                                                 // 91
      stream.on('finish', function() {                                                                           // 92
        console.log('-----------FINISH STREAM', storeName);                                                      // 93
      });                                                                                                        // 94
                                                                                                                 // 95
      stream.on('error', function(error) {                                                                       // 96
        console.log('-----------ERROR STREAM', storeName, error && (error.message || error.code));               // 97
      });                                                                                                        // 98
    }                                                                                                            // 99
  }                                                                                                              // 100
                                                                                                                 // 101
  // Return writeable stream for fileKey                                                                         // 102
  self.adapter.createWriteStreamForFileKey = function(fileKey, options) {                                        // 103
    FS.debug && console.log('createWriteStreamForFileKey ' + storeName);                                         // 104
    var writeStream = FS.Utility.safeStream( api.createWriteStream(fileKey, options) );                          // 105
                                                                                                                 // 106
    logEventsForStream(writeStream);                                                                             // 107
                                                                                                                 // 108
    return writeStream;                                                                                          // 109
  };                                                                                                             // 110
                                                                                                                 // 111
  // Return writeable stream for fileObj                                                                         // 112
  self.adapter.createWriteStream = function(fileObj, options) {                                                  // 113
    FS.debug && console.log('createWriteStream ' + storeName + ', internal: ' + !!self.internal);                // 114
                                                                                                                 // 115
    if (self.internal) {                                                                                         // 116
      // Internal stores take a fileKey                                                                          // 117
      return self.adapter.createWriteStreamForFileKey(fileObj, options);                                         // 118
    }                                                                                                            // 119
                                                                                                                 // 120
    // If we haven't set name, type, and size for this version yet, set it to same values as original version    // 121
    if (!fileObj.name({store: storeName})) {                                                                     // 122
      fileObj.name(fileObj.name(), {store: storeName});                                                          // 123
    }                                                                                                            // 124
    if (!fileObj.type({store: storeName})) {                                                                     // 125
      fileObj.type(fileObj.type(), {store: storeName});                                                          // 126
    }                                                                                                            // 127
    if (!fileObj.size({store: storeName})) {                                                                     // 128
      fileObj.size(fileObj.size(), {store: storeName});                                                          // 129
    }                                                                                                            // 130
                                                                                                                 // 131
    var writeStream = FS.Utility.safeStream( self._transform.createWriteStream(fileObj, options) );              // 132
                                                                                                                 // 133
    logEventsForStream(writeStream);                                                                             // 134
                                                                                                                 // 135
    // Its really only the storage adapter who knows if the file is uploaded                                     // 136
    //                                                                                                           // 137
    // We have to use our own event making sure the storage process is completed                                 // 138
    // this is mainly                                                                                            // 139
    writeStream.safeOn('stored', function(result) {                                                              // 140
      if (typeof result.fileKey === 'undefined') {                                                               // 141
        throw new Error('SA ' + storeName + ' type ' + api.typeName + ' did not return a fileKey');              // 142
      }                                                                                                          // 143
      FS.debug && console.log('SA', storeName, 'stored', result.fileKey);                                        // 144
      // Set the fileKey                                                                                         // 145
      fileObj.copies[storeName].key = result.fileKey;                                                            // 146
                                                                                                                 // 147
      // Update the size, as provided by the SA, in case it was changed by stream transformation                 // 148
      if (typeof result.size === "number") {                                                                     // 149
        fileObj.copies[storeName].size = result.size;                                                            // 150
      }                                                                                                          // 151
                                                                                                                 // 152
      // Set last updated time, either provided by SA or now                                                     // 153
      fileObj.copies[storeName].updatedAt = result.storedAt || new Date();                                       // 154
                                                                                                                 // 155
      // If the file object copy havent got a createdAt then set this                                            // 156
      if (typeof fileObj.copies[storeName].createdAt === 'undefined') {                                          // 157
        fileObj.copies[storeName].createdAt = fileObj.copies[storeName].updatedAt;                               // 158
      }                                                                                                          // 159
                                                                                                                 // 160
      var modifier = {};                                                                                         // 161
      modifier["copies." + storeName] = fileObj.copies[storeName];                                               // 162
      // Update the main file object with the modifier                                                           // 163
      fileObj.update({$set: modifier});                                                                          // 164
                                                                                                                 // 165
    });                                                                                                          // 166
                                                                                                                 // 167
    // Emit events from SA                                                                                       // 168
    writeStream.once('stored', function(result) {                                                                // 169
      // XXX Because of the way stores inherit from SA, this will emit on every store.                           // 170
      // Maybe need to rewrite the way we inherit from SA?                                                       // 171
      var emitted = self.emit('stored', storeName, fileObj);                                                     // 172
      if (FS.debug && !emitted) {                                                                                // 173
        console.log(fileObj.name() + ' was successfully stored in the ' + storeName + ' store. You are seeing this informational message because you enabled debugging and you have not defined any listeners for the "stored" event on this store.');
      }                                                                                                          // 175
    });                                                                                                          // 176
                                                                                                                 // 177
    writeStream.on('error', function(error) {                                                                    // 178
      // XXX We could wrap and clarify error                                                                     // 179
      self.emit('error', storeName, error);                                                                      // 180
    });                                                                                                          // 181
                                                                                                                 // 182
    return writeStream;                                                                                          // 183
  };                                                                                                             // 184
                                                                                                                 // 185
  //internal                                                                                                     // 186
  self._removeAsync = function(fileKey, callback) {                                                              // 187
    // Remove the file from the store                                                                            // 188
    api.remove.call(self, fileKey, callback);                                                                    // 189
  };                                                                                                             // 190
                                                                                                                 // 191
  /**                                                                                                            // 192
   * @method FS.StorageAdapter.prototype.remove                                                                  // 193
   * @public                                                                                                     // 194
   * @param {FS.File} fsFile The FS.File instance to be stored.                                                  // 195
   * @param {Function} [callback] If not provided, will block and return true or false                           // 196
   *                                                                                                             // 197
   * Attempts to remove a file from the store. Returns true if removed or not                                    // 198
   * found, or false if the file couldn't be removed.                                                            // 199
   */                                                                                                            // 200
  self.adapter.remove = function(fileObj, callback) {                                                            // 201
    FS.debug && console.log("---SA REMOVE");                                                                     // 202
                                                                                                                 // 203
    // Get the fileKey                                                                                           // 204
    var fileKey = (fileObj instanceof FS.File) ? self.adapter.fileKey(fileObj) : fileObj;                        // 205
                                                                                                                 // 206
    if (callback) {                                                                                              // 207
      return self._removeAsync(fileKey, FS.Utility.safeCallback(callback));                                      // 208
    } else {                                                                                                     // 209
      return Meteor._wrapAsync(self._removeAsync)(fileKey);                                                      // 210
    }                                                                                                            // 211
  };                                                                                                             // 212
                                                                                                                 // 213
  self.remove = function(fileObj, callback) {                                                                    // 214
    // Add deprecation note                                                                                      // 215
    console.warn('Storage.remove is deprecating, use "Storage.adapter.remove"');                                 // 216
    return self.adapter.remove(fileObj, callback);                                                               // 217
  };                                                                                                             // 218
                                                                                                                 // 219
  if (typeof api.init === 'function') {                                                                          // 220
    Meteor._wrapAsync(api.init.bind(self))();                                                                    // 221
  }                                                                                                              // 222
                                                                                                                 // 223
  // This supports optional transformWrite and transformRead                                                     // 224
  self._transform = new FS.Transform({                                                                           // 225
    adapter: self.adapter,                                                                                       // 226
    // Optional transformation functions:                                                                        // 227
    transformWrite: options.transformWrite,                                                                      // 228
    transformRead: options.transformRead                                                                         // 229
  });                                                                                                            // 230
                                                                                                                 // 231
};                                                                                                               // 232
                                                                                                                 // 233
Npm.require('util').inherits(FS.StorageAdapter, EventEmitter);                                                   // 234
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                               //
// packages/cfs-storage-adapter/transform.server.js                                                              //
//                                                                                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                 //
var PassThrough = Npm.require('stream').PassThrough;                                                             // 1
                                                                                                                 // 2
FS.Transform = function(options) {                                                                               // 3
  var self = this;                                                                                               // 4
                                                                                                                 // 5
  options = options || {};                                                                                       // 6
                                                                                                                 // 7
  if (!(self instanceof FS.Transform))                                                                           // 8
    throw new Error('FS.Transform must be called with the "new" keyword');                                       // 9
                                                                                                                 // 10
  if (!options.adapter)                                                                                          // 11
    throw new Error('Transform expects option.adapter to be a storage adapter');                                 // 12
                                                                                                                 // 13
  self.storage = options.adapter;                                                                                // 14
                                                                                                                 // 15
  // Fetch the transformation functions if any                                                                   // 16
  self.transformWrite = options.transformWrite;                                                                  // 17
  self.transformRead = options.transformRead;                                                                    // 18
};                                                                                                               // 19
                                                                                                                 // 20
// Allow packages to add scope                                                                                   // 21
FS.Transform.scope = {                                                                                           // 22
// Deprecate gm scope:                                                                                           // 23
  gm: function(source, height, color) {                                                                          // 24
    console.warn('Deprecation notice: `this.gm` is deprecating in favour of the general global `gm` scope');     // 25
    if (typeof gm !== 'function')                                                                                // 26
      throw new Error('No graphicsmagick package installed, `gm` not found in scope, eg. `cfs-graphicsmagick`'); // 27
    return gm(source, height, color);                                                                            // 28
  }                                                                                                              // 29
// EO Deprecate gm scope                                                                                         // 30
};                                                                                                               // 31
                                                                                                                 // 32
// The transformation stream triggers an "stored" event when data is stored into                                 // 33
// the storage adapter                                                                                           // 34
FS.Transform.prototype.createWriteStream = function(fileObj, options) {                                          // 35
  var self = this;                                                                                               // 36
                                                                                                                 // 37
  // Get the file key                                                                                            // 38
  var fileKey = self.storage.fileKey(fileObj);                                                                   // 39
                                                                                                                 // 40
  // Rig write stream                                                                                            // 41
  var destinationStream = self.storage.createWriteStreamForFileKey(fileKey, {                                    // 42
    // Not all SA's can set these options and cfs dont depend on setting these                                   // 43
    // but its nice if other systems are accessing the SA that some of the data                                  // 44
    // is also available to those                                                                                // 45
    aliases: [fileObj.name()],                                                                                   // 46
    contentType: fileObj.type(),                                                                                 // 47
    metadata: fileObj.metadata                                                                                   // 48
  });                                                                                                            // 49
                                                                                                                 // 50
  if (typeof self.transformWrite === 'function') {                                                               // 51
                                                                                                                 // 52
    // Rig read stream for gm                                                                                    // 53
    var sourceStream = new PassThrough();                                                                        // 54
                                                                                                                 // 55
    // We pass on the special "stored" event for those listening                                                 // 56
    destinationStream.on('stored', function(result) {                                                            // 57
      sourceStream.emit('stored', result);                                                                       // 58
    });                                                                                                          // 59
                                                                                                                 // 60
    // Rig transform                                                                                             // 61
    try {                                                                                                        // 62
      self.transformWrite.call(FS.Transform.scope, fileObj, sourceStream, destinationStream);                    // 63
      // XXX: If the transform function returns a buffer should we stream that?                                  // 64
    } catch(err) {                                                                                               // 65
      // We emit an error - should we throw an error?                                                            // 66
      console.warn('FS.Transform.createWriteStream transform function failed, Error: ');                         // 67
      throw err;                                                                                                 // 68
    }                                                                                                            // 69
                                                                                                                 // 70
    // Return write stream                                                                                       // 71
    return sourceStream;                                                                                         // 72
  } else {                                                                                                       // 73
                                                                                                                 // 74
    // We dont transform just normal SA interface                                                                // 75
    return destinationStream;                                                                                    // 76
  }                                                                                                              // 77
                                                                                                                 // 78
};                                                                                                               // 79
                                                                                                                 // 80
FS.Transform.prototype.createReadStream = function(fileObj, options) {                                           // 81
  var self = this;                                                                                               // 82
                                                                                                                 // 83
  // XXX: We can check the copy info, but the readstream wil fail no matter what                                 // 84
  // var fileInfo = fileObj.getCopyInfo(name);                                                                   // 85
  // if (!fileInfo) {                                                                                            // 86
  //   return new Error('File not found on this store "' + name + '"');                                          // 87
  // }                                                                                                           // 88
  // var fileKey = folder + fileInfo.key;                                                                        // 89
                                                                                                                 // 90
  // Get the file key                                                                                            // 91
  var fileKey = self.storage.fileKey(fileObj);                                                                   // 92
                                                                                                                 // 93
  // Rig read stream                                                                                             // 94
  var sourceStream = self.storage.createReadStreamForFileKey(fileKey, options);                                  // 95
                                                                                                                 // 96
  if (typeof self.transformRead === 'function') {                                                                // 97
    // Rig write stream                                                                                          // 98
    var destinationStream = new PassThrough();                                                                   // 99
                                                                                                                 // 100
    // Rig transform                                                                                             // 101
    try {                                                                                                        // 102
      self.transformRead.call(FS.Transform.scope, fileObj, sourceStream, destinationStream);                     // 103
    } catch(err) {                                                                                               // 104
      //throw new Error(err);                                                                                    // 105
      // We emit an error - should we throw an error?                                                            // 106
      sourceStream.emit('error', 'FS.Transform.createReadStream transform function failed');                     // 107
    }                                                                                                            // 108
                                                                                                                 // 109
    // Return write stream                                                                                       // 110
    return destinationStream;                                                                                    // 111
                                                                                                                 // 112
  }                                                                                                              // 113
                                                                                                                 // 114
  // We dont transform just normal SA interface                                                                  // 115
  return sourceStream;                                                                                           // 116
};                                                                                                               // 117
                                                                                                                 // 118
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['cfs-storage-adapter'] = {};

})();

(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var FS = Package['cfs-base-package'].FS;

/* Package-scope variables */
var _chunkPath, _fileReference;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/cfs-tempstore/tempStore.js                                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// ##Temporary Storage                                                                                                 // 1
//                                                                                                                     // 2
// Temporary storage is used for chunked uploads until all chunks are received                                         // 3
// and all copies have been made or given up. In some cases, the original file                                         // 4
// is stored only in temporary storage (for example, if all copies do some                                             // 5
// manipulation in beforeSave). This is why we use the temporary file as the                                           // 6
// basis for each saved copy, and then remove it after all copies are saved.                                           // 7
//                                                                                                                     // 8
// Every chunk is saved as an individual temporary file. This is safer than                                            // 9
// attempting to write multiple incoming chunks to different positions in a                                            // 10
// single temporary file, which can lead to write conflicts.                                                           // 11
//                                                                                                                     // 12
// Using temp files also allows us to easily resume uploads, even if the server                                        // 13
// restarts, and to keep the working memory clear.                                                                     // 14
                                                                                                                       // 15
// The FS.TempStore emits events that others are able to listen to                                                     // 16
var EventEmitter = Npm.require('events').EventEmitter;                                                                 // 17
                                                                                                                       // 18
// We have a special stream concating all chunk files into one readable stream                                         // 19
var CombinedStream = Npm.require('combined-stream');                                                                   // 20
                                                                                                                       // 21
/** @namespace FS.TempStore                                                                                            // 22
 * @property FS.TempStore                                                                                              // 23
 * @type {object}                                                                                                      // 24
 * @public                                                                                                             // 25
 * *it's an event emitter*                                                                                             // 26
 */                                                                                                                    // 27
FS.TempStore = new EventEmitter();                                                                                     // 28
                                                                                                                       // 29
// Create a tracker collection for keeping track of all chunks for any files that are currently in the temp store      // 30
var tracker = FS.TempStore.Tracker = new Meteor.Collection('cfs._tempstore.chunks');                                   // 31
                                                                                                                       // 32
/**                                                                                                                    // 33
 * @property FS.TempStore.Storage                                                                                      // 34
 * @type {StorageAdapter}                                                                                              // 35
 * @namespace FS.TempStore                                                                                             // 36
 * @private                                                                                                            // 37
 * This property is set to either `FS.Store.FileSystem` or `FS.Store.GridFS`                                           // 38
 *                                                                                                                     // 39
 * __When and why:__                                                                                                   // 40
 * We normally default to `cfs-filesystem` unless its not installed. *(we default to gridfs if installed)*             // 41
 * But if `cfs-gridfs` and `cfs-worker` is installed we default to `cfs-gridfs`                                        // 42
 *                                                                                                                     // 43
 * If `cfs-gridfs` and `cfs-filesystem` is not installed we log a warning.                                             // 44
 * the user can set `FS.TempStore.Storage` them selfs eg.:                                                             // 45
 * ```js                                                                                                               // 46
 *   // Its important to set `internal: true` this lets the SA know that we                                            // 47
 *   // are using this internally and it will give us direct SA api                                                    // 48
 *   FS.TempStore.Storage = new FS.Store.GridFS('_tempstore', { internal: true });                                     // 49
 * ```                                                                                                                 // 50
 *                                                                                                                     // 51
 * > Note: This is considered as `advanced` use, its not a common pattern.                                             // 52
 */                                                                                                                    // 53
FS.TempStore.Storage = null;                                                                                           // 54
                                                                                                                       // 55
// We will not mount a storage adapter until needed. This allows us to check for the                                   // 56
// existance of FS.FileWorker, which is loaded after this package because it                                           // 57
// depends on this package.                                                                                            // 58
function mountStorage() {                                                                                              // 59
                                                                                                                       // 60
  if (FS.TempStore.Storage) return;                                                                                    // 61
                                                                                                                       // 62
  if (Package["cfs-gridfs"] && (Package["cfs-worker"] || !Package["cfs-filesystem"])) {                                // 63
    // If the file worker is installed we would prefer to use the gridfs sa                                            // 64
    // for scalability. We also default to gridfs if filesystem is not found                                           // 65
                                                                                                                       // 66
    // Use the gridfs                                                                                                  // 67
    FS.TempStore.Storage = new FS.Store.GridFS('_tempstore', { internal: true });                                      // 68
  } else if (Package["cfs-filesystem"]) {                                                                              // 69
    // use the Filesystem                                                                                              // 70
    FS.TempStore.Storage = new FS.Store.FileSystem('_tempstore', { internal: true });                                  // 71
  } else {                                                                                                             // 72
    throw new Error('FS.TempStore.Storage is not set: Install cfs-filesystem or cfs-gridfs or set it manually');       // 73
  }                                                                                                                    // 74
                                                                                                                       // 75
  FS.debug && console.log('TempStore is mounted on', FS.TempStore.Storage.typeName);                                   // 76
}                                                                                                                      // 77
                                                                                                                       // 78
function mountFile(fileObj, name) {                                                                                    // 79
  if (!fileObj.isMounted()) {                                                                                          // 80
    throw new Error(name + ' cannot work with unmounted file');                                                        // 81
  }                                                                                                                    // 82
}                                                                                                                      // 83
                                                                                                                       // 84
// We update the fileObj on progress                                                                                   // 85
FS.TempStore.on('progress', function(fileObj, chunkNum, count, total, result) {                                        // 86
  FS.debug && console.log('TempStore progress: Received ' + count + ' of ' + total + ' chunks for ' + fileObj.name()); // 87
});                                                                                                                    // 88
                                                                                                                       // 89
// XXX: TODO                                                                                                           // 90
// FS.TempStore.on('stored', function(fileObj, chunkCount, result) {                                                   // 91
//   // This should work if we pass on result from the SA on stored event...                                           // 92
//   fileObj.update({ $set: { chunkSum: 1, chunkCount: chunkCount, size: result.size } });                             // 93
// });                                                                                                                 // 94
                                                                                                                       // 95
// Stream implementation                                                                                               // 96
                                                                                                                       // 97
/**                                                                                                                    // 98
 * @method _chunkPath                                                                                                  // 99
 * @private                                                                                                            // 100
 * @param {Number} [n] Chunk number                                                                                    // 101
 * @returns {String} Chunk naming convention                                                                           // 102
 */                                                                                                                    // 103
_chunkPath = function(n) {                                                                                             // 104
  return (n || 0) + '.chunk';                                                                                          // 105
};                                                                                                                     // 106
                                                                                                                       // 107
/**                                                                                                                    // 108
 * @method _fileReference                                                                                              // 109
 * @param {FS.File} fileObj                                                                                            // 110
 * @param {Number} chunk                                                                                               // 111
 * @private                                                                                                            // 112
 * @returns {String} Generated SA specific fileKey for the chunk                                                       // 113
 *                                                                                                                     // 114
 * Note: Calling function should call mountStorage() first, and                                                        // 115
 * make sure that fileObj is mounted.                                                                                  // 116
 */                                                                                                                    // 117
_fileReference = function(fileObj, chunk, existing) {                                                                  // 118
  // Maybe it's a chunk we've already saved                                                                            // 119
  existing = existing || tracker.findOne({fileId: fileObj._id, collectionName: fileObj.collectionName});               // 120
                                                                                                                       // 121
  // Make a temporary fileObj just for fileKey generation                                                              // 122
  var tempFileObj = new FS.File({                                                                                      // 123
    collectionName: fileObj.collectionName,                                                                            // 124
    _id: fileObj._id,                                                                                                  // 125
    original: {                                                                                                        // 126
      name: _chunkPath(chunk)                                                                                          // 127
    },                                                                                                                 // 128
    copies: {                                                                                                          // 129
      _tempstore: {                                                                                                    // 130
        key: existing && existing.keys[chunk]                                                                          // 131
      }                                                                                                                // 132
    }                                                                                                                  // 133
  });                                                                                                                  // 134
                                                                                                                       // 135
  // Return a fitting fileKey SA specific                                                                              // 136
  return FS.TempStore.Storage.adapter.fileKey(tempFileObj);                                                            // 137
};                                                                                                                     // 138
                                                                                                                       // 139
/**                                                                                                                    // 140
 * @method FS.TempStore.exists                                                                                         // 141
 * @param {FS.File} File object                                                                                        // 142
 * @returns {Boolean} Is this file, or parts of it, currently stored in the TempStore                                  // 143
 */                                                                                                                    // 144
FS.TempStore.exists = function(fileObj) {                                                                              // 145
  var existing = tracker.findOne({fileId: fileObj._id, collectionName: fileObj.collectionName});                       // 146
  return !!existing;                                                                                                   // 147
};                                                                                                                     // 148
                                                                                                                       // 149
/**                                                                                                                    // 150
 * @method FS.TempStore.listParts                                                                                      // 151
 * @param {FS.File} fileObj                                                                                            // 152
 * @returns {Object} of parts already stored                                                                           // 153
 * @todo This is not yet implemented, milestone 1.1.0                                                                  // 154
 */                                                                                                                    // 155
FS.TempStore.listParts = function fsTempStoreListParts(fileObj) {                                                      // 156
  var self = this;                                                                                                     // 157
  console.warn('This function is not correctly implemented using SA in TempStore');                                    // 158
  //XXX This function might be necessary for resume. Not currently supported.                                          // 159
};                                                                                                                     // 160
                                                                                                                       // 161
/**                                                                                                                    // 162
 * @method FS.TempStore.removeFile                                                                                     // 163
 * @public                                                                                                             // 164
 * @param {FS.File} fileObj                                                                                            // 165
 * This function removes the file from tempstorage - it cares not if file is                                           // 166
 * already removed or not found, goal is reached anyway.                                                               // 167
 */                                                                                                                    // 168
FS.TempStore.removeFile = function fsTempStoreRemoveFile(fileObj) {                                                    // 169
  var self = this;                                                                                                     // 170
                                                                                                                       // 171
  // Ensure that we have a storage adapter mounted; if not, throw an error.                                            // 172
  mountStorage();                                                                                                      // 173
                                                                                                                       // 174
  // If fileObj is not mounted or can't be, throw an error                                                             // 175
  mountFile(fileObj, 'FS.TempStore.removeFile');                                                                       // 176
                                                                                                                       // 177
  // Emit event                                                                                                        // 178
  self.emit('remove', fileObj);                                                                                        // 179
                                                                                                                       // 180
  var chunkInfo = tracker.findOne({                                                                                    // 181
    fileId: fileObj._id,                                                                                               // 182
    collectionName: fileObj.collectionName                                                                             // 183
  });                                                                                                                  // 184
                                                                                                                       // 185
  if (chunkInfo) {                                                                                                     // 186
                                                                                                                       // 187
    // Unlink each file                                                                                                // 188
    FS.Utility.each(chunkInfo.keys || {}, function (key, chunk) {                                                      // 189
      var fileKey = _fileReference(fileObj, chunk, chunkInfo);                                                         // 190
      FS.TempStore.Storage.adapter.remove(fileKey, FS.Utility.noop);                                                   // 191
    });                                                                                                                // 192
                                                                                                                       // 193
    // Remove fileObj from tracker collection, too                                                                     // 194
    tracker.remove({_id: chunkInfo._id});                                                                              // 195
                                                                                                                       // 196
  }                                                                                                                    // 197
};                                                                                                                     // 198
                                                                                                                       // 199
/**                                                                                                                    // 200
 * @method FS.TempStore.removeAll                                                                                      // 201
 * @public                                                                                                             // 202
 * This function removes all files from tempstorage - it cares not if file is                                          // 203
 * already removed or not found, goal is reached anyway.                                                               // 204
 */                                                                                                                    // 205
FS.TempStore.removeAll = function fsTempStoreRemoveAll() {                                                             // 206
  var self = this;                                                                                                     // 207
                                                                                                                       // 208
  // Ensure that we have a storage adapter mounted; if not, throw an error.                                            // 209
  mountStorage();                                                                                                      // 210
                                                                                                                       // 211
  tracker.find().forEach(function (chunkInfo) {                                                                        // 212
    // Unlink each file                                                                                                // 213
    FS.Utility.each(chunkInfo.keys || {}, function (key, chunk) {                                                      // 214
      var fileKey = _fileReference({_id: chunkInfo.fileId, collectionName: chunkInfo.collectionName}, chunk, chunkInfo);
      FS.TempStore.Storage.adapter.remove(fileKey, FS.Utility.noop);                                                   // 216
    });                                                                                                                // 217
                                                                                                                       // 218
    // Remove from tracker collection, too                                                                             // 219
    tracker.remove({_id: chunkInfo._id});                                                                              // 220
  });                                                                                                                  // 221
};                                                                                                                     // 222
                                                                                                                       // 223
/**                                                                                                                    // 224
 * @method FS.TempStore.createWriteStream                                                                              // 225
 * @public                                                                                                             // 226
 * @param {FS.File} fileObj File to store in temporary storage                                                         // 227
 * @param {Number | String} [options]                                                                                  // 228
 * @returns {Stream} Writeable stream                                                                                  // 229
 *                                                                                                                     // 230
 * `options` of different types mean differnt things:                                                                  // 231
 * * `undefined` We store the file in one part                                                                         // 232
 * *(Normal server-side api usage)*                                                                                    // 233
 * * `Number` the number is the part number total                                                                      // 234
 * *(multipart uploads will use this api)*                                                                             // 235
 * * `String` the string is the name of the `store` that wants to store file data                                      // 236
 * *(stores that want to sync their data to the rest of the files stores will use this)*                               // 237
 *                                                                                                                     // 238
 * > Note: fileObj must be mounted on a `FS.Collection`, it makes no sense to store otherwise                          // 239
 */                                                                                                                    // 240
FS.TempStore.createWriteStream = function(fileObj, options) {                                                          // 241
  var self = this;                                                                                                     // 242
                                                                                                                       // 243
  // Ensure that we have a storage adapter mounted; if not, throw an error.                                            // 244
  mountStorage();                                                                                                      // 245
                                                                                                                       // 246
  // If fileObj is not mounted or can't be, throw an error                                                             // 247
  mountFile(fileObj, 'FS.TempStore.createWriteStream');                                                                // 248
                                                                                                                       // 249
  // Cache the selector for use multiple times below                                                                   // 250
  var selector = {fileId: fileObj._id, collectionName: fileObj.collectionName};                                        // 251
                                                                                                                       // 252
  // TODO, should pass in chunkSum so we don't need to use FS.File for it                                              // 253
  var chunkSum = fileObj.chunkSum || 1;                                                                                // 254
                                                                                                                       // 255
  // Add fileObj to tracker collection                                                                                 // 256
  tracker.upsert(selector, {$setOnInsert: {keys: {}}});                                                                // 257
                                                                                                                       // 258
  // Determine how we're using the writeStream                                                                         // 259
  var isOnePart = false, isMultiPart = false, isStoreSync = false, chunkNum = 0;                                       // 260
  if (options === +options) {                                                                                          // 261
    isMultiPart = true;                                                                                                // 262
    chunkNum = options;                                                                                                // 263
  } else if (options === ''+options) {                                                                                 // 264
    isStoreSync = true;                                                                                                // 265
  } else {                                                                                                             // 266
    isOnePart = true;                                                                                                  // 267
  }                                                                                                                    // 268
                                                                                                                       // 269
  // XXX: it should be possible for a store to sync by storing data into the                                           // 270
  // tempstore - this could be done nicely by setting the store name as string                                         // 271
  // in the chunk variable?                                                                                            // 272
  // This store name could be passed on the the fileworker via the uploaded                                            // 273
  // event                                                                                                             // 274
  // So the uploaded event can return:                                                                                 // 275
  // undefined - if data is stored into and should sync out to all storage adapters                                    // 276
  // number - if a chunk has been uploaded                                                                             // 277
  // string - if a storage adapter wants to sync its data to the other SA's                                            // 278
                                                                                                                       // 279
  // Find a nice location for the chunk data                                                                           // 280
  var fileKey = _fileReference(fileObj, chunkNum);                                                                     // 281
                                                                                                                       // 282
  // Create the stream as Meteor safe stream                                                                           // 283
  var writeStream = FS.TempStore.Storage.adapter.createWriteStream(fileKey);                                           // 284
                                                                                                                       // 285
  // When the stream closes we update the chunkCount                                                                   // 286
  writeStream.safeOn('stored', function(result) {                                                                      // 287
    // Save key in tracker document                                                                                    // 288
    var setObj = {};                                                                                                   // 289
    setObj['keys.' + chunkNum] = result.fileKey;                                                                       // 290
    tracker.update(selector, {$set: setObj});                                                                          // 291
                                                                                                                       // 292
    // Get updated chunkCount                                                                                          // 293
    var chunkCount = FS.Utility.size(tracker.findOne(selector).keys);                                                  // 294
                                                                                                                       // 295
    // Progress                                                                                                        // 296
    self.emit('progress', fileObj, chunkNum, chunkCount, chunkSum, result);                                            // 297
                                                                                                                       // 298
    // If upload is completed                                                                                          // 299
    if (chunkCount === chunkSum) {                                                                                     // 300
      // We no longer need the chunk info                                                                              // 301
      var modifier = { $set: {}, $unset: {chunkCount: 1, chunkSum: 1, chunkSize: 1} };                                 // 302
                                                                                                                       // 303
      // Check if the file has been uploaded before                                                                    // 304
      if (typeof fileObj.uploadedAt === 'undefined') {                                                                 // 305
        // We set the uploadedAt date                                                                                  // 306
        modifier.$set.uploadedAt = new Date();                                                                         // 307
      } else {                                                                                                         // 308
        // We have been uploaded so an event were file data is updated is                                              // 309
        // called synchronizing - so this must be a synchronizedAt?                                                    // 310
        modifier.$set.synchronizedAt = new Date();                                                                     // 311
      }                                                                                                                // 312
                                                                                                                       // 313
      // Update the fileObject                                                                                         // 314
      fileObj.update(modifier);                                                                                        // 315
                                                                                                                       // 316
      // Fire ending events                                                                                            // 317
      var eventName = isStoreSync ? 'synchronized' : 'stored';                                                         // 318
      self.emit(eventName, fileObj, result);                                                                           // 319
                                                                                                                       // 320
      // XXX is emitting "ready" necessary?                                                                            // 321
      self.emit('ready', fileObj, chunkCount, result);                                                                 // 322
    } else {                                                                                                           // 323
      // Update the chunkCount on the fileObject                                                                       // 324
      fileObj.update({ $set: {chunkCount: chunkCount} });                                                              // 325
    }                                                                                                                  // 326
  });                                                                                                                  // 327
                                                                                                                       // 328
  // Emit errors                                                                                                       // 329
  writeStream.on('error', function (error) {                                                                           // 330
    self.emit('error', error, fileObj);                                                                                // 331
  });                                                                                                                  // 332
                                                                                                                       // 333
  return writeStream;                                                                                                  // 334
};                                                                                                                     // 335
                                                                                                                       // 336
/**                                                                                                                    // 337
  * @method FS.TempStore.createReadStream                                                                              // 338
  * @public                                                                                                            // 339
  * @param {FS.File} fileObj The file to read                                                                          // 340
  * @return {Stream} Returns readable stream                                                                           // 341
  *                                                                                                                    // 342
  */                                                                                                                   // 343
FS.TempStore.createReadStream = function(fileObj) {                                                                    // 344
  // Ensure that we have a storage adapter mounted; if not, throw an error.                                            // 345
  mountStorage();                                                                                                      // 346
                                                                                                                       // 347
  // If fileObj is not mounted or can't be, throw an error                                                             // 348
  mountFile(fileObj, 'FS.TempStore.createReadStream');                                                                 // 349
                                                                                                                       // 350
  FS.debug && console.log('FS.TempStore creating read stream for ' + fileObj._id);                                     // 351
                                                                                                                       // 352
  // Determine how many total chunks there are from the tracker collection                                             // 353
  var chunkInfo = tracker.findOne({fileId: fileObj._id, collectionName: fileObj.collectionName}) || {};                // 354
  var totalChunks = FS.Utility.size(chunkInfo.keys);                                                                   // 355
                                                                                                                       // 356
  function getNextStreamFunc(chunk) {                                                                                  // 357
    return Meteor.bindEnvironment(function(next) {                                                                     // 358
      var fileKey = _fileReference(fileObj, chunk);                                                                    // 359
      var chunkReadStream = FS.TempStore.Storage.adapter.createReadStream(fileKey);                                    // 360
      next(chunkReadStream);                                                                                           // 361
    }, function (error) {                                                                                              // 362
      throw error;                                                                                                     // 363
    });                                                                                                                // 364
  }                                                                                                                    // 365
                                                                                                                       // 366
  // Make a combined stream                                                                                            // 367
  var combinedStream = CombinedStream.create();                                                                        // 368
                                                                                                                       // 369
  // Add each chunk stream to the combined stream when the previous chunk stream ends                                  // 370
  var currentChunk = 0;                                                                                                // 371
  for (var chunk = 0; chunk < totalChunks; chunk++) {                                                                  // 372
    combinedStream.append(getNextStreamFunc(chunk));                                                                   // 373
  }                                                                                                                    // 374
                                                                                                                       // 375
  // Return the combined stream                                                                                        // 376
  return combinedStream;                                                                                               // 377
};                                                                                                                     // 378
                                                                                                                       // 379
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['cfs-tempstore'] = {};

})();

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
var HTTP = Package.http.HTTP;
var DataMan = Package['data-man'].DataMan;

(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/cfs-file/fsFile-common.js                                                                             //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
/**                                                                                                               // 1
 * @method FS.File                                                                                                // 2
 * @namespace FS.File                                                                                             // 3
 * @public                                                                                                        // 4
 * @constructor                                                                                                   // 5
 * @param {object|FS.File|data to attach} [ref] Another FS.File instance, a filerecord, or some data to pass to attachData
 */                                                                                                               // 7
FS.File = function(ref, createdByTransform) {                                                                     // 8
  var self = this;                                                                                                // 9
                                                                                                                  // 10
  self.createdByTransform = !!createdByTransform;                                                                 // 11
                                                                                                                  // 12
  if (ref instanceof FS.File || isBasicObject(ref)) {                                                             // 13
    // Extend self with filerecord related data                                                                   // 14
    FS.Utility.extend(self, FS.Utility.cloneFileRecord(ref, {full: true}));                                       // 15
  } else if (ref) {                                                                                               // 16
    self.attachData(ref);                                                                                         // 17
  }                                                                                                               // 18
};                                                                                                                // 19
                                                                                                                  // 20
/**                                                                                                               // 21
 * @method FS.File.prototype.attachData                                                                           // 22
 * @public                                                                                                        // 23
 * @param {File|Blob|Buffer|ArrayBuffer|Uint8Array|String} data The data that you want to attach to the file.     // 24
 * @param {Object} [options] Options                                                                              // 25
 * @param {String} [options.type] The data content (MIME) type, if known.                                         // 26
 * @param {String} [options.headers] When attaching a URL, headers to be used for the GET request (currently server only)
 * @param {String} [options.auth] When attaching a URL, "username:password" to be used for the GET request (currently server only)
 * @param {Function} [callback] Callback function, callback(error). On the client, a callback is required if data is a URL.
 * @returns {FS.File} This FS.File instance.                                                                      // 30
 *                                                                                                                // 31
 */                                                                                                               // 32
FS.File.prototype.attachData = function fsFileAttachData(data, options, callback) {                               // 33
  var self = this;                                                                                                // 34
                                                                                                                  // 35
  if (!callback && typeof options === "function") {                                                               // 36
    callback = options;                                                                                           // 37
    options = {};                                                                                                 // 38
  }                                                                                                               // 39
  options = options || {};                                                                                        // 40
                                                                                                                  // 41
  if (!data) {                                                                                                    // 42
    throw new Error('FS.File.attachData requires a data argument with some data');                                // 43
  }                                                                                                               // 44
                                                                                                                  // 45
  var urlOpts;                                                                                                    // 46
                                                                                                                  // 47
  // Set any other properties we can determine from the source data                                               // 48
  // File                                                                                                         // 49
  if (typeof File !== "undefined" && data instanceof File) {                                                      // 50
    self.name(data.name)                                                                                          // 51
    self.updatedAt(data.lastModifiedDate);                                                                        // 52
    self.size(data.size);                                                                                         // 53
    setData(data.type);                                                                                           // 54
  }                                                                                                               // 55
  // Blob                                                                                                         // 56
  else if (typeof Blob !== "undefined" && data instanceof Blob) {                                                 // 57
    self.updatedAt(new Date);                                                                                     // 58
    self.size(data.size);                                                                                         // 59
    setData(data.type);                                                                                           // 60
  }                                                                                                               // 61
  // URL: we need to do a HEAD request to get the type because type                                               // 62
  // is required for filtering to work.                                                                           // 63
  else if (typeof data === "string" && (data.slice(0, 5) === "http:" || data.slice(0, 6) === "https:")) {         // 64
    urlOpts = FS.Utility.extend({}, options);                                                                     // 65
    if (urlOpts.type) {                                                                                           // 66
      delete urlOpts.type;                                                                                        // 67
    }                                                                                                             // 68
                                                                                                                  // 69
    if (!callback) {                                                                                              // 70
      if (Meteor.isClient) {                                                                                      // 71
        throw new Error('FS.File.attachData requires a callback when attaching a URL on the client');             // 72
      }                                                                                                           // 73
      var result = Meteor.call('_cfs_getUrlInfo', data, urlOpts);                                                 // 74
      FS.Utility.extend(self, {original: result});                                                                // 75
      setData(result.type);                                                                                       // 76
    } else {                                                                                                      // 77
      Meteor.call('_cfs_getUrlInfo', data, urlOpts, function (error, result) {                                    // 78
        FS.debug && console.log("URL HEAD RESULT:", result);                                                      // 79
        if (error) {                                                                                              // 80
          callback(error);                                                                                        // 81
        } else {                                                                                                  // 82
          FS.Utility.extend(self, {original: result});                                                            // 83
          setData(result.type);                                                                                   // 84
        }                                                                                                         // 85
      });                                                                                                         // 86
    }                                                                                                             // 87
  }                                                                                                               // 88
  // Everything else                                                                                              // 89
  else {                                                                                                          // 90
    setData(options.type);                                                                                        // 91
  }                                                                                                               // 92
                                                                                                                  // 93
  // Set the data                                                                                                 // 94
  function setData(type) {                                                                                        // 95
    self.data = new DataMan(data, type, urlOpts);                                                                 // 96
                                                                                                                  // 97
    // Update the type to match what the data is                                                                  // 98
    self.type(self.data.type());                                                                                  // 99
                                                                                                                  // 100
    // Update the size to match what the data is.                                                                 // 101
    // It's always safe to call self.data.size() without supplying a callback                                     // 102
    // because it requires a callback only for URLs on the client, and we                                         // 103
    // already added size for URLs when we got the result from '_cfs_getUrlInfo' method.                          // 104
    if (!self.size()) {                                                                                           // 105
      if (callback) {                                                                                             // 106
        self.data.size(function (error, size) {                                                                   // 107
          if (error) {                                                                                            // 108
            callback && callback(error);                                                                          // 109
          } else {                                                                                                // 110
            self.size(size);                                                                                      // 111
            setName();                                                                                            // 112
          }                                                                                                       // 113
        });                                                                                                       // 114
      } else {                                                                                                    // 115
        self.size(self.data.size());                                                                              // 116
        setName();                                                                                                // 117
      }                                                                                                           // 118
    } else {                                                                                                      // 119
      setName();                                                                                                  // 120
    }                                                                                                             // 121
  }                                                                                                               // 122
                                                                                                                  // 123
  function setName() {                                                                                            // 124
    // See if we can extract a file name from URL or filepath                                                     // 125
    if (!self.name() && typeof data === "string") {                                                               // 126
      // name from URL                                                                                            // 127
      if (data.slice(0, 5) === "http:" || data.slice(0, 6) === "https:") {                                        // 128
        if (FS.Utility.getFileExtension(data).length) {                                                           // 129
          // for a URL we assume the end is a filename only if it has an extension                                // 130
          self.name(FS.Utility.getFileName(data));                                                                // 131
        }                                                                                                         // 132
      }                                                                                                           // 133
      // name from filepath                                                                                       // 134
      else if (data.slice(0, 5) !== "data:") {                                                                    // 135
        self.name(FS.Utility.getFileName(data));                                                                  // 136
      }                                                                                                           // 137
    }                                                                                                             // 138
                                                                                                                  // 139
    callback && callback();                                                                                       // 140
  }                                                                                                               // 141
                                                                                                                  // 142
  return self; //allow chaining                                                                                   // 143
};                                                                                                                // 144
                                                                                                                  // 145
/**                                                                                                               // 146
 * @method FS.File.prototype.uploadProgress                                                                       // 147
 * @public                                                                                                        // 148
 * @returns {number} The server confirmed upload progress                                                         // 149
 */                                                                                                               // 150
FS.File.prototype.uploadProgress = function() {                                                                   // 151
  var self = this;                                                                                                // 152
  // Make sure our file record is updated                                                                         // 153
  self.getFileRecord();                                                                                           // 154
                                                                                                                  // 155
  // If fully uploaded, return 100                                                                                // 156
  if (self.uploadedAt) {                                                                                          // 157
    return 100;                                                                                                   // 158
  }                                                                                                               // 159
  // Otherwise return the confirmed progress or 0                                                                 // 160
  else {                                                                                                          // 161
    return Math.round((self.chunkCount || 0) / (self.chunkSum || 1) * 100);                                       // 162
  }                                                                                                               // 163
};                                                                                                                // 164
                                                                                                                  // 165
/**                                                                                                               // 166
 * @method FS.File.prototype.controlledByDeps                                                                     // 167
 * @public                                                                                                        // 168
 * @returns {FS.Collection} Returns true if this FS.File is reactive                                              // 169
 *                                                                                                                // 170
 * > Note: Returns true if this FS.File object was created by a FS.Collection                                     // 171
 * > and we are in a reactive computations. What does this mean? Well it should                                   // 172
 * > mean that our fileRecord is fully updated by Meteor and we are mounted on                                    // 173
 * > a collection                                                                                                 // 174
 */                                                                                                               // 175
FS.File.prototype.controlledByDeps = function() {                                                                 // 176
  var self = this;                                                                                                // 177
  return self.createdByTransform && Deps.active;                                                                  // 178
};                                                                                                                // 179
                                                                                                                  // 180
/**                                                                                                               // 181
 * @method FS.File.prototype.getCollection                                                                        // 182
 * @public                                                                                                        // 183
 * @returns {FS.Collection} Returns attached collection or undefined if not mounted                               // 184
 */                                                                                                               // 185
FS.File.prototype.getCollection = function() {                                                                    // 186
  // Get the collection reference                                                                                 // 187
  var self = this;                                                                                                // 188
                                                                                                                  // 189
  // If we already made the link then do no more                                                                  // 190
  if (self.collection) {                                                                                          // 191
    return self.collection;                                                                                       // 192
  }                                                                                                               // 193
                                                                                                                  // 194
  // If we don't have a collectionName then there's not much to do, the file is                                   // 195
  // not mounted yet                                                                                              // 196
  if (!self.collectionName) {                                                                                     // 197
    // Should not throw an error here - could be common that the file is not                                      // 198
    // yet mounted into a collection                                                                              // 199
    return;                                                                                                       // 200
  }                                                                                                               // 201
                                                                                                                  // 202
  // Link the collection to the file                                                                              // 203
  self.collection = FS._collections[self.collectionName];                                                         // 204
                                                                                                                  // 205
  return self.collection; //possibly undefined, but that's desired behavior                                       // 206
};                                                                                                                // 207
                                                                                                                  // 208
/**                                                                                                               // 209
 * @method FS.File.prototype.isMounted                                                                            // 210
 * @public                                                                                                        // 211
 * @returns {FS.Collection} Returns attached collection or undefined if not mounted                               // 212
 */                                                                                                               // 213
FS.File.prototype.isMounted = FS.File.prototype.getCollection;                                                    // 214
                                                                                                                  // 215
/**                                                                                                               // 216
 * @method FS.File.prototype.getFileRecord Returns the fileRecord                                                 // 217
 * @public                                                                                                        // 218
 * @returns {object} The filerecord                                                                               // 219
 */                                                                                                               // 220
FS.File.prototype.getFileRecord = function() {                                                                    // 221
  var self = this;                                                                                                // 222
  // Check if this file object fileRecord is kept updated by Meteor, if so                                        // 223
  // return self                                                                                                  // 224
  if (self.controlledByDeps()) {                                                                                  // 225
    return self;                                                                                                  // 226
  }                                                                                                               // 227
  // Go for manually updating the file record                                                                     // 228
  if (self.isMounted()) {                                                                                         // 229
    FS.debug && console.log('GET FILERECORD: ' + self._id);                                                       // 230
                                                                                                                  // 231
    // Return the fileRecord or an empty object                                                                   // 232
    var fileRecord = self.collection.files.findOne({_id: self._id}) || {};                                        // 233
    FS.Utility.extend(self, fileRecord);                                                                          // 234
    return fileRecord;                                                                                            // 235
  } else {                                                                                                        // 236
    // We return an empty object, this way users can still do `getRecord().size`                                  // 237
    // Without getting an error                                                                                   // 238
    return {};                                                                                                    // 239
  }                                                                                                               // 240
};                                                                                                                // 241
                                                                                                                  // 242
/**                                                                                                               // 243
 * @method FS.File.prototype.update                                                                               // 244
 * @public                                                                                                        // 245
 * @param {modifier} modifier                                                                                     // 246
 * @param {object} [options]                                                                                      // 247
 * @param {function} [callback]                                                                                   // 248
 *                                                                                                                // 249
 * Updates the fileRecord.                                                                                        // 250
 */                                                                                                               // 251
FS.File.prototype.update = function(modifier, options, callback) {                                                // 252
  var self = this;                                                                                                // 253
                                                                                                                  // 254
  FS.debug && console.log('UPDATE: ' + JSON.stringify(modifier));                                                 // 255
                                                                                                                  // 256
  // Make sure we have options and callback                                                                       // 257
  if (!callback && typeof options === 'function') {                                                               // 258
    callback = options;                                                                                           // 259
    options = {};                                                                                                 // 260
  }                                                                                                               // 261
  callback = callback || FS.Utility.defaultCallback;                                                              // 262
                                                                                                                  // 263
  if (!self.isMounted()) {                                                                                        // 264
    callback(new Error("Cannot update a file that is not associated with a collection"));                         // 265
    return;                                                                                                       // 266
  }                                                                                                               // 267
                                                                                                                  // 268
  // Call collection update - File record                                                                         // 269
  return self.collection.files.update({_id: self._id}, modifier, options, function(err, count) {                  // 270
    // Update the fileRecord if it was changed and on the client                                                  // 271
    // The server-side methods will pull the fileRecord if needed                                                 // 272
    if (count > 0 && Meteor.isClient)                                                                             // 273
      self.getFileRecord();                                                                                       // 274
    // Call callback                                                                                              // 275
    callback(err, count);                                                                                         // 276
  });                                                                                                             // 277
};                                                                                                                // 278
                                                                                                                  // 279
/**                                                                                                               // 280
 * @method FS.File.prototype.remove                                                                               // 281
 * @public                                                                                                        // 282
 * @param {Function} [callback]                                                                                   // 283
 * @returns {number} Count                                                                                        // 284
 *                                                                                                                // 285
 * Remove the current file from its FS.Collection                                                                 // 286
 */                                                                                                               // 287
FS.File.prototype.remove = function(callback) {                                                                   // 288
  var self = this;                                                                                                // 289
                                                                                                                  // 290
  FS.debug && console.log('REMOVE: ' + self._id);                                                                 // 291
                                                                                                                  // 292
  callback = callback || FS.Utility.defaultCallback;                                                              // 293
                                                                                                                  // 294
  if (!self.isMounted()) {                                                                                        // 295
    callback(new Error("Cannot remove a file that is not associated with a collection"));                         // 296
    return;                                                                                                       // 297
  }                                                                                                               // 298
                                                                                                                  // 299
  return self.collection.files.remove({_id: self._id}, function(err, res) {                                       // 300
    if (!err) {                                                                                                   // 301
      delete self._id;                                                                                            // 302
      delete self.collection;                                                                                     // 303
      delete self.collectionName;                                                                                 // 304
    }                                                                                                             // 305
    callback(err, res);                                                                                           // 306
  });                                                                                                             // 307
};                                                                                                                // 308
                                                                                                                  // 309
/**                                                                                                               // 310
 * @method FS.File.prototype.moveTo                                                                               // 311
 * @param {FS.Collection} targetCollection                                                                        // 312
 * @private // Marked private until implemented                                                                   // 313
 * @todo Needs to be implemented                                                                                  // 314
 *                                                                                                                // 315
 * Move the file from current collection to another collection                                                    // 316
 *                                                                                                                // 317
 * > Note: Not yet implemented                                                                                    // 318
 */                                                                                                               // 319
                                                                                                                  // 320
/**                                                                                                               // 321
 * @method FS.File.prototype.getExtension Returns the lowercase file extension                                    // 322
 * @public                                                                                                        // 323
 * @deprecated Use the `extension` getter/setter method instead.                                                  // 324
 * @param {Object} [options]                                                                                      // 325
 * @param {String} [options.store] - Store name. Default is the original extension.                               // 326
 * @returns {string} The extension eg.: `jpg` or if not found then an empty string ''                             // 327
 */                                                                                                               // 328
FS.File.prototype.getExtension = function(options) {                                                              // 329
  var self = this;                                                                                                // 330
  return self.extension(options);                                                                                 // 331
};                                                                                                                // 332
                                                                                                                  // 333
function checkContentType(fsFile, storeName, startOfType) {                                                       // 334
  var type;                                                                                                       // 335
  if (storeName && fsFile.hasStored(storeName)) {                                                                 // 336
    type = fsFile.type({store: storeName});                                                                       // 337
  } else {                                                                                                        // 338
    type = fsFile.type();                                                                                         // 339
  }                                                                                                               // 340
  if (typeof type === "string") {                                                                                 // 341
    return type.indexOf(startOfType) === 0;                                                                       // 342
  }                                                                                                               // 343
  return false;                                                                                                   // 344
}                                                                                                                 // 345
                                                                                                                  // 346
/**                                                                                                               // 347
 * @method FS.File.prototype.isImage Is it an image file?                                                         // 348
 * @public                                                                                                        // 349
 * @param {object} [options]                                                                                      // 350
 * @param {string} [options.store] The store we're interested in                                                  // 351
 *                                                                                                                // 352
 * Returns true if the copy of this file in the specified store has an image                                      // 353
 * content type. If the file object is unmounted or doesn't have a copy for                                       // 354
 * the specified store, or if you don't specify a store, this method checks                                       // 355
 * the content type of the original file.                                                                         // 356
 */                                                                                                               // 357
FS.File.prototype.isImage = function(options) {                                                                   // 358
  return checkContentType(this, (options || {}).store, 'image/');                                                 // 359
};                                                                                                                // 360
                                                                                                                  // 361
/**                                                                                                               // 362
 * @method FS.File.prototype.isVideo Is it a video file?                                                          // 363
 * @public                                                                                                        // 364
 * @param {object} [options]                                                                                      // 365
 * @param {string} [options.store] The store we're interested in                                                  // 366
 *                                                                                                                // 367
 * Returns true if the copy of this file in the specified store has a video                                       // 368
 * content type. If the file object is unmounted or doesn't have a copy for                                       // 369
 * the specified store, or if you don't specify a store, this method checks                                       // 370
 * the content type of the original file.                                                                         // 371
 */                                                                                                               // 372
FS.File.prototype.isVideo = function(options) {                                                                   // 373
  return checkContentType(this, (options || {}).store, 'video/');                                                 // 374
};                                                                                                                // 375
                                                                                                                  // 376
/**                                                                                                               // 377
 * @method FS.File.prototype.isAudio Is it an audio file?                                                         // 378
 * @public                                                                                                        // 379
 * @param {object} [options]                                                                                      // 380
 * @param {string} [options.store] The store we're interested in                                                  // 381
 *                                                                                                                // 382
 * Returns true if the copy of this file in the specified store has an audio                                      // 383
 * content type. If the file object is unmounted or doesn't have a copy for                                       // 384
 * the specified store, or if you don't specify a store, this method checks                                       // 385
 * the content type of the original file.                                                                         // 386
 */                                                                                                               // 387
FS.File.prototype.isAudio = function(options) {                                                                   // 388
  return checkContentType(this, (options || {}).store, 'audio/');                                                 // 389
};                                                                                                                // 390
                                                                                                                  // 391
/**                                                                                                               // 392
 * @method FS.File.prototype.formattedSize                                                                        // 393
 * @public                                                                                                        // 394
 * @param  {Object} options                                                                                       // 395
 * @param  {String} [options.store=none,display original file size] Which file do you want to get the size of?    // 396
 * @param  {String} [options.formatString='0.00 b'] The `numeral` format string to use.                           // 397
 * @return {String} The file size formatted as a human readable string and reactively updated.                    // 398
 *                                                                                                                // 399
 * * You must add the `numeral` package to your app before you can use this method.                               // 400
 * * If info is not found or a size can't be determined, it will show 0.                                          // 401
 */                                                                                                               // 402
FS.File.prototype.formattedSize = function fsFileFormattedSize(options) {                                         // 403
  var self = this;                                                                                                // 404
                                                                                                                  // 405
  if (typeof numeral !== "function")                                                                              // 406
    throw new Error("You must add the numeral package if you call FS.File.formattedSize");                        // 407
                                                                                                                  // 408
  options = options || {};                                                                                        // 409
  options = options.hash || options;                                                                              // 410
                                                                                                                  // 411
  var size = self.size(options) || 0;                                                                             // 412
  return numeral(size).format(options.formatString || '0.00 b');                                                  // 413
};                                                                                                                // 414
                                                                                                                  // 415
/**                                                                                                               // 416
 * @method FS.File.prototype.isUploaded Is this file completely uploaded?                                         // 417
 * @public                                                                                                        // 418
 * @returns {boolean} True if the number of uploaded bytes is equal to the file size.                             // 419
 */                                                                                                               // 420
FS.File.prototype.isUploaded = function() {                                                                       // 421
  var self = this;                                                                                                // 422
                                                                                                                  // 423
  // Make sure we use the updated file record                                                                     // 424
  self.getFileRecord();                                                                                           // 425
                                                                                                                  // 426
  return !!self.uploadedAt;                                                                                       // 427
};                                                                                                                // 428
                                                                                                                  // 429
/**                                                                                                               // 430
 * @method FS.File.prototype.hasStored                                                                            // 431
 * @public                                                                                                        // 432
 * @param {string} storeName Name of the store                                                                    // 433
 * @param {boolean} [optimistic=false] In case that the file record is not found, read below                      // 434
 * @returns {boolean} Is a version of this file stored in the given store?                                        // 435
 *                                                                                                                // 436
 * > Note: If the file is not published to the client or simply not found:                                        // 437
 * this method cannot know for sure if it exists or not. The `optimistic`                                         // 438
 * param is the boolean value to return. Are we `optimistic` that the copy                                        // 439
 * could exist. This is the case in `FS.File.url` we are optimistic that the                                      // 440
 * copy supplied by the user exists.                                                                              // 441
 */                                                                                                               // 442
FS.File.prototype.hasStored = function(storeName, optimistic) {                                                   // 443
  var self = this;                                                                                                // 444
  // Make sure we use the updated file record                                                                     // 445
  self.getFileRecord();                                                                                           // 446
  // If we havent the published data then                                                                         // 447
  if (FS.Utility.isEmpty(self.copies)) {                                                                          // 448
    return !!optimistic;                                                                                          // 449
  }                                                                                                               // 450
  if (typeof storeName === "string") {                                                                            // 451
    // Return true only if the `key` property is present, which is not set until                                  // 452
    // storage is complete.                                                                                       // 453
    return !!(self.copies && self.copies[storeName] && self.copies[storeName].key);                               // 454
  }                                                                                                               // 455
  return false;                                                                                                   // 456
};                                                                                                                // 457
                                                                                                                  // 458
// Backwards compatibility                                                                                        // 459
FS.File.prototype.hasCopy = FS.File.prototype.hasStored;                                                          // 460
                                                                                                                  // 461
/**                                                                                                               // 462
 * @method FS.File.prototype.getCopyInfo                                                                          // 463
 * @public                                                                                                        // 464
 * @deprecated Use individual methods with `store` option instead.                                                // 465
 * @param {string} storeName Name of the store for which to get copy info.                                        // 466
 * @returns {Object} The file details, e.g., name, size, key, etc., specific to the copy saved in this store.     // 467
 */                                                                                                               // 468
FS.File.prototype.getCopyInfo = function(storeName) {                                                             // 469
  var self = this;                                                                                                // 470
  // Make sure we use the updated file record                                                                     // 471
  self.getFileRecord();                                                                                           // 472
  return (self.copies && self.copies[storeName]) || null;                                                         // 473
};                                                                                                                // 474
                                                                                                                  // 475
/**                                                                                                               // 476
 * @method FS.File.prototype._getInfo                                                                             // 477
 * @private                                                                                                       // 478
 * @param {String} [storeName] Name of the store for which to get file info. Omit for original file details.      // 479
 * @param {Object} [options]                                                                                      // 480
 * @param {Boolean} [options.updateFileRecordFirst=false] Update this instance with data from the DB first?       // 481
 * @returns {Object} The file details, e.g., name, size, key, etc. If not found, returns an empty object.         // 482
 */                                                                                                               // 483
FS.File.prototype._getInfo = function(storeName, options) {                                                       // 484
  var self = this;                                                                                                // 485
  options = options || {};                                                                                        // 486
                                                                                                                  // 487
  if (options.updateFileRecordFirst) {                                                                            // 488
    // Make sure we use the updated file record                                                                   // 489
    self.getFileRecord();                                                                                         // 490
  }                                                                                                               // 491
                                                                                                                  // 492
  if (storeName) {                                                                                                // 493
    return (self.copies && self.copies[storeName]) || {};                                                         // 494
  } else {                                                                                                        // 495
    return self.original || {};                                                                                   // 496
  }                                                                                                               // 497
};                                                                                                                // 498
                                                                                                                  // 499
/**                                                                                                               // 500
 * @method FS.File.prototype._setInfo                                                                             // 501
 * @private                                                                                                       // 502
 * @param {String} storeName - Name of the store for which to set file info. Non-string will set original file details.
 * @param {String} property - Property to set                                                                     // 504
 * @param {String} value - New value for property                                                                 // 505
 * @returns {undefined}                                                                                           // 506
 */                                                                                                               // 507
FS.File.prototype._setInfo = function(storeName, property, value) {                                               // 508
  var self = this;                                                                                                // 509
  if (typeof storeName === "string") {                                                                            // 510
    self.copies = self.copies || {};                                                                              // 511
    self.copies[storeName] = self.copies[storeName] || {};                                                        // 512
    self.copies[storeName][property] = value;                                                                     // 513
  } else {                                                                                                        // 514
    self.original = self.original || {};                                                                          // 515
    self.original[property] = value;                                                                              // 516
  }                                                                                                               // 517
};                                                                                                                // 518
                                                                                                                  // 519
/**                                                                                                               // 520
 * @method FS.File.prototype.name                                                                                 // 521
 * @public                                                                                                        // 522
 * @param {String|null} [value] - If setting the name, specify the new name as the first argument. Otherwise the options argument should be first.
 * @param {Object} [options]                                                                                      // 524
 * @param {Object} [options.store=none,original] - Get or set the name of the version of the file that was saved in this store. Default is the original file name.
 * @param {Boolean} [options.updateFileRecordFirst=false] Update this instance with data from the DB first? Applies to getter usage only.
 * @returns {String|undefined} If setting, returns `undefined`. If getting, returns the file name.                // 527
 */                                                                                                               // 528
FS.File.prototype.name = function(value, options) {                                                               // 529
  var self = this;                                                                                                // 530
                                                                                                                  // 531
  if (!options && ((typeof value === "object" && value !== null) || typeof value === "undefined")) {              // 532
    // GET                                                                                                        // 533
    options = value || {};                                                                                        // 534
    options = options.hash || options; // allow use as UI helper                                                  // 535
    return self._getInfo(options.store, options).name;                                                            // 536
  } else {                                                                                                        // 537
    // SET                                                                                                        // 538
    options = options || {};                                                                                      // 539
    return self._setInfo(options.store, 'name', value);                                                           // 540
  }                                                                                                               // 541
};                                                                                                                // 542
                                                                                                                  // 543
/**                                                                                                               // 544
 * @method FS.File.prototype.extension                                                                            // 545
 * @public                                                                                                        // 546
 * @param {String|null} [value] - If setting the extension, specify the new extension (without period) as the first argument. Otherwise the options argument should be first.
 * @param {Object} [options]                                                                                      // 548
 * @param {Object} [options.store=none,original] - Get or set the extension of the version of the file that was saved in this store. Default is the original file extension.
 * @param {Boolean} [options.updateFileRecordFirst=false] Update this instance with data from the DB first? Applies to getter usage only.
 * @returns {String|undefined} If setting, returns `undefined`. If getting, returns the file extension or an empty string if there isn't one.
 */                                                                                                               // 552
FS.File.prototype.extension = function(value, options) {                                                          // 553
  var self = this;                                                                                                // 554
                                                                                                                  // 555
  if (!options && ((typeof value === "object" && value !== null) || typeof value === "undefined")) {              // 556
    // GET                                                                                                        // 557
    options = value || {};                                                                                        // 558
    return FS.Utility.getFileExtension(self.name(options) || '');                                                 // 559
  } else {                                                                                                        // 560
    // SET                                                                                                        // 561
    options = options || {};                                                                                      // 562
    var newName = FS.Utility.setFileExtension(self.name(options) || '', value);                                   // 563
    return self._setInfo(options.store, 'name', newName);                                                         // 564
  }                                                                                                               // 565
};                                                                                                                // 566
                                                                                                                  // 567
/**                                                                                                               // 568
 * @method FS.File.prototype.size                                                                                 // 569
 * @public                                                                                                        // 570
 * @param {Number} [value] - If setting the size, specify the new size in bytes as the first argument. Otherwise the options argument should be first.
 * @param {Object} [options]                                                                                      // 572
 * @param {Object} [options.store=none,original] - Get or set the size of the version of the file that was saved in this store. Default is the original file size.
 * @param {Boolean} [options.updateFileRecordFirst=false] Update this instance with data from the DB first? Applies to getter usage only.
 * @returns {Number|undefined} If setting, returns `undefined`. If getting, returns the file size.                // 575
 */                                                                                                               // 576
FS.File.prototype.size = function(value, options) {                                                               // 577
  var self = this;                                                                                                // 578
                                                                                                                  // 579
  if (!options && ((typeof value === "object" && value !== null) || typeof value === "undefined")) {              // 580
    // GET                                                                                                        // 581
    options = value || {};                                                                                        // 582
    options = options.hash || options; // allow use as UI helper                                                  // 583
    return self._getInfo(options.store, options).size;                                                            // 584
  } else {                                                                                                        // 585
    // SET                                                                                                        // 586
    options = options || {};                                                                                      // 587
    return self._setInfo(options.store, 'size', value);                                                           // 588
  }                                                                                                               // 589
};                                                                                                                // 590
                                                                                                                  // 591
/**                                                                                                               // 592
 * @method FS.File.prototype.type                                                                                 // 593
 * @public                                                                                                        // 594
 * @param {String} [value] - If setting the type, specify the new type as the first argument. Otherwise the options argument should be first.
 * @param {Object} [options]                                                                                      // 596
 * @param {Object} [options.store=none,original] - Get or set the type of the version of the file that was saved in this store. Default is the original file type.
 * @param {Boolean} [options.updateFileRecordFirst=false] Update this instance with data from the DB first? Applies to getter usage only.
 * @returns {String|undefined} If setting, returns `undefined`. If getting, returns the file type.                // 599
 */                                                                                                               // 600
FS.File.prototype.type = function(value, options) {                                                               // 601
  var self = this;                                                                                                // 602
                                                                                                                  // 603
  if (!options && ((typeof value === "object" && value !== null) || typeof value === "undefined")) {              // 604
    // GET                                                                                                        // 605
    options = value || {};                                                                                        // 606
    options = options.hash || options; // allow use as UI helper                                                  // 607
    return self._getInfo(options.store, options).type;                                                            // 608
  } else {                                                                                                        // 609
    // SET                                                                                                        // 610
    options = options || {};                                                                                      // 611
    return self._setInfo(options.store, 'type', value);                                                           // 612
  }                                                                                                               // 613
};                                                                                                                // 614
                                                                                                                  // 615
/**                                                                                                               // 616
 * @method FS.File.prototype.updatedAt                                                                            // 617
 * @public                                                                                                        // 618
 * @param {String} [value] - If setting updatedAt, specify the new date as the first argument. Otherwise the options argument should be first.
 * @param {Object} [options]                                                                                      // 620
 * @param {Object} [options.store=none,original] - Get or set the last updated date for the version of the file that was saved in this store. Default is the original last updated date.
 * @param {Boolean} [options.updateFileRecordFirst=false] Update this instance with data from the DB first? Applies to getter usage only.
 * @returns {String|undefined} If setting, returns `undefined`. If getting, returns the file's last updated date. // 623
 */                                                                                                               // 624
FS.File.prototype.updatedAt = function(value, options) {                                                          // 625
  var self = this;                                                                                                // 626
                                                                                                                  // 627
  if (!options && ((typeof value === "object" && value !== null && !(value instanceof Date)) || typeof value === "undefined")) {
    // GET                                                                                                        // 629
    options = value || {};                                                                                        // 630
    options = options.hash || options; // allow use as UI helper                                                  // 631
    return self._getInfo(options.store, options).updatedAt;                                                       // 632
  } else {                                                                                                        // 633
    // SET                                                                                                        // 634
    options = options || {};                                                                                      // 635
    return self._setInfo(options.store, 'updatedAt', value);                                                      // 636
  }                                                                                                               // 637
};                                                                                                                // 638
                                                                                                                  // 639
function isBasicObject(obj) {                                                                                     // 640
  return (obj === Object(obj) && Object.getPrototypeOf(obj) === Object.prototype);                                // 641
}                                                                                                                 // 642
                                                                                                                  // 643
// getPrototypeOf polyfill                                                                                        // 644
if (typeof Object.getPrototypeOf !== "function") {                                                                // 645
  if (typeof "".__proto__ === "object") {                                                                         // 646
    Object.getPrototypeOf = function(object) {                                                                    // 647
      return object.__proto__;                                                                                    // 648
    };                                                                                                            // 649
  } else {                                                                                                        // 650
    Object.getPrototypeOf = function(object) {                                                                    // 651
      // May break if the constructor has been tampered with                                                      // 652
      return object.constructor.prototype;                                                                        // 653
    };                                                                                                            // 654
  }                                                                                                               // 655
}                                                                                                                 // 656
                                                                                                                  // 657
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/cfs-file/fsFile-server.js                                                                             //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
/**                                                                                                               // 1
 * Notes a details about a storage adapter failure within the file record                                         // 2
 * @param {string} storeName                                                                                      // 3
 * @param {number} maxTries                                                                                       // 4
 * @return {undefined}                                                                                            // 5
 * @todo deprecate this                                                                                           // 6
 */                                                                                                               // 7
FS.File.prototype.logCopyFailure = function(storeName, maxTries) {                                                // 8
  var self = this;                                                                                                // 9
                                                                                                                  // 10
  // hasStored will update from the fileRecord                                                                    // 11
  if (self.hasStored(storeName)) {                                                                                // 12
    throw new Error("logCopyFailure: invalid storeName");                                                         // 13
  }                                                                                                               // 14
                                                                                                                  // 15
  // Make sure we have a temporary file saved since we will be                                                    // 16
  // trying the save again.                                                                                       // 17
  FS.TempStore.ensureForFile(self);                                                                               // 18
                                                                                                                  // 19
  var now = new Date;                                                                                             // 20
  var currentCount = (self.failures && self.failures.copies && self.failures.copies[storeName] && typeof self.failures.copies[storeName].count === "number") ? self.failures.copies[storeName].count : 0;
  maxTries = maxTries || 5;                                                                                       // 22
                                                                                                                  // 23
  var modifier = {};                                                                                              // 24
  modifier.$set = {};                                                                                             // 25
  modifier.$set['failures.copies.' + storeName + '.lastAttempt'] = now;                                           // 26
  if (currentCount === 0) {                                                                                       // 27
    modifier.$set['failures.copies.' + storeName + '.firstAttempt'] = now;                                        // 28
  }                                                                                                               // 29
  modifier.$set['failures.copies.' + storeName + '.count'] = currentCount + 1;                                    // 30
  modifier.$set['failures.copies.' + storeName + '.doneTrying'] = (currentCount + 1 >= maxTries);                 // 31
  self.update(modifier);                                                                                          // 32
};                                                                                                                // 33
                                                                                                                  // 34
/**                                                                                                               // 35
 * Has this store permanently failed?                                                                             // 36
 * @param {String} storeName The name of the store                                                                // 37
 * @return {boolean} Has this store failed permanently?                                                           // 38
 * @todo deprecate this                                                                                           // 39
 */                                                                                                               // 40
FS.File.prototype.failedPermanently = function(storeName) {                                                       // 41
  var self = this;                                                                                                // 42
  return !!(self.failures                                                                                         // 43
          && self.failures.copies                                                                                 // 44
          && self.failures.copies[storeName]                                                                      // 45
          && self.failures.copies[storeName].doneTrying);                                                         // 46
};                                                                                                                // 47
                                                                                                                  // 48
/**                                                                                                               // 49
 * @method FS.File.prototype.createReadStream                                                                     // 50
 * @public                                                                                                        // 51
 * @param {String} [storeName]                                                                                    // 52
 * @returns {stream.Readable} Readable NodeJS stream                                                              // 53
 *                                                                                                                // 54
 * Returns a readable stream. Where the stream reads from depends on the FS.File instance and whether you pass a store name.
 *                                                                                                                // 56
 * * If you pass a `storeName`, a readable stream for the file data saved in that store is returned.              // 57
 * * If you don't pass a `storeName` and data is attached to the FS.File instance (on `data` property, which must be a DataMan instance), then a readable stream for the attached data is returned.
 * * If you don't pass a `storeName` and there is no data attached to the FS.File instance, a readable stream for the file data currently in the temporary store (`FS.TempStore`) is returned.
 *                                                                                                                // 60
 */                                                                                                               // 61
FS.File.prototype.createReadStream = function(storeName) {                                                        // 62
  var self = this;                                                                                                // 63
                                                                                                                  // 64
  // If we dont have a store name but got Buffer data?                                                            // 65
  if (!storeName && self.data) {                                                                                  // 66
    FS.debug && console.log("fileObj.createReadStream creating read stream for attached data");                   // 67
    // Stream from attached data if present                                                                       // 68
    return self.data.createReadStream();                                                                          // 69
  } else if (!storeName && FS.TempStore && FS.TempStore.exists(self)) {                                           // 70
    FS.debug && console.log("fileObj.createReadStream creating read stream for temp store");                      // 71
    // Stream from temp store - its a bit slower than regular streams?                                            // 72
    return FS.TempStore.createReadStream(self);                                                                   // 73
  } else {                                                                                                        // 74
    // Stream from the store using storage adapter                                                                // 75
    if (self.isMounted()) {                                                                                       // 76
      var storage = self.collection.storesLookup[storeName] || self.collection.primaryStore;                      // 77
      FS.debug && console.log("fileObj.createReadStream creating read stream for store", storage.name);           // 78
      // return stream                                                                                            // 79
      return storage.adapter.createReadStream(self);                                                              // 80
    } else {                                                                                                      // 81
      throw new Meteor.Error('File not mounted');                                                                 // 82
    }                                                                                                             // 83
                                                                                                                  // 84
  }                                                                                                               // 85
};                                                                                                                // 86
                                                                                                                  // 87
/**                                                                                                               // 88
 * @method FS.File.prototype.createWriteStream                                                                    // 89
 * @public                                                                                                        // 90
 * @param {String} [storeName]                                                                                    // 91
 * @returns {stream.Writeable} Writeable NodeJS stream                                                            // 92
 *                                                                                                                // 93
 * Returns a writeable stream. Where the stream writes to depends on whether you pass in a store name.            // 94
 *                                                                                                                // 95
 * * If you pass a `storeName`, a writeable stream for (over)writing the file data in that store is returned.     // 96
 * * If you don't pass a `storeName`, a writeable stream for writing to the temp store for this file is returned. // 97
 *                                                                                                                // 98
 */                                                                                                               // 99
FS.File.prototype.createWriteStream = function(storeName) {                                                       // 100
  var self = this;                                                                                                // 101
                                                                                                                  // 102
  // We have to have a mounted file in order for this to work                                                     // 103
  if (self.isMounted()) {                                                                                         // 104
    if (!storeName && FS.TempStore && FS.FileWorker) {                                                            // 105
      // If we have worker installed - we pass the file to FS.TempStore                                           // 106
      // We dont need the storeName since all stores will be generated from                                       // 107
      // TempStore.                                                                                               // 108
      // This should trigger FS.FileWorker at some point?                                                         // 109
      FS.TempStore.createWriteStream(self);                                                                       // 110
    } else {                                                                                                      // 111
      // Stream directly to the store using storage adapter                                                       // 112
      var storage = self.collection.storesLookup[storeName] || self.collection.primaryStore;                      // 113
      return storage.adapter.createWriteStream(self);                                                             // 114
    }                                                                                                             // 115
  } else {                                                                                                        // 116
    throw new Meteor.Error('File not mounted');                                                                   // 117
  }                                                                                                               // 118
};                                                                                                                // 119
                                                                                                                  // 120
Meteor.methods({                                                                                                  // 121
  // Does a HEAD request to URL to get the type, updatedAt, and size prior to actually downloading the data.      // 122
  // That way we can do filter checks without actually downloading.                                               // 123
  '_cfs_getUrlInfo': function (url, options) {                                                                    // 124
    this.unblock();                                                                                               // 125
                                                                                                                  // 126
    var response = HTTP.call("HEAD", url, options);                                                               // 127
    var headers = response.headers;                                                                               // 128
    var result = {};                                                                                              // 129
                                                                                                                  // 130
    if (headers['content-type']) {                                                                                // 131
      result.type = headers['content-type'];                                                                      // 132
    }                                                                                                             // 133
                                                                                                                  // 134
    if (headers['content-length']) {                                                                              // 135
      result.size = +headers['content-length'];                                                                   // 136
    }                                                                                                             // 137
                                                                                                                  // 138
    if (headers['last-modified']) {                                                                               // 139
      result.updatedAt = new Date(headers['last-modified']);                                                      // 140
    }                                                                                                             // 141
                                                                                                                  // 142
    return result;                                                                                                // 143
  }                                                                                                               // 144
});                                                                                                               // 145
                                                                                                                  // 146
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['cfs-file'] = {};

})();

(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;
var _ = Package.underscore._;
var EJSON = Package.ejson.EJSON;
var Random = Package.random.Random;
var HTTP = Package['http-methods'].HTTP;

/* Package-scope variables */
var _publishHTTP;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                 //
// packages/http-publish/http.publish.server.api.js                                                                //
//                                                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                   //
/*                                                                                                                 // 1
                                                                                                                   // 2
GET /note                                                                                                          // 3
GET /note/:id                                                                                                      // 4
POST /note                                                                                                         // 5
PUT /note/:id                                                                                                      // 6
DELETE /note/:id                                                                                                   // 7
                                                                                                                   // 8
*/                                                                                                                 // 9
                                                                                                                   // 10
// Could be cool if we could serve some api doc or even an api script                                              // 11
// user could do <script href="/note/api?token=1&user=2"></script> and be served                                   // 12
// a client-side javascript api?                                                                                   // 13
// Eg.                                                                                                             // 14
// HTTP.api.note.create();                                                                                         // 15
// HTTP.api.login(username, password);                                                                             // 16
// HTTP.api.logout                                                                                                 // 17
                                                                                                                   // 18
                                                                                                                   // 19
_publishHTTP = {};                                                                                                 // 20
                                                                                                                   // 21
// Cache the names of all http methods we've published                                                             // 22
_publishHTTP.currentlyPublished = [];                                                                              // 23
                                                                                                                   // 24
var defaultAPIPrefix = '/api/';                                                                                    // 25
                                                                                                                   // 26
/**                                                                                                                // 27
 * @method _publishHTTP.getPublishScope                                                                            // 28
 * @private                                                                                                        // 29
 * @param {Object} scope                                                                                           // 30
 * @returns {httpPublishGetPublishScope.publishScope}                                                              // 31
 *                                                                                                                 // 32
 * Creates a nice scope for the publish method                                                                     // 33
 */                                                                                                                // 34
_publishHTTP.getPublishScope = function httpPublishGetPublishScope(scope) {                                        // 35
  var publishScope = {};                                                                                           // 36
  publishScope.userId = scope.userId;                                                                              // 37
  publishScope.params = scope.params;                                                                              // 38
  publishScope.query = scope.query;                                                                                // 39
  // TODO: Additional scoping                                                                                      // 40
  // publishScope.added                                                                                            // 41
  // publishScope.ready                                                                                            // 42
  return publishScope;                                                                                             // 43
};                                                                                                                 // 44
                                                                                                                   // 45
_publishHTTP.formatHandlers = {};                                                                                  // 46
                                                                                                                   // 47
/**                                                                                                                // 48
 * @method _publishHTTP.formatHandlers.json                                                                        // 49
 * @private                                                                                                        // 50
 * @param {Object} result - The result object                                                                      // 51
 * @returns {String} JSON                                                                                          // 52
 *                                                                                                                 // 53
 * Formats the output into JSON and sets the appropriate content type on `this`                                    // 54
 */                                                                                                                // 55
_publishHTTP.formatHandlers.json = function httpPublishJSONFormatHandler(result) {                                 // 56
  // Set the method scope content type to json                                                                     // 57
  this.setContentType('application/json');                                                                         // 58
  // Return EJSON string                                                                                           // 59
  return EJSON.stringify(result);                                                                                  // 60
};                                                                                                                 // 61
                                                                                                                   // 62
/**                                                                                                                // 63
 * @method _publishHTTP.formatResult                                                                               // 64
 * @private                                                                                                        // 65
 * @param {Object} result - The result object                                                                      // 66
 * @param {Object} scope                                                                                           // 67
 * @param {String} [defaultFormat='json'] - Default format to use if format is not in query string.                // 68
 * @returns {Any} The formatted result                                                                             // 69
 *                                                                                                                 // 70
 * Formats the result into the format selected by querystring eg. "&format=json"                                   // 71
 */                                                                                                                // 72
_publishHTTP.formatResult = function httpPublishFormatResult(result, scope, defaultFormat) {                       // 73
                                                                                                                   // 74
  // Get the format in lower case and default to json                                                              // 75
  var format = scope && scope.query && scope.query.format || defaultFormat || 'json';                              // 76
                                                                                                                   // 77
  // Set the format handler found                                                                                  // 78
  var formatHandlerFound = !!(typeof _publishHTTP.formatHandlers[format] === 'function');                          // 79
                                                                                                                   // 80
  // Set the format handler and fallback to default json if handler not found                                      // 81
  var formatHandler = _publishHTTP.formatHandlers[(formatHandlerFound) ? format : 'json'];                         // 82
                                                                                                                   // 83
  // Check if format handler is a function                                                                         // 84
  if (typeof formatHandler !== 'function') {                                                                       // 85
    // We break things the user could have overwritten the default json handler                                    // 86
    throw new Error('The default json format handler not found');                                                  // 87
  }                                                                                                                // 88
                                                                                                                   // 89
  if (!formatHandlerFound) {                                                                                       // 90
    scope.setStatusCode(500);                                                                                      // 91
    return '{"error":"Format handler for: `' + format + '` not found"}';                                           // 92
  }                                                                                                                // 93
                                                                                                                   // 94
  // Execute the format handler                                                                                    // 95
  try {                                                                                                            // 96
    return formatHandler.apply(scope, [result]);                                                                   // 97
  } catch(err) {                                                                                                   // 98
    scope.setStatusCode(500);                                                                                      // 99
    return '{"error":"Format handler for: `' + format + '` Error: ' + err.message + '"}';                          // 100
  }                                                                                                                // 101
};                                                                                                                 // 102
                                                                                                                   // 103
/**                                                                                                                // 104
 * @method _publishHTTP.error                                                                                      // 105
 * @private                                                                                                        // 106
 * @param {String} statusCode - The status code                                                                    // 107
 * @param {String} message - The message                                                                           // 108
 * @param {Object} scope                                                                                           // 109
 * @returns {Any} The formatted result                                                                             // 110
 *                                                                                                                 // 111
 * Responds with error message in the expected format                                                              // 112
 */                                                                                                                // 113
_publishHTTP.error = function httpPublishError(statusCode, message, scope) {                                       // 114
  var result = _publishHTTP.formatResult(message, scope);                                                          // 115
  scope.setStatusCode(statusCode);                                                                                 // 116
  return result;                                                                                                   // 117
};                                                                                                                 // 118
                                                                                                                   // 119
/**                                                                                                                // 120
 * @method _publishHTTP.getMethodHandler                                                                           // 121
 * @private                                                                                                        // 122
 * @param {Meteor.Collection} collection - The Meteor.Collection instance                                          // 123
 * @param {String} methodName - The method name                                                                    // 124
 * @returns {Function} The server method                                                                           // 125
 *                                                                                                                 // 126
 * Returns the DDP connection handler, already setup and secured                                                   // 127
 */                                                                                                                // 128
_publishHTTP.getMethodHandler = function httpPublishGetMethodHandler(collection, methodName) {                     // 129
  if (collection instanceof Meteor.Collection) {                                                                   // 130
    if (collection._connection && collection._connection.method_handlers) {                                        // 131
      return collection._connection.method_handlers[collection._prefix + methodName];                              // 132
    } else {                                                                                                       // 133
      throw new Error('HTTP publish does not work with current version of Meteor');                                // 134
    }                                                                                                              // 135
  } else {                                                                                                         // 136
    throw new Error('_publishHTTP.getMethodHandler expected a collection');                                        // 137
  }                                                                                                                // 138
};                                                                                                                 // 139
                                                                                                                   // 140
/**                                                                                                                // 141
 * @method _publishHTTP.unpublishList                                                                              // 142
 * @private                                                                                                        // 143
 * @param {Array} names - List of method names to unpublish                                                        // 144
 * @returns {undefined}                                                                                            // 145
 *                                                                                                                 // 146
 * Unpublishes all HTTP methods that have names matching the given list.                                           // 147
 */                                                                                                                // 148
_publishHTTP.unpublishList = function httpPublishUnpublishList(names) {                                            // 149
  if (!names.length) {                                                                                             // 150
    return;                                                                                                        // 151
  }                                                                                                                // 152
                                                                                                                   // 153
  // Carry object for methods                                                                                      // 154
  var methods = {};                                                                                                // 155
                                                                                                                   // 156
  // Unpublish the rest points by setting them to false                                                            // 157
  for (var i = 0, ln = names.length; i < ln; i++) {                                                                // 158
    methods[names[i]] = false;                                                                                     // 159
  }                                                                                                                // 160
                                                                                                                   // 161
  HTTP.methods(methods);                                                                                           // 162
                                                                                                                   // 163
  // Remove the names from our list of currently published methods                                                 // 164
  _publishHTTP.currentlyPublished = _.difference(_publishHTTP.currentlyPublished, names);                          // 165
};                                                                                                                 // 166
                                                                                                                   // 167
/**                                                                                                                // 168
 * @method _publishHTTP.unpublish                                                                                  // 169
 * @private                                                                                                        // 170
 * @param {String|Meteor.Collection} [name] - The method name or collection                                        // 171
 * @returns {undefined}                                                                                            // 172
 *                                                                                                                 // 173
 * Unpublishes all HTTP methods that were published with the given name or                                         // 174
 * for the given collection. Call with no arguments to unpublish all.                                              // 175
 */                                                                                                                // 176
_publishHTTP.unpublish = function httpPublishUnpublish(/* name or collection, options */) {                        // 177
                                                                                                                   // 178
  // Determine what method name we're unpublishing                                                                 // 179
  var name = (arguments[0] instanceof Meteor.Collection) ?                                                         // 180
          defaultAPIPrefix + arguments[0]._name : arguments[0];                                                    // 181
                                                                                                                   // 182
  // Unpublish name and name/id                                                                                    // 183
  if (name && name.length) {                                                                                       // 184
    _publishHTTP.unpublishList([name, name + '/:id']);                                                             // 185
  }                                                                                                                // 186
                                                                                                                   // 187
  // If no args, unpublish all                                                                                     // 188
  else {                                                                                                           // 189
    _publishHTTP.unpublishList(_publishHTTP.currentlyPublished);                                                   // 190
  }                                                                                                                // 191
                                                                                                                   // 192
};                                                                                                                 // 193
                                                                                                                   // 194
/**                                                                                                                // 195
 * @method HTTP.publishFormats                                                                                     // 196
 * @public                                                                                                         // 197
 * @param {Object} newHandlers                                                                                     // 198
 * @returns {undefined}                                                                                            // 199
 *                                                                                                                 // 200
 * Add publish formats. Example:                                                                                   // 201
 ```js                                                                                                             // 202
 HTTP.publishFormats({                                                                                             // 203
                                                                                                                   // 204
    json: function(inputObject) {                                                                                  // 205
      // Set the method scope content type to json                                                                 // 206
      this.setContentType('application/json');                                                                     // 207
      // Return EJSON string                                                                                       // 208
      return EJSON.stringify(inputObject);                                                                         // 209
    }                                                                                                              // 210
                                                                                                                   // 211
  });                                                                                                              // 212
 ```                                                                                                               // 213
 */                                                                                                                // 214
HTTP.publishFormats = function httpPublishFormats(newHandlers) {                                                   // 215
  _.extend(_publishHTTP.formatHandlers, newHandlers);                                                              // 216
};                                                                                                                 // 217
                                                                                                                   // 218
/**                                                                                                                // 219
 * @method HTTP.publish                                                                                            // 220
 * @public                                                                                                         // 221
 * @param {Object} options                                                                                         // 222
 * @param {String} [name] - Restpoint name (url prefix). Optional if `collection` is passed. Will mount on `/api/collectionName` by default.
 * @param {Meteor.Collection} [collection] - Meteor.Collection instance. Required for all restpoints except collectionGet
 * @param {String} [options.defaultFormat='json'] - Format to use for responses when `format` is not found in the query string.
 * @param {String} [options.collectionGet=true] - Add GET restpoint for collection? Requires a publish function.   // 226
 * @param {String} [options.collectionPost=true] - Add POST restpoint for adding documents to the collection?      // 227
 * @param {String} [options.documentGet=true] - Add GET restpoint for documents in collection? Requires a publish function.
 * @param {String} [options.documentPut=true] - Add PUT restpoint for updating a document in the collection?       // 229
 * @param {String} [options.documentDelete=true] - Add DELETE restpoint for deleting a document in the collection? // 230
 * @param {Function} [publishFunc] - A publish function. Required to mount GET restpoints.                         // 231
 * @returns {undefined}                                                                                            // 232
 * @todo this should use options argument instead of optional args                                                 // 233
 *                                                                                                                 // 234
 * Publishes one or more restpoints, mounted on "name" ("/api/collectionName/"                                     // 235
 * by default). The GET restpoints are subscribed to the document set (cursor)                                     // 236
 * returned by the publish function you supply. The other restpoints forward                                       // 237
 * requests to Meteor's built-in DDP methods (insert, update, remove), meaning                                     // 238
 * that full allow/deny security is automatic.                                                                     // 239
 *                                                                                                                 // 240
 * __Usage:__                                                                                                      // 241
 *                                                                                                                 // 242
 * Publish only:                                                                                                   // 243
 *                                                                                                                 // 244
 * HTTP.publish({name: 'mypublish'}, publishFunc);                                                                 // 245
 *                                                                                                                 // 246
 * Publish and mount crud rest point for collection /api/myCollection:                                             // 247
 *                                                                                                                 // 248
 * HTTP.publish({collection: myCollection}, publishFunc);                                                          // 249
 *                                                                                                                 // 250
 * Mount CUD rest point for collection and documents without GET:                                                  // 251
 *                                                                                                                 // 252
 * HTTP.publish({collection: myCollection});                                                                       // 253
 *                                                                                                                 // 254
 */                                                                                                                // 255
HTTP.publish = function httpPublish(options, publishFunc) {                                                        // 256
  options = _.extend({                                                                                             // 257
    name: null,                                                                                                    // 258
    collection: null,                                                                                              // 259
    defaultFormat: null,                                                                                           // 260
    collectionGet: true,                                                                                           // 261
    collectionPost: true,                                                                                          // 262
    documentGet: true,                                                                                             // 263
    documentPut: true,                                                                                             // 264
    documentDelete: true                                                                                           // 265
  }, options || {});                                                                                               // 266
                                                                                                                   // 267
  var collection = options.collection;                                                                             // 268
                                                                                                                   // 269
  // Use provided name or build one                                                                                // 270
  var name = (typeof options.name === "string") ? options.name : defaultAPIPrefix + collection._name;              // 271
                                                                                                                   // 272
  // Make sure we have a name                                                                                      // 273
  if (typeof name !== "string") {                                                                                  // 274
    throw new Error('HTTP.publish expected a collection or name option');                                          // 275
  }                                                                                                                // 276
                                                                                                                   // 277
  var defaultFormat = options.defaultFormat;                                                                       // 278
                                                                                                                   // 279
  // Rig the methods for the CRUD interface                                                                        // 280
  var methods = {};                                                                                                // 281
                                                                                                                   // 282
  // console.log('HTTP restpoint: ' + name);                                                                       // 283
                                                                                                                   // 284
  // list and create                                                                                               // 285
  methods[name] = {};                                                                                              // 286
                                                                                                                   // 287
  if (options.collectionGet && publishFunc) {                                                                      // 288
    // Return the published documents                                                                              // 289
    methods[name].get = function(data) {                                                                           // 290
      // Format the scope for the publish method                                                                   // 291
      var publishScope = _publishHTTP.getPublishScope(this);                                                       // 292
      // Get the publish cursor                                                                                    // 293
      var cursor = publishFunc.apply(publishScope, [data]);                                                        // 294
                                                                                                                   // 295
      // Check if its a cursor                                                                                     // 296
      if (cursor && cursor.fetch) {                                                                                // 297
        // Fetch the data fron cursor                                                                              // 298
        var result = cursor.fetch();                                                                               // 299
        // Return the data                                                                                         // 300
        return _publishHTTP.formatResult(result, this, defaultFormat);                                             // 301
      } else {                                                                                                     // 302
        // We didnt get any                                                                                        // 303
        return _publishHTTP.error(200, [], this);                                                                  // 304
      }                                                                                                            // 305
    };                                                                                                             // 306
  }                                                                                                                // 307
                                                                                                                   // 308
  if (collection) {                                                                                                // 309
    // If we have a collection then add insert method                                                              // 310
    if (options.collectionPost) {                                                                                  // 311
      methods[name].post = function(data) {                                                                        // 312
        var insertMethodHandler = _publishHTTP.getMethodHandler(collection, 'insert');                             // 313
        // Make sure that _id isset else create a Meteor id                                                        // 314
        data._id = data._id || Random.id();                                                                        // 315
        // Create the document                                                                                     // 316
        try {                                                                                                      // 317
          // We should be passed a document in data                                                                // 318
          insertMethodHandler.apply(this, [data]);                                                                 // 319
          // Return the data                                                                                       // 320
          return _publishHTTP.formatResult({ _id: data._id }, this, defaultFormat);                                // 321
        } catch(err) {                                                                                             // 322
          // This would be a Meteor.error?                                                                         // 323
          return _publishHTTP.error(err.error, { error: err.message }, this);                                      // 324
        }                                                                                                          // 325
      };                                                                                                           // 326
    }                                                                                                              // 327
                                                                                                                   // 328
    // We also add the findOne, update and remove methods                                                          // 329
    methods[name + '/:id'] = {};                                                                                   // 330
                                                                                                                   // 331
    if (options.documentGet && publishFunc) {                                                                      // 332
      // We have to have a publish method inorder to publish id? The user could                                    // 333
      // just write a publish all if needed - better to make this explicit                                         // 334
      methods[name + '/:id'].get = function(data) {                                                                // 335
        // Get the mongoId                                                                                         // 336
        var mongoId = this.params.id;                                                                              // 337
                                                                                                                   // 338
        // We would allways expect a string but it could be empty                                                  // 339
        if (mongoId !== '') {                                                                                      // 340
                                                                                                                   // 341
          // Format the scope for the publish method                                                               // 342
          var publishScope = _publishHTTP.getPublishScope(this);                                                   // 343
                                                                                                                   // 344
          // Get the publish cursor                                                                                // 345
          var cursor = publishFunc.apply(publishScope, [data]);                                                    // 346
                                                                                                                   // 347
          // Result will contain the document if found                                                             // 348
          var result;                                                                                              // 349
                                                                                                                   // 350
          // Check to see if document is in published cursor                                                       // 351
          cursor.forEach(function(doc) {                                                                           // 352
            if (!result) {                                                                                         // 353
              if (doc._id === mongoId) {                                                                           // 354
                result = doc;                                                                                      // 355
              }                                                                                                    // 356
            }                                                                                                      // 357
          });                                                                                                      // 358
                                                                                                                   // 359
          // If the document is found the return                                                                   // 360
          if (result) {                                                                                            // 361
            return _publishHTTP.formatResult(result, this, defaultFormat);                                         // 362
          } else {                                                                                                 // 363
            // We do a check to see if the doc id exists                                                           // 364
            var exists = collection.findOne({ _id: mongoId });                                                     // 365
            // If it exists its not published to the user                                                          // 366
            if (exists) {                                                                                          // 367
              // Unauthorized                                                                                      // 368
              return _publishHTTP.error(401, { error: 'Unauthorized' }, this);                                     // 369
            } else {                                                                                               // 370
              // Not found                                                                                         // 371
              return _publishHTTP.error(404, { error: 'Document with id ' + mongoId + ' not found' }, this);       // 372
            }                                                                                                      // 373
          }                                                                                                        // 374
                                                                                                                   // 375
        } else {                                                                                                   // 376
          return _publishHTTP.error(400, { error: 'Method expected a document id' }, this);                        // 377
        }                                                                                                          // 378
      };                                                                                                           // 379
    }                                                                                                              // 380
                                                                                                                   // 381
    if (options.documentPut) {                                                                                     // 382
      methods[name + '/:id'].put = function(data) {                                                                // 383
        // Get the mongoId                                                                                         // 384
        var mongoId = this.params.id;                                                                              // 385
                                                                                                                   // 386
        // We would allways expect a string but it could be empty                                                  // 387
        if (mongoId !== '') {                                                                                      // 388
                                                                                                                   // 389
          var updateMethodHandler = _publishHTTP.getMethodHandler(collection, 'update');                           // 390
          // Create the document                                                                                   // 391
          try {                                                                                                    // 392
            // We should be passed a document in data                                                              // 393
            updateMethodHandler.apply(this, [{ _id: mongoId }, data]);                                             // 394
            // Return the data                                                                                     // 395
            return _publishHTTP.formatResult({ _id: mongoId }, this, defaultFormat);                               // 396
          } catch(err) {                                                                                           // 397
            // This would be a Meteor.error?                                                                       // 398
            return _publishHTTP.error(err.error, { error: err.message }, this);                                    // 399
          }                                                                                                        // 400
                                                                                                                   // 401
        } else {                                                                                                   // 402
          return _publishHTTP.error(400, { error: 'Method expected a document id' }, this);                        // 403
        }                                                                                                          // 404
      };                                                                                                           // 405
    }                                                                                                              // 406
                                                                                                                   // 407
    if (options.documentDelete) {                                                                                  // 408
      methods[name + '/:id'].delete = function(data) {                                                             // 409
         // Get the mongoId                                                                                        // 410
        var mongoId = this.params.id;                                                                              // 411
                                                                                                                   // 412
        // We would allways expect a string but it could be empty                                                  // 413
        if (mongoId !== '') {                                                                                      // 414
                                                                                                                   // 415
          var removeMethodHandler = _publishHTTP.getMethodHandler(collection, 'remove');                           // 416
          // Create the document                                                                                   // 417
          try {                                                                                                    // 418
            // We should be passed a document in data                                                              // 419
            removeMethodHandler.apply(this, [{ _id: mongoId }]);                                                   // 420
            // Return the data                                                                                     // 421
            return _publishHTTP.formatResult({ _id: mongoId }, this, defaultFormat);                               // 422
          } catch(err) {                                                                                           // 423
            // This would be a Meteor.error?                                                                       // 424
            return _publishHTTP.error(err.error, { error: err.message }, this);                                    // 425
          }                                                                                                        // 426
                                                                                                                   // 427
        } else {                                                                                                   // 428
          return _publishHTTP.error(400, { error: 'Method expected a document id' }, this);                        // 429
        }                                                                                                          // 430
      };                                                                                                           // 431
    }                                                                                                              // 432
                                                                                                                   // 433
  }                                                                                                                // 434
                                                                                                                   // 435
  // Publish the methods                                                                                           // 436
  HTTP.methods(methods);                                                                                           // 437
                                                                                                                   // 438
  // Mark these method names as currently published                                                                // 439
  _publishHTTP.currentlyPublished = _.union(_publishHTTP.currentlyPublished, _.keys(methods));                     // 440
                                                                                                                   // 441
}; // EO Publish                                                                                                   // 442
                                                                                                                   // 443
/**                                                                                                                // 444
 * @method HTTP.unpublish                                                                                          // 445
 * @public                                                                                                         // 446
 * @param {String|Meteor.Collection} [name] - The method name or collection                                        // 447
 * @returns {undefined}                                                                                            // 448
 *                                                                                                                 // 449
 * Unpublishes all HTTP methods that were published with the given name or                                         // 450
 * for the given collection. Call with no arguments to unpublish all.                                              // 451
 */                                                                                                                // 452
HTTP.unpublish = _publishHTTP.unpublish;                                                                           // 453
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['http-publish'] = {
  _publishHTTP: _publishHTTP
};

})();

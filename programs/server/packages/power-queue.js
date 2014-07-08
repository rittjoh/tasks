(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Deps = Package.deps.Deps;
var ReactiveProperty = Package['reactive-property'].ReactiveProperty;

/* Package-scope variables */
var PowerQueue, MicroQueue, ReactiveList;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/power-queue/power-queue.js                                                                               //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
// Rig weak dependencies                                                                                             // 1
if (typeof MicroQueue === 'undefined' && Package['micro-queue']) {                                                   // 2
  MicroQueue = Package['micro-queue'].MicroQueue;                                                                    // 3
}                                                                                                                    // 4
if (typeof ReactiveList === 'undefined' && Package['reactive-list']) {                                               // 5
  ReactiveList = Package['reactive-list'].ReactiveList;                                                              // 6
}                                                                                                                    // 7
                                                                                                                     // 8
/**                                                                                                                  // 9
 * Creates an instance of a power queue // Testing inline comment                                                    // 10
 * [Check out demo](http://power-queue-test.meteor.com/)                                                             // 11
 *                                                                                                                   // 12
 * @constructor                                                                                                      // 13
 * @self powerqueue                                                                                                  // 14
 * @param {object} [options] Settings                                                                                // 15
 * @param {boolean} [options.filo=false] Make it a first in last out queue                                           // 16
 * @param {boolean} [options.isPaused=false] Set queue paused                                                        // 17
 * @param {boolean} [options.autostart=true] May adding a task start the queue                                       // 18
 * @param {string} [options.name="Queue"] Name of the queue                                                          // 19
 * @param {number} [options.maxProcessing=1] Limit of simultanous running tasks                                      // 20
 * @param {number} [options.maxFailures = 5] Limit retries of failed tasks, if 0 or below we allow infinite failures // 21
 * @param {number} [options.jumpOnFailure = true] Jump to next task and retry failed task later                      // 22
 * @param {boolean} [options.debug=false] Log verbose messages to the console                                        // 23
 * @param {boolean} [options.reactive=true] Set whether or not this queue should be reactive                         // 24
 * @param {boolean} [options.onAutostart] Callback for the queue autostart event                                     // 25
 * @param {boolean} [options.onPaused] Callback for the queue paused event                                           // 26
 * @param {boolean} [options.onReleased] Callback for the queue release event                                        // 27
 * @param {boolean} [options.onEnded] Callback for the queue end event                                               // 28
 * @param {[SpinalQueue](spinal-queue.spec.md)} [options.spinalQueue] Set spinal queue uses pr. default `MicroQueue` or `ReactiveList` if added to the project
 */                                                                                                                  // 30
PowerQueue = function(options) {                                                                                     // 31
  var self = this;                                                                                                   // 32
  var test = 5;                                                                                                      // 33
                                                                                                                     // 34
  self.reactive = (options && options.reactive === false) ? false :  true;                                           // 35
                                                                                                                     // 36
  // Allow user to use another micro-queue #3                                                                        // 37
  // We try setting the ActiveQueue to MicroQueue if installed in the app                                            // 38
  var ActiveQueue = (typeof MicroQueue !== 'undefined') && MicroQueue || undefined;                                  // 39
                                                                                                                     // 40
  // If ReactiveList is added to the project we use this over MicroQueue                                             // 41
  ActiveQueue = (typeof ReactiveList !== 'undefined') && ReactiveList || ActiveQueue;                                // 42
                                                                                                                     // 43
  // We allow user to overrule and set a custom spinal-queue spec complient queue                                    // 44
  if (options && typeof options.spinalQueue !== 'undefined') {                                                       // 45
    ActiveQueue = options.spinalQueue;                                                                               // 46
  }                                                                                                                  // 47
                                                                                                                     // 48
  if (typeof ActiveQueue === 'undefined') {                                                                          // 49
    console.log('Error: You need to add a spinal queue to the project');                                             // 50
    console.log('Please add "micro-queue", "reactive-list" to the project');                                         // 51
    throw new Error('Please add "micro-queue", "reactive-list" or other spinalQueue compatible packages');           // 52
  }                                                                                                                  // 53
                                                                                                                     // 54
  // Default is fifo lilo                                                                                            // 55
  self.invocations = new ActiveQueue({                                                                               // 56
    //                                                                                                               // 57
    sort: (options && (options.filo || options.lifo)),                                                               // 58
    reactive: self.reactive                                                                                          // 59
  });                                                                                                                // 60
  //var self.invocations = new ReactiveList(queueOrder);                                                             // 61
                                                                                                                     // 62
  // List of current tasks being processed                                                                           // 63
  self._processList = new ActiveQueue({                                                                              // 64
    reactive: self.reactive                                                                                          // 65
  }); //ReactiveList();                                                                                              // 66
                                                                                                                     // 67
  // Max number of simultanious tasks being processed                                                                // 68
  self._maxProcessing = new ReactiveProperty(options && options.maxProcessing || 1, self.reactive);                  // 69
                                                                                                                     // 70
  // Reactive number of tasks being processed                                                                        // 71
  self._isProcessing = new ReactiveProperty(0, self.reactive);                                                       // 72
                                                                                                                     // 73
  // Boolean indicating if queue is paused or not                                                                    // 74
  self._paused = new ReactiveProperty((options && options.isPaused || false), self.reactive);                        // 75
                                                                                                                     // 76
  // Boolean indicator for queue status active / running (can still be paused)                                       // 77
  self._running = new ReactiveProperty(false, self.reactive);                                                        // 78
                                                                                                                     // 79
  // Counter for errors, errors are triggered if maxFailures is exeeded                                              // 80
  self._errors = new ReactiveProperty(0, self.reactive);                                                             // 81
                                                                                                                     // 82
  // Counter for task failures, contains error count                                                                 // 83
  self._failures = new ReactiveProperty(0, self.reactive);                                                           // 84
                                                                                                                     // 85
  // On failure jump to new task - if false the current task is rerun until error                                    // 86
  self._jumpOnFailure = (options && options.jumpOnFailure === false) ? false : true;                                 // 87
                                                                                                                     // 88
  // Count of all added tasks                                                                                        // 89
  self._maxLength = new ReactiveProperty(0, self.reactive);                                                          // 90
                                                                                                                     // 91
  // Boolean indicate whether or not a "add" task is allowed to start the queue                                      // 92
  self._autostart = new ReactiveProperty( ((options && options.autostart === false) ? false : true), self.reactive); // 93
                                                                                                                     // 94
  // Limit times a task is allowed to fail and be rerun later before triggering an error                             // 95
  self._maxFailures = new ReactiveProperty( (options && options.maxFailures || 5), self.reactive);                   // 96
                                                                                                                     // 97
  // Name / title of this queue - Not used - should deprecate                                                        // 98
  self.title = options && options.name || 'Queue';                                                                   // 99
                                                                                                                     // 100
  // debug - will print error / failures passed to next                                                              // 101
  self.debug = !!(options && options.debug);                                                                         // 102
                                                                                                                     // 103
  /** @method PowerQueue.total                                                                                       // 104
   * @reactive                                                                                                       // 105
   * @returns {number} The total number of tasks added to this queue                                                 // 106
   */                                                                                                                // 107
  self.total = self._maxLength.get;                                                                                  // 108
                                                                                                                     // 109
  /** @method PowerQueue.isPaused                                                                                    // 110
   * @reactive                                                                                                       // 111
   * @returns {boolean} Status of the paused state of the queue                                                      // 112
   */                                                                                                                // 113
  self.isPaused = self._paused.get;                                                                                  // 114
                                                                                                                     // 115
  /** @method PowerQueue.processing                                                                                  // 116
   * @reactive                                                                                                       // 117
   * @returns {number} Number of tasks currently being processed                                                     // 118
   */                                                                                                                // 119
  self.processing = self._isProcessing.get;                                                                          // 120
                                                                                                                     // 121
  /** @method PowerQueue.errors                                                                                      // 122
   * @reactive                                                                                                       // 123
   * @returns {number} The total number of errors                                                                    // 124
   * Errors are triggered when [maxFailures](PowerQueue.maxFailures) are exeeded                                     // 125
   */                                                                                                                // 126
  self.errors = self._errors.get;                                                                                    // 127
                                                                                                                     // 128
  /** @method PowerQueue.failures                                                                                    // 129
   * @reactive                                                                                                       // 130
   * @returns {number} The total number of failed tasks                                                              // 131
   */                                                                                                                // 132
  self.failures = self._failures.get;                                                                                // 133
                                                                                                                     // 134
  /** @method PowerQueue.isRunning                                                                                   // 135
   * @reactive                                                                                                       // 136
   * @returns {boolean} True if the queue is running                                                                 // 137
   * > NOTE: The task can be paused but marked as running                                                            // 138
   */                                                                                                                // 139
  self.isRunning = self._running.get;                                                                                // 140
                                                                                                                     // 141
  /** @method PowerQueue.maxProcessing Get setter for maxProcessing                                                  // 142
   * @param {number} [max] If not used this function works as a getter                                               // 143
   * @reactive                                                                                                       // 144
   * @returns {number} Maximum number of simultaneous processing tasks                                               // 145
   *                                                                                                                 // 146
   * Example:                                                                                                        // 147
   * ```js                                                                                                           // 148
   *   foo.maxProcessing();    // Works as a getter and returns the current value                                    // 149
   *   foo.maxProcessing(20);  // This sets the value to 20                                                          // 150
   * ```                                                                                                             // 151
   */                                                                                                                // 152
  self.maxProcessing = self._maxProcessing.getset;                                                                   // 153
                                                                                                                     // 154
  self._maxProcessing.onChange = function() {                                                                        // 155
    // The user can change the max allowed processing tasks up or down here...                                       // 156
    // Update the throttle up                                                                                        // 157
    self.updateThrottleUp();                                                                                         // 158
    // Update the throttle down                                                                                      // 159
    self.updateThrottleDown();                                                                                       // 160
  };                                                                                                                 // 161
                                                                                                                     // 162
  /** @method PowerQueue.autostart Get setter for autostart                                                          // 163
   * @param {boolean} [autorun] If not used this function works as a getter                                          // 164
   * @reactive                                                                                                       // 165
   * @returns {boolean} If adding a task may trigger the queue to start                                              // 166
   *                                                                                                                 // 167
   * Example:                                                                                                        // 168
   * ```js                                                                                                           // 169
   *   foo.autostart();    // Works as a getter and returns the current value                                        // 170
   *   foo.autostart(true);  // This sets the value to true                                                          // 171
   * ```                                                                                                             // 172
   */                                                                                                                // 173
  self.autostart = self._autostart.getset;                                                                           // 174
                                                                                                                     // 175
  /** @method PowerQueue.maxFailures Get setter for maxFailures                                                      // 176
   * @param {number} [max] If not used this function works as a getter                                               // 177
   * @reactive                                                                                                       // 178
   * @returns {number} The maximum for failures pr. task before triggering an error                                  // 179
   *                                                                                                                 // 180
   * Example:                                                                                                        // 181
   * ```js                                                                                                           // 182
   *   foo.maxFailures();    // Works as a getter and returns the current value                                      // 183
   *   foo.maxFailures(10);  // This sets the value to 10                                                            // 184
   * ```                                                                                                             // 185
   */                                                                                                                // 186
  self.maxFailures = self._maxFailures.getset;                                                                       // 187
                                                                                                                     // 188
  /** @callback PowerQueue.onPaused                                                                                  // 189
   * Is called when queue is ended                                                                                   // 190
   */                                                                                                                // 191
  self.onPaused = options && options.onPaused || function() {                                                        // 192
    self.debug && console.log(self.title + ' ENDED');                                                                // 193
  };                                                                                                                 // 194
                                                                                                                     // 195
  /** @callback PowerQueue.onEnded                                                                                   // 196
   * Is called when queue is ended                                                                                   // 197
   */                                                                                                                // 198
  self.onEnded = options && options.onEnded || function() {                                                          // 199
    self.debug && console.log(self.title + ' ENDED');                                                                // 200
  };                                                                                                                 // 201
                                                                                                                     // 202
  /** @callback PowerQueue.onRelease                                                                                 // 203
   * Is called when queue is released                                                                                // 204
   */                                                                                                                // 205
  self.onRelease = options && options.onRelease || function() {                                                      // 206
    self.debug && console.log(self.title + ' RELEASED');                                                             // 207
  };                                                                                                                 // 208
                                                                                                                     // 209
  /** @callback PowerQueue.onAutostart                                                                               // 210
   * Is called when queue is auto started                                                                            // 211
   */                                                                                                                // 212
  self.onAutostart = options && options.onAutostart || function() {                                                  // 213
    self.debug && console.log(self.title + ' Autostart');                                                            // 214
  };                                                                                                                 // 215
};                                                                                                                   // 216
                                                                                                                     // 217
  /** @method PowerQueue.prototype.processList                                                                       // 218
   * @reactive                                                                                                       // 219
   * @returns {array} List of tasks currently being processed                                                        // 220
   */                                                                                                                // 221
  PowerQueue.prototype.processingList = function() {                                                                 // 222
    var self = this;                                                                                                 // 223
    return self._processList.fetch();                                                                                // 224
  };                                                                                                                 // 225
                                                                                                                     // 226
  /** @method PowerQueue.prototype.isHalted                                                                          // 227
   * @reactive                                                                                                       // 228
   * @returns {boolean} True if the queue is not running or paused                                                   // 229
   */                                                                                                                // 230
  PowerQueue.prototype.isHalted = function() {                                                                       // 231
    var self = this;                                                                                                 // 232
    return (!self._running.get() || self._paused.get());                                                             // 233
  };                                                                                                                 // 234
                                                                                                                     // 235
  /** @method PowerQueue.prototype.length                                                                            // 236
   * @reactive                                                                                                       // 237
   * @returns {number} Number of tasks left in queue to be processed                                                 // 238
   */                                                                                                                // 239
  PowerQueue.prototype.length = function() {                                                                         // 240
    var self = this;                                                                                                 // 241
    return self.invocations.length();                                                                                // 242
  };                                                                                                                 // 243
                                                                                                                     // 244
  /** @method PowerQueue.prototype.progress                                                                          // 245
   * @reactive                                                                                                       // 246
   * @returns {number} 0 .. 100 % Indicates the status of the queue                                                  // 247
   */                                                                                                                // 248
  PowerQueue.prototype.progress = function() {                                                                       // 249
    var self = this;                                                                                                 // 250
    var progress = self._maxLength.get() - self.invocations.length();                                                // 251
    if (self._maxLength.value > 0) {                                                                                 // 252
      return Math.round(progress / self._maxLength.value * 100);                                                     // 253
    }                                                                                                                // 254
    return 0;                                                                                                        // 255
  };                                                                                                                 // 256
                                                                                                                     // 257
  /** @method PowerQueue.prototype.usage                                                                             // 258
   * @reactive                                                                                                       // 259
   * @returns {number} 0 .. 100 % Indicates ressource usage of the queue                                             // 260
   */                                                                                                                // 261
  PowerQueue.prototype.usage = function() {                                                                          // 262
    var self = this;                                                                                                 // 263
    return Math.round(self._isProcessing.get() / self._maxProcessing.get() * 100);                                   // 264
  };                                                                                                                 // 265
                                                                                                                     // 266
  /** @method PowerQueue.prototype.reset Reset the queue                                                             // 267
   * Calling this will:                                                                                              // 268
   * * stop the queue                                                                                                // 269
   * * paused to false                                                                                               // 270
   * * Discart all queue data                                                                                        // 271
   *                                                                                                                 // 272
   * > NOTE: At the moment if the queue has processing tasks they can change                                         // 273
   * > the `errors` and `failures` counters. This could change in the future or                                      // 274
   * > be prevented by creating a whole new instance of the `PowerQueue`                                             // 275
   */                                                                                                                // 276
  PowerQueue.prototype.reset = function() {                                                                          // 277
    var self = this;                                                                                                 // 278
    self.debug && console.log(self.title + ' RESET');                                                                // 279
    self._running.set(false);                                                                                        // 280
    self._paused.set(false);                                                                                         // 281
    self.invocations.reset();                                                                                        // 282
    self._processList.reset();                                                                                       // 283
                                                                                                                     // 284
    // // Loop through the processing tasks and reset these                                                          // 285
    // self._processList.forEach(function(data) {                                                                    // 286
    //   if (data.queue instanceof PowerQueue) {                                                                     // 287
    //     data.queue.reset();                                                                                       // 288
    //   }                                                                                                           // 289
    // }, true);                                                                                                     // 290
    self._maxLength.set(0);                                                                                          // 291
    self._failures.set(0);                                                                                           // 292
    self._errors.set(0);                                                                                             // 293
  };                                                                                                                 // 294
                                                                                                                     // 295
  /** @method PowerQueue._autoStartTasks                                                                             // 296
   * @private                                                                                                        // 297
   *                                                                                                                 // 298
   * This method defines the autostart algorithm that allows add task to trigger                                     // 299
   * a start of the queue if queue is not paused.                                                                    // 300
   */                                                                                                                // 301
  PowerQueue.prototype._autoStartTasks = function() {                                                                // 302
    var self = this;                                                                                                 // 303
                                                                                                                     // 304
    // We dont start anything by ourselfs if queue is paused                                                         // 305
    if (!self._paused.value) {                                                                                       // 306
                                                                                                                     // 307
      // Queue is not running and we are set to autostart so we start the queue                                      // 308
      if (!self._running.value && self._autostart.value) {                                                           // 309
        // Trigger callback / event                                                                                  // 310
        self.onAutostart();                                                                                          // 311
        // Set queue as running                                                                                      // 312
        self._running.set(true);                                                                                     // 313
      }                                                                                                              // 314
                                                                                                                     // 315
      // Make sure that we use all available ressources                                                              // 316
      if (self._running.value) {                                                                                     // 317
        // Call next to start up the queue                                                                           // 318
        self.next(null);                                                                                             // 319
      }                                                                                                              // 320
                                                                                                                     // 321
    }                                                                                                                // 322
  };                                                                                                                 // 323
                                                                                                                     // 324
  /** @method PowerQueue.prototype.add                                                                               // 325
   * @param {any} data The task to be handled                                                                        // 326
   * @param {number} [failures] Internally used to Pass on number of failures.                                       // 327
   */                                                                                                                // 328
  PowerQueue.prototype.add = function(data, failures, id) {                                                          // 329
    var self = this;                                                                                                 // 330
                                                                                                                     // 331
    // Assign new id to task                                                                                         // 332
    var assignNewId = self._jumpOnFailure || typeof id === 'undefined';                                              // 333
                                                                                                                     // 334
    // Set the task id                                                                                               // 335
    var taskId = (assignNewId) ? self._maxLength.value + 1 : id;                                                     // 336
                                                                                                                     // 337
    // self.invocations.add({ _id: currentId, data: data, failures: failures || 0 }, reversed);                      // 338
    self.invocations.insert(taskId, { _id: taskId, data: data, failures: failures || 0 });                           // 339
                                                                                                                     // 340
    // If we assigned new id then increase length                                                                    // 341
    if (assignNewId) self._maxLength.inc();                                                                          // 342
                                                                                                                     // 343
    self._autoStartTasks();                                                                                          // 344
  };                                                                                                                 // 345
                                                                                                                     // 346
  /** @method PowerQueue.prototype.updateThrottleUp                                                                  // 347
   * @private                                                                                                        // 348
   *                                                                                                                 // 349
   * Calling this method will update the throttle on the queue adding tasks.                                         // 350
   *                                                                                                                 // 351
   * > Note: Currently we only support the PowerQueue - but we could support                                         // 352
   * > a more general interface for pauseable tasks or other usecases.                                               // 353
   */                                                                                                                // 354
  PowerQueue.prototype.updateThrottleUp = function() {                                                               // 355
    var self = this;                                                                                                 // 356
                                                                                                                     // 357
    // How many additional tasks can we handle?                                                                      // 358
    var availableSlots = self._maxProcessing.value - self._isProcessing.value;                                       // 359
    // If we can handle more, we have more, we're running, and we're not paused                                      // 360
    if (!self._paused.value && self._running.value && availableSlots > 0 && self.invocations._length > 0) {          // 361
      // Increase counter of current number of tasks being processed                                                 // 362
      self._isProcessing.inc();                                                                                      // 363
      // Run task                                                                                                    // 364
      self.runTask(self.invocations.getFirstItem());                                                                 // 365
      // Repeat recursively; this is better than a for loop to avoid blocking the UI                                 // 366
      self.updateThrottleUp();                                                                                       // 367
    }                                                                                                                // 368
                                                                                                                     // 369
  };                                                                                                                 // 370
                                                                                                                     // 371
  /** @method PowerQueue.prototype.updateThrottleDown                                                                // 372
   * @private                                                                                                        // 373
   *                                                                                                                 // 374
   * Calling this method will update the throttle on the queue pause tasks.                                          // 375
   *                                                                                                                 // 376
   * > Note: Currently we only support the PowerQueue - but we could support                                         // 377
   * > a more general interface for pauseable tasks or other usecases.                                               // 378
   */                                                                                                                // 379
  PowerQueue.prototype.updateThrottleDown = function() {                                                             // 380
    var self = this;                                                                                                 // 381
    // Calculate the differece between acutuall processing tasks and target                                          // 382
    var diff = self._isProcessing.value - self._maxProcessing.value;                                                 // 383
                                                                                                                     // 384
    // If the diff is more than 0 then we have many tasks processing.                                                // 385
    if (diff > 0) {                                                                                                  // 386
      // We pause the latest added tasks                                                                             // 387
      self._processList.forEachReverse(function(data) {                                                              // 388
        if (diff > 0 && data.queue instanceof PowerQueue) {                                                          // 389
          diff--;                                                                                                    // 390
          // We dont mind calling pause on multiple times on each task                                               // 391
          // theres a simple check going on preventing any duplicate actions                                         // 392
          data.queue.pause();                                                                                        // 393
        }                                                                                                            // 394
      }, true);                                                                                                      // 395
    }                                                                                                                // 396
  };                                                                                                                 // 397
                                                                                                                     // 398
  /** @method PowerQueue.prototype.next                                                                              // 399
   * @param {string} [err] Error message if task failed                                                              // 400
   * > * Can pass in `null` to start the queue                                                                       // 401
   * > * Passing in a string to `next` will trigger a failure                                                        // 402
   * > * Passing nothing will simply let the next task run                                                           // 403
   * `next` is handed into the [taskHandler](PowerQueue.taskHandler) as a                                            // 404
   * callback to mark an error or end of current task                                                                // 405
   */                                                                                                                // 406
  PowerQueue.prototype.next = function(err) {                                                                        // 407
    var self = this;                                                                                                 // 408
    // Primary concern is to throttle up because we are either:                                                      // 409
    // 1. Starting the queue                                                                                         // 410
    // 2. Starting next task                                                                                         // 411
    //                                                                                                               // 412
    // This function does not shut down running tasks                                                                // 413
    self.updateThrottleUp();                                                                                         // 414
                                                                                                                     // 415
    // We are running, no tasks are being processed even we just updated the                                         // 416
    // throttle up and we got no errors.                                                                             // 417
    // 1. We are paused and releasing tasks                                                                          // 418
    // 2. We are done                                                                                                // 419
    if (self._running.value && self._isProcessing.value === 0 && err !== null) {                                     // 420
                                                                                                                     // 421
      // We have no tasks processing so this queue is now releasing resources                                        // 422
      // this could be that the queue is paused or stopped, in that case the                                         // 423
      // self.invocations._length would be > 0                                                                       // 424
      // If on the other hand the self.invocations._length is 0 then we have no more                                 // 425
      // tasks in the queue so the queue has ended                                                                   // 426
      self.onRelease(self.invocations._length);                                                                      // 427
                                                                                                                     // 428
      if (!self.invocations._length) { // !self._paused.value &&                                                     // 429
        // Check if queue is done working                                                                            // 430
        // Stop the queue                                                                                            // 431
        self._running.set(false);                                                                                    // 432
        // self.invocations.reset(); // This should be implicit                                                      // 433
        self.onEnded();                                                                                              // 434
      }                                                                                                              // 435
                                                                                                                     // 436
    }                                                                                                                // 437
  };                                                                                                                 // 438
                                                                                                                     // 439
  /** @callback done                                                                                                 // 440
   * @param {Meteor.Error | Error | String | null} [feedback] This allows the task to communicate with the queue     // 441
   *                                                                                                                 // 442
   * Explaination of `feedback`                                                                                      // 443
   * * `Meteor.Error` This means that the task failed in a controlled manner and is allowed to rerun                 // 444
   * * `Error` This will throw the passed error - as its an unitended error                                          // 445
   * * `null` The task is not done yet, rerun later                                                                  // 446
   * * `String` The task can perform certain commands on the queue                                                   // 447
   *    * "pause" - pause the queue                                                                                  // 448
   *    * "stop" - stop the queue                                                                                    // 449
   *    * "reset" - reset the queue                                                                                  // 450
   *    * "cancel" - cancel the queue                                                                                // 451
   *                                                                                                                 // 452
   */                                                                                                                // 453
                                                                                                                     // 454
                                                                                                                     // 455
  /** @method PowerQueue.prototype.runTaskDone                                                                       // 456
   * @private                                                                                                        // 457
   * @param {Meteor.Error | Error | String | null} [feedback] This allows the task to communicate with the queue     // 458
   * @param {object} invocation                                                                                      // 459
   *                                                                                                                 // 460
   * > Note: `feedback` is explained in [Done callback](#done)                                                       // 461
   *                                                                                                                 // 462
   */                                                                                                                // 463
  // Rig the callback function                                                                                       // 464
  PowerQueue.prototype.runTaskDone = function(feedback, invocation) {                                                // 465
    var self = this;                                                                                                 // 466
                                                                                                                     // 467
    // If the task handler throws an error then add it to the queue again                                            // 468
    // we allow this for a max of self._maxFailures                                                                  // 469
    // If the error is null then we add the task silently back into the                                              // 470
    // microQueue in reverse... This could be due to pause or throttling                                             // 471
    if (feedback instanceof Meteor.Error) {                                                                          // 472
      // We only count failures if maxFailures are above 0                                                           // 473
      if (self._maxFailures.value > 0) invocation.failures++;                                                        // 474
      self._failures.inc();                                                                                          // 475
                                                                                                                     // 476
      // If the user has set the debug flag we print out failures/errors                                             // 477
      console.error('Error: "' + self.title + '" ' + feedback.message + ', ' + feedback.stack);                      // 478
                                                                                                                     // 479
      if (invocation.failures < self._maxFailures.value) {                                                           // 480
        // Add the task again with the increased failures                                                            // 481
        self.add(invocation.data, invocation.failures, invocation._id);                                              // 482
      } else {                                                                                                       // 483
        self._errors.inc();                                                                                          // 484
        self.errorHandler(invocation.data, self.add, invocation.failures);                                           // 485
      }                                                                                                              // 486
                                                                                                                     // 487
      // If a error is thrown we assume its not intended                                                             // 488
    } else if (feedback instanceof Error) throw feedback;                                                            // 489
                                                                                                                     // 490
    if (feedback)                                                                                                    // 491
                                                                                                                     // 492
    // We use null to throttle pauseable tasks                                                                       // 493
    if (feedback === null) {                                                                                         // 494
      // We add this task into the queue, no questions asked                                                         // 495
      self.invocations.insert(invocation._id, { data: invocation.data, failures: invocation.failures, _id: invocation._id });
    }                                                                                                                // 497
                                                                                                                     // 498
    // If the user returns a string we got a command                                                                 // 499
    if (feedback === ''+feedback) {                                                                                  // 500
      var command = {                                                                                                // 501
        'pause': function() { self.pause(); },                                                                       // 502
        'stop': function() { self.stop(); },                                                                         // 503
        'reset': function() { self.reset(); },                                                                       // 504
        'cancel': function() { self.cancel(); },                                                                     // 505
      };                                                                                                             // 506
      if (typeof command[feedback] === 'function') {                                                                 // 507
        // Run the command on this queue                                                                             // 508
        command[feedback]();                                                                                         // 509
      } else {                                                                                                       // 510
        // We dont recognize this command, throw an error                                                            // 511
        throw new Error('Unknown queue command "' + feedback + '"');                                                 // 512
      }                                                                                                              // 513
    }                                                                                                                // 514
    // Decrease the number of tasks being processed                                                                  // 515
    // make sure we dont go below 0                                                                                  // 516
    if (self._isProcessing.value > 0) self._isProcessing.dec();                                                      // 517
    // Task has ended we remove the task from the process list                                                       // 518
    self._processList.remove(invocation._id);                                                                        // 519
                                                                                                                     // 520
    invocation.data = null;                                                                                          // 521
    invocation.failures = null;                                                                                      // 522
    invocation._id = null;                                                                                           // 523
    invocation = null;                                                                                               // 524
    delete invocation;                                                                                               // 525
    // Next task                                                                                                     // 526
    Meteor.setTimeout(function() {                                                                                   // 527
      self.next();                                                                                                   // 528
    }, 0);                                                                                                           // 529
                                                                                                                     // 530
  };                                                                                                                 // 531
                                                                                                                     // 532
                                                                                                                     // 533
  /** @method PowerQueue.prototype.runTask                                                                           // 534
   * @private // This is not part of the open api                                                                    // 535
   * @param {object} invocation The object stored in the micro-queue                                                 // 536
   */                                                                                                                // 537
  PowerQueue.prototype.runTask = function(invocation) {                                                              // 538
    var self = this;                                                                                                 // 539
                                                                                                                     // 540
    // We start the fitting task handler                                                                             // 541
    // Currently we only support the PowerQueue but we could have a more general                                     // 542
    // interface for tasks that allow throttling                                                                     // 543
    try {                                                                                                            // 544
      if (invocation.data instanceof PowerQueue) {                                                                   // 545
                                                                                                                     // 546
        // Insert PowerQueue into process list                                                                       // 547
        self._processList.insert(invocation._id, { id: invocation._id, queue: invocation.data });                    // 548
        // Handle task                                                                                               // 549
        self.queueTaskHandler(invocation.data, function subQueueCallbackDone(feedback) {                             // 550
          self.runTaskDone(feedback, invocation);                                                                    // 551
        }, invocation.failures);                                                                                     // 552
                                                                                                                     // 553
      } else {                                                                                                       // 554
                                                                                                                     // 555
        // Insert task into process list                                                                             // 556
        self._processList.insert(invocation._id, invocation.data);                                                   // 557
        // Handle task                                                                                               // 558
        self.taskHandler(invocation.data, function taskCallbackDone(feedback) {                                      // 559
          self.runTaskDone(feedback, invocation);                                                                    // 560
        }, invocation.failures);                                                                                     // 561
                                                                                                                     // 562
      }                                                                                                              // 563
    } catch(err) {                                                                                                   // 564
      throw new Error('Error while running taskHandler for queue, Error: ' + err.message);                           // 565
    }                                                                                                                // 566
  };                                                                                                                 // 567
                                                                                                                     // 568
  /** @method PowerQueue.prototype.queueTaskHandler                                                                  // 569
   * This method handles tasks that are sub queues                                                                   // 570
   */                                                                                                                // 571
  PowerQueue.prototype.queueTaskHandler = function(subQueue, next, failures) {                                       // 572
    var self = this;                                                                                                 // 573
    // Monitor sub queue task releases                                                                               // 574
    subQueue.onRelease = function(remaining) {                                                                       // 575
      // Ok, we were paused - this could be throttling so we respect this                                            // 576
      // So when the queue is halted we add it back into the main queue                                              // 577
      if (remaining > 0) {                                                                                           // 578
        // We get out of the queue but dont repport error and add to run later                                       // 579
        next(null);                                                                                                  // 580
      } else {                                                                                                       // 581
        // Queue has ended                                                                                           // 582
        // We simply trigger next task when the sub queue is complete                                                // 583
        next();                                                                                                      // 584
        // When running subqueues it doesnt make sense to track failures and retry                                   // 585
        // the sub queue - this is sub queue domain                                                                  // 586
      }                                                                                                              // 587
    };                                                                                                               // 588
                                                                                                                     // 589
    // Start the queue                                                                                               // 590
    subQueue.run();                                                                                                  // 591
  };                                                                                                                 // 592
                                                                                                                     // 593
  /** @callback PowerQueue.prototype.taskHandler                                                                     // 594
   * @param {any} data This can be data or functions                                                                 // 595
   * @param {function} next Function `next` call this to end task                                                    // 596
   * @param {number} failures Number of failures on this task                                                        // 597
   *                                                                                                                 // 598
   * Default task handler expects functions as data:                                                                 // 599
   * ```js                                                                                                           // 600
   *   self.taskHandler = function(data, next, failures) {                                                           // 601
   *     // This default task handler expects invocation to be a function to run                                     // 602
   *     if (typeof data !== 'function') {                                                                           // 603
   *       throw new Error('Default task handler expects a function');                                               // 604
   *     }                                                                                                           // 605
   *     try {                                                                                                       // 606
   *       // Have the function call next                                                                            // 607
   *       data(next, failures);                                                                                     // 608
   *     } catch(err) {                                                                                              // 609
   *       // Throw to fail this task                                                                                // 610
   *       next(err);                                                                                                // 611
   *     }                                                                                                           // 612
   *   };                                                                                                            // 613
   * ```                                                                                                             // 614
   */                                                                                                                // 615
                                                                                                                     // 616
  // Can be overwrittin by the user                                                                                  // 617
  PowerQueue.prototype.taskHandler = function(data, next, failures) {                                                // 618
    var self = this;                                                                                                 // 619
    // This default task handler expects invocation to be a function to run                                          // 620
    if (typeof data !== 'function') {                                                                                // 621
      throw new Error('Default task handler expects a function');                                                    // 622
    }                                                                                                                // 623
    try {                                                                                                            // 624
      // Have the function call next                                                                                 // 625
      data(next, failures);                                                                                          // 626
    } catch(err) {                                                                                                   // 627
      // Throw to fail this task                                                                                     // 628
      next(err);                                                                                                     // 629
    }                                                                                                                // 630
  };                                                                                                                 // 631
                                                                                                                     // 632
  /** @callback PowerQueue.prototype.errorHandler                                                                    // 633
   * @param {any} data This can be data or functions                                                                 // 634
   * @param {function} addTask Use this function to insert the data into the queue again                             // 635
   * @param {number} failures Number of failures on this task                                                        // 636
   *                                                                                                                 // 637
   * The default callback:                                                                                           // 638
   * ```js                                                                                                           // 639
   *   var foo = new PowerQueue();                                                                                   // 640
   *                                                                                                                 // 641
   *   // Overwrite the default action                                                                               // 642
   *   foo.errorHandler = function(data, addTask, failures) {                                                        // 643
   *     // This could be overwritten the data contains the task data and addTask                                    // 644
   *     // is a helper for adding the task to the queue                                                             // 645
   *     // try again: addTask(data);                                                                                // 646
   *     // console.log('Terminate at ' + failures + ' failures');                                                   // 647
   *   };                                                                                                            // 648
   * ```                                                                                                             // 649
   */                                                                                                                // 650
  PowerQueue.prototype.errorHandler = function(data, addTask, failures) {                                            // 651
    var self = this;                                                                                                 // 652
    // This could be overwritten the data contains the task data and addTask                                         // 653
    // is a helper for adding the task to the queue                                                                  // 654
    // try again: addTask(data);                                                                                     // 655
    self.debug && console.log('Terminate at ' + failures + ' failures');                                             // 656
  };                                                                                                                 // 657
                                                                                                                     // 658
  /** @method PowerQueue.prototype.pause Pause the queue                                                             // 659
   * @todo We should have it pause all processing tasks                                                              // 660
   */                                                                                                                // 661
  PowerQueue.prototype.pause = function() {                                                                          // 662
    var self = this;                                                                                                 // 663
    if (!self._paused.value) {                                                                                       // 664
                                                                                                                     // 665
      self._paused.set(true);                                                                                        // 666
      // Loop through the processing tasks and pause these                                                           // 667
      self._processList.forEach(function(data) {                                                                     // 668
        if (data.queue instanceof PowerQueue) {                                                                      // 669
          // Pause the sub queue                                                                                     // 670
          data.queue.pause();                                                                                        // 671
        }                                                                                                            // 672
      }, true);                                                                                                      // 673
                                                                                                                     // 674
      // Trigger callback                                                                                            // 675
      self.onPaused();                                                                                               // 676
    }                                                                                                                // 677
  };                                                                                                                 // 678
                                                                                                                     // 679
  /** @method PowerQueue.prototype.resume Start a paused queue                                                       // 680
   * @todo We should have it resume all processing tasks                                                             // 681
   *                                                                                                                 // 682
   * > This will not start a stopped queue                                                                           // 683
   */                                                                                                                // 684
  PowerQueue.prototype.resume = function() {                                                                         // 685
    var self = this;                                                                                                 // 686
    // Un pause the queue                                                                                            // 687
    self.self._paused.set(false);                                                                                    // 688
    // Make sure we are up and running                                                                               // 689
    self.next(null);                                                                                                 // 690
  };                                                                                                                 // 691
                                                                                                                     // 692
  /** @method PowerQueue.prototype.run Starts the queue                                                              // 693
   * > Using this command will resume a paused queue and will                                                        // 694
   * > start a stopped queue.                                                                                        // 695
   */                                                                                                                // 696
  PowerQueue.prototype.run = function() {                                                                            // 697
    var self = this;                                                                                                 // 698
    //not paused and already running or queue empty or paused subqueues                                              // 699
    if (!self._paused.value && self._running.value || !self.invocations._length) {                                   // 700
      return;                                                                                                        // 701
    }                                                                                                                // 702
                                                                                                                     // 703
    self._paused.set(false);                                                                                         // 704
    self._running.set(true);                                                                                         // 705
    self.next(null);                                                                                                 // 706
  };                                                                                                                 // 707
                                                                                                                     // 708
  /** @method PowerQueue.prototype.stop Stops the queue                                                              // 709
   */                                                                                                                // 710
  PowerQueue.prototype.stop = function() {                                                                           // 711
    var self = this;                                                                                                 // 712
    self._running.set(false);                                                                                        // 713
  };                                                                                                                 // 714
                                                                                                                     // 715
  /** @method PowerQueue.prototype.cancel Cancel the queue                                                           // 716
   */                                                                                                                // 717
  PowerQueue.prototype.cancel = function() {                                                                         // 718
    var self = this;                                                                                                 // 719
    self.reset();                                                                                                    // 720
  };                                                                                                                 // 721
                                                                                                                     // 722
                                                                                                                     // 723
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['power-queue'] = {
  PowerQueue: PowerQueue
};

})();

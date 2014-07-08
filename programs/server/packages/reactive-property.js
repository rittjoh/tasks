(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Deps = Package.deps.Deps;

/* Package-scope variables */
var ReactiveProperty;

(function () {

/////////////////////////////////////////////////////////////////////////////////////
//                                                                                 //
// packages/reactive-property/reactive-property.js                                 //
//                                                                                 //
/////////////////////////////////////////////////////////////////////////////////////
                                                                                   //
// #ReactiveProperty                                                               // 1
// A simple class that provides an reactive property interface                     // 2
                                                                                   // 3
/**                                                                                // 4
  * @constructor                                                                   // 5
  * @param {any} defaultValue Set the default value for the reactive property      // 6
  *                                                                                // 7
  * This api should only be in the internal.api.md                                 // 8
  */                                                                               // 9
ReactiveProperty = function(defaultValue) {                                        // 10
  var self = this;                                                                 // 11
  var _deps = new Deps.Dependency();                                               // 12
                                                                                   // 13
  /** @property ReactiveProperty.value                                             // 14
    * @private                                                                     // 15
    * This contains the non reactive value, should only be used as a getter for    // 16
    * internal use                                                                 // 17
    */                                                                             // 18
  self.value = defaultValue;                                                       // 19
                                                                                   // 20
  /**                                                                              // 21
    * @method ReactiveProperty.get                                                 // 22
    * Usage:                                                                       // 23
    * ```js                                                                        // 24
    *   var foo = new ReactiveProperty('bar');                                     // 25
    *   foo.get(); // equals "bar"                                                 // 26
    * ```                                                                          // 27
    */                                                                             // 28
  self.get = function() {                                                          // 29
    _deps.depend();                                                                // 30
    return self.value;                                                             // 31
  };                                                                               // 32
                                                                                   // 33
  /**                                                                              // 34
    * @method ReactiveProperty.set Set property to value                           // 35
    * @param {any} value                                                           // 36
    * Usage:                                                                       // 37
    * ```js                                                                        // 38
    *   var foo = new ReactiveProperty('bar');                                     // 39
    *   foo.set('bar');                                                            // 40
    * ```                                                                          // 41
    */                                                                             // 42
  self.set = function(value) {                                                     // 43
    if (self.value !== value) {                                                    // 44
      self.value = value;                                                          // 45
      _deps.changed();                                                             // 46
    }                                                                              // 47
  };                                                                               // 48
                                                                                   // 49
  /**                                                                              // 50
    * @method ReactiveProperty.dec Decrease numeric property                       // 51
    * @param {number} [by=1] Value to decrease by                                  // 52
    * Usage:                                                                       // 53
    * ```js                                                                        // 54
    *   var foo = new ReactiveProperty('bar');                                     // 55
    *   foo.set(0);                                                                // 56
    *   foo.dec(5); // -5                                                          // 57
    * ```                                                                          // 58
    */                                                                             // 59
  self.dec = function(by) {                                                        // 60
    self.value -= by || 1;                                                         // 61
    _deps.changed();                                                               // 62
  };                                                                               // 63
                                                                                   // 64
  /**                                                                              // 65
    * @method ReactiveProperty.inc increase numeric property                       // 66
    * @param {number} [by=1] Value to increase by                                  // 67
    * Usage:                                                                       // 68
    * ```js                                                                        // 69
    *   var foo = new ReactiveProperty('bar');                                     // 70
    *   foo.set(0);                                                                // 71
    *   foo.inc(5); // 5                                                           // 72
    * ```                                                                          // 73
    */                                                                             // 74
  self.inc = function(by) {                                                        // 75
    self.value += by || 1;                                                         // 76
    _deps.changed();                                                               // 77
  };                                                                               // 78
                                                                                   // 79
  /**                                                                              // 80
    * @method ReactiveProperty.getset increase numeric property                    // 81
    * @param {any} [value] Value to set property - if undefined the act like `get` // 82
    * @returns {any} Returns value if no arguments are passed to the function      // 83
    * Usage:                                                                       // 84
    * ```js                                                                        // 85
    *   var foo = new ReactiveProperty('bar');                                     // 86
    *   foo.getset(5);                                                             // 87
    *   foo.getset(); // returns 5                                                 // 88
    * ```                                                                          // 89
    */                                                                             // 90
  self.getset = function(value) {                                                  // 91
    if (typeof value !== 'undefined') {                                            // 92
      self.set(value);                                                             // 93
    } else {                                                                       // 94
      return self.get();                                                           // 95
    }                                                                              // 96
  };                                                                               // 97
                                                                                   // 98
};                                                                                 // 99
                                                                                   // 100
/////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['reactive-property'] = {
  ReactiveProperty: ReactiveProperty
};

})();

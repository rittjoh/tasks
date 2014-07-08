(function(){/*
 * Add query methods like this:
 *  Division.findPublic = function () {
 *    return Division.find({is_public: true});
 *  }
 */

Division.allow({
  insert: function (userId, doc) {
    return true;
  },

  update: function (userId, doc, fieldNames, modifier) {
    return true;
  },

  remove: function (userId, doc) {
    return true;
  }
});
/*
Division.deny({
  insert: function (userId, doc) {
    return false;
  },

  update: function (userId, doc, fieldNames, modifier) {
    return false;
  },

  remove: function (userId, doc) {
    return false;
  }
});
*/

})();

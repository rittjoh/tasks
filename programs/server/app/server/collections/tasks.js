(function(){/*
 * Add query methods like this:
 *  Tasks.findPublic = function () {
 *    return Tasks.find({is_public: true});
 *  }
 */

Tasks.allow({
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
Tasks.deny({
  insert: function (userId, doc) {
    return false;
  },

  update: function (userId, doc, fieldNames, modifier) {
    return false;
  },

  remove: function (userId, doc) {
    return false;
  }
});*/

})();

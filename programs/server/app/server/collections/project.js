(function(){/*
 * Add query methods like this:
 *  Department.findPublic = function () {
 *    return Department.find({is_public: true});
 *  }
 */

Project.allow({
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
Department.deny({
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

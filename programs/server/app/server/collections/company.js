(function(){/*
 * Add query methods like this:
 *  Company.findPublic = function () {
 *    return Company.find({is_public: true});
 *  }
 */

Company.allow({
  insert: function (userId, doc) {
    return true;
  },

  update: function (userId, doc, fieldNames, modifier) {
    return true;
  },

  remove: function (userId, doc) {
    return true;
  }, 

});

})();

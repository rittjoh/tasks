(function(){Department = new Meteor.Collection('department');

/*
 * Add query methods like this:
 *  Department.findPublic = function () {
 *    return Department.find({is_public: true});
 *  }
 */

 Department.findAll = function () {
     return Department.find({});
 }

})();

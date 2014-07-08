(function(){Project = new Meteor.Collection('project');

/*
 * Add query methods like this:
 *  Department.findPublic = function () {
 *    return Department.find({is_public: true});
 *  }
 */

 Project.findAll = function () {
     return Project.find({});
 }

})();

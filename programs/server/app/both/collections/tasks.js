(function(){Tasks = new Meteor.Collection('tasks');

/*
 * Add query methods like this:
 *  Tasks.findPublic = function () {
 *    return Tasks.find({is_public: true});
 *  }
 */

Tasks.findAll = function () {
     return Tasks.find({});
 }

})();

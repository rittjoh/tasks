(function(){Division = new Meteor.Collection('division');

/*
 * Add query methods like this:
 *  Division.findPublic = function () {
 *    return Division.find({is_public: true});
 *  }
 */

 Division.findAll = function () {
     return Division.find({});
 }

})();

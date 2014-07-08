(function(){Company = new Meteor.Collection('company');

/*
 * Add query methods like this:
 *  Company.findPublic = function () {
 *    return Company.find({is_public: true});
 *  }
 */

 Company.findPublic = function () {
     return Company.find({});
 }

})();

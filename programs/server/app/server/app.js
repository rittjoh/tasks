(function(){/*****************************************************************************/
/* App: The Global Application Namespace */
/*****************************************************************************/
App = {};

Meteor.publish("directory", function () {
  return Meteor.users.find({}, {fields: {emails: 1, profile: 1}});
});

})();

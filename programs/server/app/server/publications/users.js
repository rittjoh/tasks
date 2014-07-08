(function(){Meteor.publish('userQuery', function() {
	
return Meteor.users.find({}, {sort: {emails: -1}});
});



})();

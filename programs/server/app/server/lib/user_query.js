(function(){userQuery = function() {

	users = Meteor.users.find({}, {sort: {emails: 1}});
	return users;
};

})();

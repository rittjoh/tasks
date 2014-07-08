(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Roles = Package.roles.Roles;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;
var Log = Package.logging.Log;
var Deps = Package.deps.Deps;
var DDP = Package.livedata.DDP;
var DDPServer = Package.livedata.DDPServer;
var MongoInternals = Package['mongo-livedata'].MongoInternals;
var UI = Package.ui.UI;
var Handlebars = Package.ui.Handlebars;
var Spacebars = Package.spacebars.Spacebars;
var check = Package.check.check;
var Match = Package.check.Match;
var _ = Package.underscore._;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var filteredUserQuery, users, obj;

(function () {

///////////////////////////////////////////////////////////////////////////////
//                                                                           //
// packages/accounts-admin-ui-bootstrap-3/libs/user_query.js                 //
//                                                                           //
///////////////////////////////////////////////////////////////////////////////
                                                                             //
filteredUserQuery = function(userId, filter) {                               // 1
	// if not an admin user don't show any other user                           // 2
	if (!Roles.userIsInRole(userId, ['admin']))                                 // 3
		return Meteor.users.find(userId);                                          // 4
                                                                             // 5
	// TODO: configurable limit and paginiation                                 // 6
	var queryLimit = 25;                                                        // 7
                                                                             // 8
	if(!!filter) {                                                              // 9
		// TODO: passing to regex directly could be dangerous                      // 10
		users = Meteor.users.find({                                                // 11
			$or: [                                                                    // 12
				{'profile.name': {$regex: filter, $options: 'i'}},                       // 13
				{'emails.address': {$regex: filter, $options: 'i'}}                      // 14
			]                                                                         // 15
		}, {sort: {emails: 1}, limit: queryLimit});                                // 16
	} else {                                                                    // 17
		users = Meteor.users.find({}, {sort: {emails: 1}, limit: queryLimit});     // 18
	}                                                                           // 19
	return users;                                                               // 20
};                                                                           // 21
///////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////
//                                                                           //
// packages/accounts-admin-ui-bootstrap-3/server/startup.js                  //
//                                                                           //
///////////////////////////////////////////////////////////////////////////////
                                                                             //
Meteor.startup(function() {                                                  // 1
	// create an admin role if it doesn't exist                                 // 2
	if (Meteor.roles.find({name: 'admin'}).count() < 1 ) {                      // 3
		Roles.createRole('admin');                                                 // 4
	}                                                                           // 5
});                                                                          // 6
///////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////
//                                                                           //
// packages/accounts-admin-ui-bootstrap-3/server/publish.js                  //
//                                                                           //
///////////////////////////////////////////////////////////////////////////////
                                                                             //
Meteor.publish('roles', function (){                                         // 1
	return Meteor.roles.find({});                                               // 2
});                                                                          // 3
                                                                             // 4
Meteor.publish('filteredUsers', function(filter) {                           // 5
	return filteredUserQuery(this.userId, filter);                              // 6
});                                                                          // 7
///////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////
//                                                                           //
// packages/accounts-admin-ui-bootstrap-3/server/methods.js                  //
//                                                                           //
///////////////////////////////////////////////////////////////////////////////
                                                                             //
Meteor.methods({                                                             // 1
	deleteUser: function(userId) {                                              // 2
		var user = Meteor.user();                                                  // 3
		if (!user || !Roles.userIsInRole(user, ['admin']))                         // 4
			throw new Meteor.Error(401, "You need to be an admin to delete a user."); // 5
                                                                             // 6
		if (user._id == userId)                                                    // 7
			throw new Meteor.Error(422, 'You can\'t delete yourself.');               // 8
		                                                                           // 9
		// remove the user                                                         // 10
		Meteor.users.remove(userId);                                               // 11
	},                                                                          // 12
                                                                             // 13
	addUserRole: function(userId, role) {                                       // 14
		var user = Meteor.user();                                                  // 15
		if (!user || !Roles.userIsInRole(user, ['admin']))                         // 16
			throw new Meteor.Error(401, "You need to be an admin to update a user."); // 17
                                                                             // 18
		if (user._id == userId)                                                    // 19
			throw new Meteor.Error(422, 'You can\'t update yourself.');               // 20
                                                                             // 21
		// handle invalid role                                                     // 22
		if (Meteor.roles.find({name: role}).count() < 1 )                          // 23
			throw new Meteor.Error(422, 'Role ' + role + ' does not exist.');         // 24
                                                                             // 25
		// handle user already has role                                            // 26
		if (Roles.userIsInRole(userId, role))                                      // 27
			throw new Meteor.Error(422, 'Account already has the role ' + role);      // 28
                                                                             // 29
		// add the user to the role                                                // 30
		Roles.addUsersToRoles(userId, role);                                       // 31
	},                                                                          // 32
                                                                             // 33
	removeUserRole: function(userId, role) {                                    // 34
		var user = Meteor.user();                                                  // 35
		if (!user || !Roles.userIsInRole(user, ['admin']))                         // 36
			throw new Meteor.Error(401, "You need to be an admin to update a user."); // 37
                                                                             // 38
		if (user._id == userId)                                                    // 39
			throw new Meteor.Error(422, 'You can\'t update yourself.');               // 40
                                                                             // 41
		// handle invalid role                                                     // 42
		if (Meteor.roles.find({name: role}).count() < 1 )                          // 43
			throw new Meteor.Error(422, 'Role ' + role + ' does not exist.');         // 44
                                                                             // 45
		// handle user already has role                                            // 46
		if (!Roles.userIsInRole(userId, role))                                     // 47
			throw new Meteor.Error(422, 'Account does not have the role ' + role);    // 48
                                                                             // 49
		Roles.removeUsersFromRoles(userId, role);                                  // 50
	},                                                                          // 51
                                                                             // 52
	addRole: function(role) {                                                   // 53
		var user = Meteor.user();                                                  // 54
		if (!user || !Roles.userIsInRole(user, ['admin']))                         // 55
			throw new Meteor.Error(401, "You need to be an admin to update a user."); // 56
                                                                             // 57
		// handle existing role                                                    // 58
		if (Meteor.roles.find({name: role}).count() > 0 )                          // 59
			throw new Meteor.Error(422, 'Role ' + role + ' already exists.');         // 60
                                                                             // 61
		Roles.createRole(role);                                                    // 62
	},                                                                          // 63
                                                                             // 64
	removeRole: function(role) {                                                // 65
		var user = Meteor.user();                                                  // 66
		if (!user || !Roles.userIsInRole(user, ['admin']))                         // 67
			throw new Meteor.Error(401, "You need to be an admin to update a user."); // 68
                                                                             // 69
		// handle non-existing role                                                // 70
		if (Meteor.roles.find({name: role}).count() < 1 )                          // 71
			throw new Meteor.Error(422, 'Role ' + role + ' does not exist.');         // 72
                                                                             // 73
		if (role === 'admin')                                                      // 74
			throw new Meteor.Error(422, 'Cannot delete role admin');                  // 75
                                                                             // 76
		// remove the role from all users who currently have the role              // 77
		// if successfull remove the role                                          // 78
		Meteor.users.update(                                                       // 79
			{roles: role },                                                           // 80
			{$pull: {roles: role }},                                                  // 81
			{multi: true},                                                            // 82
			function(error) {                                                         // 83
				if (error) {                                                             // 84
					throw new Meteor.Error(422, error);                                     // 85
				} else {                                                                 // 86
					Roles.deleteRole(role);                                                 // 87
				}                                                                        // 88
			}                                                                         // 89
		);                                                                         // 90
	},                                                                          // 91
                                                                             // 92
	updateUserInfo: function(id, property, value) {                             // 93
		var user = Meteor.user();                                                  // 94
		if (!user || !Roles.userIsInRole(user, ['admin']))                         // 95
			throw new Meteor.Error(401, "You need to be an admin to update a user."); // 96
                                                                             // 97
		if (property !== 'profile.name')                                           // 98
			throw new Meteor.Error(422, "Only 'name' is supported.");                 // 99
                                                                             // 100
		obj = {};                                                                  // 101
		obj[property] = value;                                                     // 102
		Meteor.users.update({_id: id}, {$set: obj});                               // 103
                                                                             // 104
	}                                                                           // 105
});                                                                          // 106
///////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['accounts-admin-ui-bootstrap-3'] = {};

})();

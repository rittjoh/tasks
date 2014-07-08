(function(){/*****************************************************************************/
/* App: The Global Application Namespace */
/*****************************************************************************/
App = {};

if (Meteor.isServer) {
    Meteor.startup(function () {
        // bootstrap the admin user if they exist -- You'll be replacing the id later
        if (Meteor.users.findOne("5XnRyBxmHK5bYMRvh"))
            Roles.addUsersToRoles("5XnRyBxmHK5bYMRvh", ['admin']);

        // create a couple of roles if they don't already exist (THESE ARE NOT NEEDED -- just for the demo)
        if(!Meteor.roles.findOne({name: "employee"}))
            Roles.createRole("employee");

        if(!Meteor.roles.findOne({name: "manager"}))
            Roles.createRole("manager");

        MyUsers = Meteor.users;

    });
}

if (Meteor.isClient) {
    Template.adminTemplate.helpers({
        // check if user is an admin
        isAdminUser: function() {
            return Roles.userIsInRole(Meteor.user(), ['admin']);
        }
    });

    Deps.autorun(function(e) {
        Meteor.subscribe('userQuery');
    });    
}

})();

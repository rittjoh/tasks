(function(){/*****************************************************************************/
/* Client and Server Routes */
/*****************************************************************************/
Router.configure({
  layoutTemplate: 'MasterLayout',
  loadingTemplate: 'Loading',
  notFoundTemplate: 'NotFound',
  templateNameConverter: 'upperCamelCase',
  routeControllerNameConverter: 'upperCamelCase'
});


//Any function that is related to routes, are going to be in Router namespace.

Router.mustBeLoggedIn = function () {
	if(!Meteor.user()) {
		this.redirect("/");
	}
};

Router.mustNotBeLoggedIn = function () {
	if(Meteor.user()) {
		this.redirect("/");
	}
};

Router.mustBeAdmin = function() {
	if(!Users.isAdmin(Meteor.userId())){
		this.redirect("/");
	}
};

if (Meteor.isClient) {
	var publicRoutes = ['home','public'];
	Router.onBeforeAction(Router.mustBeLoggedIn, {except: publicRoutes});

	var loginAndRegistrationRoutes = [];
	Router.onBeforeAction(Router.mustNotBeLoggedIn, {only: loginAndRegistrationRoutes});

	var adminRoutes = ['admin','company','department','division', 'import'];
	Router.onBeforeAction(Router.ensureAccountIsAdmin, {only: adminRoutes});
}

Router.map(function() {
    this.route('home', {
        path: '/',

        onBeforeAction: function() {
            if (Meteor.loggingIn()) {
                this.render(this.loadingTemplate);
            } else if(Roles.userIsInRole(Meteor.user(), ['admin'])) {
                console.log('redirecting');
                this.redirect('/admin');
            } else if(Roles.userIsInRole(Meteor.user(), ['manager'])) {
                console.log('redirecting');
                this.redirect('/task');
            } else if(Roles.userIsInRole(Meteor.user(), ['employee'])) {
                console.log('redirecting');
                this.redirect('/task');
            } else {
                
            }
        }
    });

    this.route('admin', {
        path:'/admin',
        template: 'accountsAdmin',
        onBeforeAction: function() {
            if (Meteor.loggingIn()) {
                this.render(this.loadingTemplate);
            } else if(!Roles.userIsInRole(Meteor.user(), ['admin'])) {
                console.log('redirecting');
                this.redirect('/');

            }
        }
    });
  	
  	this.route('task.index', {
  		path: '/task'});

    this.route('task.assign', {
      path: '/assign'});

  	this.route('home', {
  		path: '/home'});  	

    this.route('company', {
      path: '/company'});   

    this.route('department', {
      path: '/department'}); 

    this.route('division', {
      path: '/division'}); 

    this.route('project', {
      path: '/project'});     

    this.route('uploadCSV', {
      path: '/import'}); 

});

})();

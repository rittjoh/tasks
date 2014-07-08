(function(){/*****************************************************************************/
/* TasksIndex Publish Functions
/*****************************************************************************/

Meteor.publish('tasks', function () {
  // you can remove this if you return a cursor
  this.ready();
});

})();

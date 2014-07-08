(function(){Meteor.publish("Tasks", function () {
    return Tasks.find({}, {sort: {name: -1}});
});

})();

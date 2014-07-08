(function(){Meteor.publish("Project", function () {
    return Project.find();
});

})();

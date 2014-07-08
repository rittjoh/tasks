(function(){Meteor.publish("Department", function () {
    return Department.find();
});

})();

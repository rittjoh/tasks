(function(){Meteor.publish("Company", function () {
    return Company.find();
});

})();

(function(){/*****************************************************************************/
/* Tasks Methods */
/*****************************************************************************/

Meteor.methods({
 /*
  * Example:
  *  '/app/tasks/update/email': function (email) {
  *    Users.update({_id: this.userId}, {$set: {'profile.email': email}});
  *  }
  *
  */

  'updatePriority': function(compId, priority) {
  	updTasks = Tasks.find({compId: compId});
  	count = updTasks.count();
  	fetch = updTasks.fetch()

  	Company.update({_id: compId},{
        $set: {
          priority: priority
        }
    });

  	for(var i = 0; i <= count; i++){
  		tmpPriorityAvg = ((parseInt(fetch[i].divPriority) + parseInt(priority) + parseInt(fetch[i].priority))/3);

	  	Tasks.update({_id: fetch[i]._id},{
	      $set: {
	        priorityAvg: Math.round(tmpPriorityAvg),
	        compPriority: priority
	      }
	    });


  	}
  },

  'updateDivision': function(divId, priority) {
  	updTasks = Tasks.find({divId: divId});
  	count = updTasks.count();
  	fetch = updTasks.fetch()

  	Division.update({_id: divId},{
        $set: {
          priority: priority
        }
    });

  	for(var i = 0; i <= count; i++){
  		tmpPriorityAvg = ((parseInt(priority) + parseInt(fetch[i].compPriority) + parseInt(fetch[i].priority))/3);

	  	Tasks.update({_id: fetch[i]._id},{
	      $set: {
	        priorityAvg: Math.round(tmpPriorityAvg),
	        divPriority: priority
	      }
	    });


  	}
  },

  'deleteMulti': function(multiId) {
    Tasks.remove({multiId: multiId});

    return true;
  },

  'findTaskUploads': function(taskId) {
    docs = Uploads.find({'metadata.taskId': taskId});

    return docs;
  }    


});

})();

/*(function(){



uploadStore = new FS.Store.FileSystem("uploads", {
  path: "~/tasks/public", //optional, default is "/cfs/files" path within app container
  //transformWrite: myTransformWriteFunction, //optional
  //transformRead: myTransformReadFunction, //optional
  //maxTries: 1 //optional, default 5
});

Uploads = new FS.Collection("uploads", {
  stores: [uploadStore]
});

})();

*/
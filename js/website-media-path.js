(function(scope) {
  "use strict";
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  function path(id) {return typeof id==="string" && uuid.test(id) ? "/media/"+id : "";}
  function isPath(value) {return typeof value==="string" && value.startsWith("/media/") && Boolean(path(value.slice(7)));}
  const api={path,isPath};
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  else scope.Project318MediaPath=api;
})(typeof window==="undefined"?globalThis:window);

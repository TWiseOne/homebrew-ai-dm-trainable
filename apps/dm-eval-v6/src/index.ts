const suiteIndex=process.argv.indexOf("--suite");
const suite=suiteIndex>=0?process.argv[suiteIndex+1]:"v6.1";
if(suite?.startsWith("v6.5")) await import("./v65.js");
else if(suite?.startsWith("v6.4")) await import("./v64.js");
else if(suite?.startsWith("v6.3")) await import("./v63.js");
else if(suite?.startsWith("v6.2")) await import("./v62.js");
else await import("./v61.js");

//------------------------------------------------------------------------------
// Copyright (c) 2012 IBM
// Author: Bryce Curtis
//------------------------------------------------------------------------------

//-----------------------------------------------------------------------------
// Requires
//-----------------------------------------------------------------------------

var program = require('commander');
var wrench = require('wrench');

var exec = require('child_process').exec;
var fs = require('fs');
var util  = require('util');
var spawn = require('child_process').spawn;

//-----------------------------------------------------------------------------
// Variables
//-----------------------------------------------------------------------------

var curProject = "";                // (string) current project
var isWatching = false;             // (boolean) flag that indicates if we are watching for file changes for auto-build
var cordovajsTimeout = null;        // (object) watch object for kicking off cordovajs build
var androidTimeout = null;          // (object) watch object for kicking off android build

var config = null;                  // (object) object read from config file
var init = false;                   // (boolean) init has been run
var base = null;                    // (string) base directory where repositories are located
var appDirs = null;                 // (array) list of application directories 
var gitRepos = null;                // (object) list of repositories: key=repo name, value={dir:string, uri:string, sync:boolean}

//-----------------------------------------------------------------------------
// Main screen
//-----------------------------------------------------------------------------

/**
 * Display main selection list
 */
function main() {
    if (!isWatching) {
        console.log('***************************************************************');
        console.log('* Cordova build tool.                                         *');
        console.log('* This tool helps manage development of Cordova and projects. *');
        //startWatching();
    }
    var list = ['JavaScript: Build new cordova.*.js', 
                'Android: Build cordova.js/jar', 
                'Android: Create new project',
                'Android: Create new mobile-spec project',
                'Android: Build project', 
                'Android: Run project on device or emulator', 
                'Android: Update project(s) to latest cordova.js/jar',
                'Android: Delete project',
                'Web: Create or Update Android project',
                'Web: Delete project',
                'Configure: Select repositories to download from Apache git',
                'Configure: Download repositories from Apache git',
                'Exit'];
                
    console.log('***************************************************************');
    console.log('* Choose option:');
    program.choose(list, function(i){
        var j = 0;
        if (i == j++) {
            buildCordova(main);
        }
        else if (i == j++) {
            buildAndroid(main);
        }
        else if (i == j++) {
            createAndroidProject(main);
        }
        else if (i == j++) {
            createAndroidSpecProject(main);
        }
        else if (i == j++) {
            buildAndroidProject(main);
        }
        else if (i == j++) {
            runAndroidProject(main);
        }
        else if (i == j++) {
            updateAndroidProject(main);
        }
        else if (i == j++) {
            deleteAndroidProject(main);
        }
        else if (i == j++) {
            androidProjectFromWebProject(main);
        }
        else if (i == j++) {
            deleteWebProject(main);
        }
        else if (i == j++) {
            selectCordovaRepos(main);
        }
        else if (i == j++) {
            downloadCordova(main);
        }
        else {
            process.exit(0);
        }
    });
}

//-----------------------------------------------------------------------------
// File system monitor
//-----------------------------------------------------------------------------

/**
 * Start watching for file system changes
 */
function startWatching() {
    isWatching = true;
    
    // Watch for changes to JS files in cordova-js
    try {
        var cordovajsBase = base+"/callback-js/lib";
        fs.watch(cordovajsBase, function(event, filename) {
                cordovajsTrigger();
        });
        var cordovajsFiles = wrench.readdirSyncRecursive(cordovajsBase);
        for (var i=0; i<cordovajsFiles.length; i++) {
            var path = cordovajsBase+"/"+cordovajsFiles[i];
            var stat = fs.statSync(path);
            if (stat.isDirectory()) {
                //console.log("Monitoring directory "+path);
                fs.watch(path, function(event, filename) {
                        cordovajsTrigger();
                });
            }
        }
    }
    catch (e) {
        isWatching = false;
    }
    
    // Watch for changes to cordova.jar file in Android
    try {
        var androidBase = base+"/incubator-cordova-android/framework";
        var androidFiles = fs.readdirSync(androidBase);
        for (var i=0; i<androidFiles.length; i++) {
            if (androidFiles[i].search(/^cordova\-\d\.\d\.\d\.jar$/) != -1) {
                var path = androidBase + "/" + androidFiles[i];
                //console.log("Monitoring file "+path);
                fs.watch(path, function(event, filename) {
                        androidTrigger(event);
                });
            }
        }
    }
    catch (e) {
        isWatching = false;
    }
}

/**
 * Start timer to call cordovajsChanged() after 10 sec.
 */
function cordovajsTrigger() {
    console.log("cordovajsTrigger()");
    if (cordovajsTimeout) {
        clearTimeout(cordovajsTimeout);
        cordovajsTimeout = null;
    }
    cordovajsTimeout = setTimeout(cordovajsChanged, 10000);
}

/**
 * Change to file in callback-js.
 * Kick off new build.
 */
function cordovajsChanged() {
    console.log("");
    console.log('==================================================');
    console.log("Change to cordovajs");
    console.log('==================================================');
    
    // Build new cordova.js
    buildCordova(function() {
            
            // Update Android with new cordova.js
            buildAndroid(main);
    });
}

/**
 * Start timer to call androidChanged() after 10 sec.
 */
function androidTrigger(event) {
    console.log("androidTrigger("+event+")");
    if (androidTimeout) {
        clearTimeout(androidTimeout);
        androidTimeout = null;
    }
    androidTimeout = setTimeout(androidChanged, 10000);
}

/**
 * Change to Android's cordova.jar
 */
function androidChanged() {
    console.log("");
    console.log('==================================================');
    console.log("Change to Android cordova.jar");
    console.log('==================================================');
    
    // Update Android projects that are registered to be updated
    // TODO
    
    main();
}

//-----------------------------------------------------------------------------
// Cordova-js
//-----------------------------------------------------------------------------

/**
 * Validate that everything is set up for Cordova-js
 *
 * @return boolean
 */
function validateCordovaJSEnv(success, error) {
    var cordovajsDir = base + "/" + gitRepos['cordova-js'].dir;
    if (!fileExists(cordovajsDir)) {
        console.log("Cordova-js repository is not downloaded.");
        if (error) error();
    }
    else if (success) {
        success();
    }
}

/**
 * Build cordova.js for all platforms and put in pkg
 *
 * @param callback
 */
function buildCordova(callback) {
    console.log('***************************************************************');
    console.log('* Building cordova.js...');   
    console.log('***************************************************************');

    validateCordovaJSEnv(function() {
        run('jake', [], base+"/callback-js", callback);
    }, callback);
}

//-----------------------------------------------------------------------------
// Android
//-----------------------------------------------------------------------------

/**
 * Validate that everything is set up for Android
 */
function validateAndroidEnv(success, error) {
    var passed = true;
    var androidDir = base + "/" + gitRepos['android'].dir;
    var cordovajsDir = base + "/" + gitRepos['cordova-js'].dir;
    var localProperties = base + "/" + gitRepos['android'].dir + "/framework/local.properties";
    if (!fileExists(androidDir)) {
        console.log("Android repository is not downloaded.");
        passed = false;
    }
    if (!fileExists(cordovajsDir)) {
        console.log("Cordova-js repository is not downloaded.");
        passed = false;
    }
    if (!passed) {
        if (error) error();
        return;
    }
    
    if (!fileExists(localProperties)) {
        console.log("File local.properties does not exist.");
        program.prompt('* Enter location of Android sdk (ie android-sdk-mac_86): ', function(r) {
                if (r == "") {
                    if (error) error();
                    return;
                }
                else {
                    var s1= fs.readFileSync("./android/local.properties", "ascii");
                    var s2 = s1.replace("%INPUT%", r);
                    fs.writeFileSync(localProperties, s2);
                    if (success) success();
                    return;
                }
        });
    }
    else if (success) {
        success();
    }
}

/**
 * Build cordova-x.x.x.jar and cordova-x.x.x.js for Android
 *
 * @param callback
 */
function buildAndroid(callback) {
    console.log('***************************************************************');
    console.log('* Building Cordova for Android...');
    console.log('***************************************************************');
    
    // Make sure directory exists
    var androidDir = base + "/" + gitRepos['android'].dir;
    var cordovajsDir = base + "/" + gitRepos['cordova-js'].dir;
    validateAndroidEnv(function(){

        // Copy cordova.android.js
        //copyFileSync(base+"/callback-js/pkg/cordova.android.js", base+"/incubator-cordova-android/framework/assets/js/cordova.android.js");
        copyFileSync(cordovajsDir+"/pkg/cordova.android.js", androidDir+"/framework/assets/js/cordova.android.js");
        
        // Copy cordova.android.js -> cordova-x.x.x.js
        // Create cordova-x.x.x.jar
        run("ant", ["build-javascript"], androidDir+"/framework", function() {
                run("ant", ["jar"], androidDir+"/framework", callback);                    
        });
    }, callback);
}

/**
 * Create a new Android project
 *
 * @param callback
 */
function createAndroidProject(callback) {
    console.log('***************************************************************');
    console.log('* Creating a new Android project...');
    console.log('***************************************************************');

    // Make sure directory exists
    var androidDir = base + "/" + gitRepos['android'].dir;
    var cordovajsDir = base + "/" + gitRepos['cordova-js'].dir;
    validateAndroidEnv(function() {
        
        // Ask for project name, package, program name
        program.prompt('* Enter project name: ', function(project){
                if (project == "") {
                    main(); 
                    return;
                }
                try {
                    var stats = fs.statSync(base+"/android-apps/"+project);
                    console.log("Project '"+project+"' already exists.");
                    main();
                    return;
                }
                catch (e) {
                    program.prompt('* Enter package (org.apache.cordova.'+project+'): ', function(package) {
                            if (package == "") {
                                package = "org.apache.cordova." + project;
                            }
                            program.prompt('* Enter program name ('+project+'): ', function(program) {
                                    if (program == "") {
                                        program = project;
                                    }
                                    
                                    // Create project
                                    run("bin/create", ["../android-apps/"+project, package, program], base+"/incubator-cordova-android", callback);
                            });
                    });
                }
        });
    }, callback);
}

/**
 * Create or update an Android project from mobile-spec repository
 *
 * @param callback
 */
function createAndroidSpecProject(callback) {
    console.log('***************************************************************');
    console.log('* Creating or updating a new Android mobile-spec project...');
    console.log('***************************************************************');

    // Make sure directory exists
    var androidDir = base + "/" + gitRepos['android'].dir;
    var cordovajsDir = base + "/" + gitRepos['cordova-js'].dir;
    var specDir = base + "/" + gitRepos['spec'].dir;
    validateAndroidEnv(function() {
            
            // Make sure mobile spec repo exists
            if (!fileExists(specDir)) {
                console.log("Mobile spec repository is not downloaded.");
                if (callback) callback();
                return;
            }
            curProject = "mobile-spec";
            
            // If project does not already exist, then create it
            if (!fileExists(base+"/android-apps/mobile-spec")) {
                run("bin/create", ["../android-apps/mobile-spec", "org.apache.cordova.mobiletest", "MobileTest"], base+"/incubator-cordova-android", function() {
                        createAndroidSpecProject2(callback);
                });
            }
            else {
                createAndroidSpecProject2(callback);
            }
    }, callback);
}
function createAndroidSpecProject2(callback) {
    var wwwDir = base+"/android-apps/mobile-spec/assets/www";
    var specDir = base+"/incubator-cordova-mobile-spec";
    
    // Delete existing www dir
    wrench.rmdirSyncRecursive(wwwDir, true);
    
    // Copy files into www dir
    fs.mkdirSync(wwwDir);
    wrench.copyDirSyncRecursive(specDir, wwwDir);
    
   // Find out actual cordova file names with version to use
    var jsFile = "";
    var jarFile = "";
    files = fs.readdirSync(base+"/incubator-cordova-android/framework");
    for (var i=0; i<files.length; i++) {
        if (files[i].search(/^cordova\-\d\.\d\.\d\.jar$/) != -1) {
            jarFile = files[i];
        }
    }
    files = fs.readdirSync(base+"/incubator-cordova-android/framework/assets/www");
    for (var i=0; i<files.length; i++) {
        if (files[i].search(/^cordova\-\d\.\d\.\d\.js$/) != -1) {
            jsFile = files[i];
        }
    }
    console.log("Jar file="+jarFile+" JS file="+jsFile);
    if ((jsFile == "") || (jarFile == "")) {
        console.log("Android cordova jar and js files not found.");
        if (callback) callback();
        return;
    }

    // Update cordova.js/jar in project
    copyFileSync(base+"/incubator-cordova-android/framework/"+jarFile, base+"/android-apps/mobile-spec/libs/"+jarFile);
    copyFileSync(base+"/incubator-cordova-android/framework/assets/www/"+jsFile, wwwDir+"/"+jsFile);

    // Update phonegap.js to use correct version
    var s1= fs.readFileSync(wwwDir+"/phonegap.js", "ascii");
    var s2 = s1.replace(/phonegap\-\d\.\d\.\d\.js/g, jsFile);
    console.log("s2="+s2);
    fs.writeFileSync(wwwDir+"/phonegap.js", s2);
    
    if (callback) callback();
}

/**
 * Display list of Android projects and ask which project to build
 */
function buildAndroidProject(callback) {
    console.log('***************************************************************');
    console.log('* Build Android project...');
    console.log('***************************************************************');
    
    // Make sure directory exists
    validateAndroidEnv(function() {
        
        console.log("* List of projects:");
        var files = fs.readdirSync(base+"/android-apps");
        for (var i=0; i<files.length; i++) {
            var stats = fs.statSync(base+"/android-apps/"+files[i]);
            if (stats.isDirectory()) {
                console.log("*  "+files[i]);
            }
        }
        
        if (files.length == 0) {
            console.log("No projects found.");
            if (callback) callback();
        }
        else {
            
            // Ask for project name
            var s = "";
            if (curProject) {
                s = " ("+curProject+")";
            }
            program.prompt('Enter Android project to build'+s+': ', function(project) {
                    if (project == "") {
                        if (curProject) {
                            project = curProject;
                        }
                        else {
                            if (callback) callback();
                            return;
                        }
                    }
                    curProject = project;
                    run("ant", ["debug"], base+"/android-apps/"+project, callback);
            });
        }
    }, callback);
}

/**
 * Display list of Android projects and ask which project to run
 */
function runAndroidProject(callback) {
    console.log('***************************************************************');
    console.log('* Run Android project on default device or emulator...');
    console.log('***************************************************************');
    
    // Make sure directory exists
    validateAndroidEnv(function() {
        
        console.log("* List of projects:");
        var files = fs.readdirSync(base+"/android-apps");
        for (var i=0; i<files.length; i++) {
            var stats = fs.statSync(base+"/android-apps/"+files[i]);
            if (stats.isDirectory()) {
                console.log("*  "+files[i]);
            }
        }
        
        if (files.length == 0) {
            console.log("No projects found.");
            if (callback) callback();
        }
        else {
            
            // Ask for project name
            var s = "";
            if (curProject) {
                s = " ("+curProject+")";
            }
            program.prompt('Enter Android project to run'+s+': ', function(project) {
                    if (project == "") {
                        if (curProject) {
                            project = curProject;
                        }
                        else {
                            if (callback) callback();
                            return;
                        }
                    }
                    curProject = project;
                    run("cordova/debug", [], base+"/android-apps/"+project, callback);
            });
        }
    }, callback);
}

/**
 * Copy new cordova.js and cordova.jar from Android.
 */
function updateAndroidProject(callback) {
    console.log('***************************************************************');
    console.log('* Update Android project...');
    console.log('***************************************************************');
    
    // Make sure directory exists
    validateAndroidEnv(function() {
        
        console.log("* List of projects:");
        var projects = [];
        var files = fs.readdirSync(base+"/android-apps");
        for (var i=0; i<files.length; i++) {
            var stats = fs.statSync(base+"/android-apps/"+files[i]);
            if (stats.isDirectory()) {
                console.log("*  "+files[i]);
                projects.push(files[i]);
            }
        }
        if (projects.length == 0) {
            console.log("No projects found.");
            if (callback) callback();
        }
        else {
            
            // Find out actual cordova file names with version to use
            var jsFile = "";
            var jarFile = "";
            files = fs.readdirSync(base+"/incubator-cordova-android/framework");
            for (var i=0; i<files.length; i++) {
                if (files[i].search(/^cordova\-\d\.\d\.\d\.jar$/) != -1) {
                    jarFile = files[i];
                }
            }
            files = fs.readdirSync(base+"/incubator-cordova-android/framework/assets/www");
            for (var i=0; i<files.length; i++) {
                if (files[i].search(/^cordova\-\d\.\d\.\d\.js$/) != -1) {
                    jsFile = files[i];
                }
            }
            console.log("Jar file: "+jarFile+"  JS file: "+jsFile);
            if ((jsFile == "") || (jarFile == "")) {
                console.log("Android cordova jar and js files not found.");
                if (callback) callback();
                return;
            }
            
            // Ask for project name
            program.prompt('* Enter Android project to update (blank to update all): ', function(project) {
                    if (project != "") {
                        projects = [project];
                    }
                    for (var i=0; i<projects.length; i++) {
                        console.log("Updating project "+projects[i]+"...");
                        
                        // Delete existing versions of cordova.js/jar
                        // TODO
                        
                        // Update cordova.js to use jsFile inside *.html files
                        // TODO
                        
                        // Copy in new versions
                        copyFileSync(base+"/incubator-cordova-android/framework/"+jarFile, base+"/android-apps/"+projects[i]+"/libs/"+jarFile);
                        copyFileSync(base+"/incubator-cordova-android/framework/assets/www/"+jsFile, base+"/android-apps/"+projects[i]+"/assets/www/"+jsFile);
                    }
                    if (callback) callback();
            });    
        }
    }, callback);
}

/**
 * Delete an Android project
 */
function deleteAndroidProject(callback) {
    console.log('***************************************************************');
    console.log('* Delete Android project...');
    console.log('***************************************************************');

    // Make sure directory exists
    validateAndroidEnv(function() {
        
        console.log("* List of projects:");
        var projects = [];
        var files = fs.readdirSync(base+"/android-apps");
        for (var i=0; i<files.length; i++) {
            var stats = fs.statSync(base+"/android-apps/"+files[i]);
            if (stats.isDirectory()) {
                console.log("*  "+files[i]);
                projects.push(files[i]);
            }
        }
        
        if (projects.length == 0) {
            console.log("No projects found.");
            if (callback) callback();
        }
        else {
            
            program.prompt('* Enter project to delete: ', function(project) {
                    if (project == "") {
                        if (callback) callback();
                        return;
                    }
                    
                    // Make sure it's one in the list
                    var found = false;
                    for (var i=0; i<projects.length; i++) {
                        if (projects[i] == project) {
                            found = true;
                            break;
                        }
                    }
                    
                    if (!found) {
                        console.log("Project '"+project+"' not found.");
                        if (callback) callback();
                        return;
                    }
                    else {           
                        program.prompt("* Are you sure you want to delete project '"+project+"'? (y/n): ", function(r) {
                                if (r == "y") {
                                    console.log("Deleting project '"+project+"'.");   
                                    wrench.rmdirSyncRecursive(base+"/android-apps/"+project, true);
                                }
                                if (callback) callback();
                                return;
                        });
                    }
            });
        }
    }, callback);
}

/**
 * Create or update a new Android project from a web project
 */
function androidProjectFromWebProject(callback) {
    console.log('***************************************************************');
    console.log('* Creating or updating Android project from web project...');
    console.log('***************************************************************');
    
    // Make sure directory exists
    validateAndroidEnv(function() {
        
        console.log("* List of projects:");
        var projects = [];
        var files = fs.readdirSync(base+"/web-apps");
        for (var i=0; i<files.length; i++) {
            var stats = fs.statSync(base+"/web-apps/"+files[i]);
            if (stats.isDirectory()) {
                console.log("*  "+files[i]);
                projects.push(files[i]);
            }
        }
        
        // Ask for project name
        program.prompt('* Enter web project to create or update: ', function(project) {
                if (project == "") {
                    if (callback) callback();
                    return;
                }
                
                // If web project doesn't exist, then create it
                var projectDir = base+"/web-apps/"+project;
                try {
                    fs.statSync(projectDir);
                }
                catch (e) {
                    fs.mkdirSync(projectDir);
                    wrench.copyDirSyncRecursive('template', projectDir);
                }
                
                // If dest Android project doesn't exist, then create it
                try {
                    var stats = fs.statSync(base+"/android-apps/"+project);
                    console.log("Updating project '"+project+"'.");
                    try {
                        androidProjectFromWebProject2(project);
                    } catch (e) {
                        console.log("Error: "+e);
                        main();
                    }
                    return;
                }
                catch (e) {
                    console.log("Creating project '"+project+"'.");
                    program.prompt('* Enter package (org.apache.cordova.'+project+'): ', function(package) {
                            if (package == "") {
                                package = "org.apache.cordova." + project;
                            }
                            program.prompt('* Enter program name ('+project+'): ', function(program) {
                                    if (program == "") {
                                        program = project;
                                    }
                                    run("bin/create", ["../android-apps/"+project, package, program], base+"/incubator-cordova-android", 
                                        function() {
                                            androidProjectFromWebProject2(project);
                                        });                        
                            });
                    });
                }
        });
    }, callback);
}

function androidProjectFromWebProject2(project) {
    var webDir = base+"/web-apps/"+project;
    var androidDir = base+"/android-apps/"+project;
    var androidWWWDir = androidDir + "/assets/www";
    
    // Update HTML content in Android project
    // (only update files that have changed or deleted)
    var androidFiles = wrench.readdirSyncRecursive(androidWWWDir);
    var webFiles = wrench.readdirSyncRecursive(webDir);
    //console.log("android="+androidFiles);
    //console.log("web="+webFiles);
    
    // Get file stats for each file in Android project
    var androidFileStats = {};
    for (var i=0; i<androidFiles.length; i++) {
        androidFileStats[androidFiles[i]] = fs.statSync(androidWWWDir+"/"+androidFiles[i]);
    }
    
    // Look at each file in web project
    for (var i=0; i<webFiles.length; i++) {
        //console.log("Looking at "+webFiles[i]);
        var webStats = fs.statSync(webDir+"/"+webFiles[i]);
        var androidStats = androidFileStats[webFiles[i]];
        //console.log("webStats="+webStats.mtime.getTime()+" androidStats="+androidStats.mtime.getTime());
        var copy = false;
               
        // If not found Android project, then copy
        if (androidStats == null) {
            copy = true;
        }
        
        // If found, then if not same date & size
        else {
            if (webStats.isFile()) {
                if (androidStats.size != webStats.size) {
                    copy = true;
                }
                else if (androidStats.mtime.getTime() != webStats.mtime.getTime()) {
                    copy = true;
                }
            }
        }
        
        if (copy) {
            
            // If file, then copy file
            if (webStats.isFile()) {
                console.log("copyFileSync("+webDir+"/"+webFiles[i], androidWWWDir+"/"+webFiles[i]+")");
                copyFileSync(webDir+"/"+webFiles[i], androidWWWDir+"/"+webFiles[i]);
            }
            
            // If dir, then create dir
            else {
                console.log("createDir("+androidWWWDir+"/"+webFiles[i]+")");
                wrench.mkdirSyncRecursive(androidWWWDir+"/"+webFiles[i]);
            }
        }
        delete androidFileStats[webFiles[i]];
    }

    // Find out actual cordova file names with version to use
    var jsFile = "";
    var jarFile = "";
    files = fs.readdirSync(base+"/incubator-cordova-android/framework");
    for (var i=0; i<files.length; i++) {
        if (files[i].search(/^cordova\-\d\.\d\.\d\.jar$/) != -1) {
            jarFile = files[i];
        }
    }
    files = fs.readdirSync(base+"/incubator-cordova-android/framework/assets/www");
    for (var i=0; i<files.length; i++) {
        if (files[i].search(/^cordova\-\d\.\d\.\d\.js$/) != -1) {
            jsFile = files[i];
        }
    }
    console.log("Jar file="+jarFile+" JS file="+jsFile);
    if ((jsFile == "") || (jarFile == "")) {
        console.log("Android cordova jar and js files not found.");
        main();
        return;
    }
    var sameCordovaVersion = false;
    
    // Delete old files in Android project, including old versions of cordova.js
    for (var i in androidFileStats) {
        if (i == jsFile) {
            sameCordovaVersion = true;
        }
        else {
            console.log("Deleting old file from Android project = " + i);
            fs.unlinkSync(androidWWWDir+"/"+i)
        }
    }

    // Delete old cordova.jar
    files = fs.readdirSync(androidDir+"/libs");
    for (var i=0; i<files.length; i++) {
        if (files[i] != jarFile) {
            console.log("Deleting old "+files[i]+" library from Android project.");
            fs.unlinkSync(androidDir+"/libs/"+files[i]);            
        }
    }

    // Update cordova.js/jar in Android project
    // (Always do this, since during development, we may have a new cordova.js/jar with same version number)
    copyFileSync(base+"/incubator-cordova-android/framework/"+jarFile, androidDir+"/libs/"+jarFile);
    copyFileSync(base+"/incubator-cordova-android/framework/assets/www/"+jsFile, androidWWWDir+"/"+jsFile);


    // Update cordova.js in HTML files
    if (!sameCordovaVersion) {
        console.log("Updating cordova version in HTML files...");
    
    
        // Update cordova.js to use jsFile inside *.html files
        // TODO
    }
    
    // Build Android project
    curProject = project;
    //run("cordova/debug", [], androidDir, main);
    run("ant", ["debug"], androidDir, main);

}

/**
 * Delete web project
 */
function deleteWebProject(callback) {
    console.log('***************************************************************');
    console.log("* Delete Web project...");
    console.log('***************************************************************');
    
    console.log("* List of projects:");
    var projects = [];
    var files = fs.readdirSync(base+"/web-apps");
    for (var i=0; i<files.length; i++) {
        var stats = fs.statSync(base+"/web-apps/"+files[i]);
        if (stats.isDirectory()) {
            console.log("* "+files[i]);
            projects.push(files[i]);
        }
    }

    if (projects.length == 0) {
        console.log("No projects found.");
        if (callback) callback();
    }
    else {
        
        program.prompt('* Enter project to delete: ', function(project) {
                if (project == "") {
                    if (callback) callback();
                    return;
                }
                
                // Make sure it's one in the list
                var found = false;
                for (var i=0; i<projects.length; i++) {
                    if (projects[i] == project) {
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    console.log("Project '"+project+"' not found.");
                    if (callback) callback();
                    return;
                }
                else {           
                    program.prompt("* Are you sure you want to delete project '"+project+"'? This will delete web project and Android project. (y/n): ", function(r) {
                            if (r == "y") {
                                console.log("Deleting project '"+project+"'.");   
                                wrench.rmdirSyncRecursive(base+"/web-apps/"+project, true);
                                wrench.rmdirSyncRecursive(base+"/android-apps/"+project, true);
                            }
                            if (callback) callback();
                            return;
                    });
                }
        });
    }
}

//-----------------------------------------------------------------------------
// Apache GIT repository management
//-----------------------------------------------------------------------------

/**
 * Select cordova repositories to download from Apache git
 */
 function selectCordovaRepos(callback) {
     
     // Ask user to select which repositories to keep sync
     configReposPrompt(function() {
             
             // Ask if user wants to download repositories now
             console.log('***************************************************************');
             program.prompt('* Do you want to download (y/n)?: ', function(r) {
                     config.save();
                     //saveConfig();
                     
                     // If not, return
                     if (r != 'y') {
                         if (callback) {
                             callback();
                         }
                     }
                     
                     // If so, then create dirs and download
                     else {   
                         wrench.mkdirSyncRecursive(base);
                         downloadCordova(function() {
                                 config.set("init", true);
                                 //saveConfig();
                                 if (callback) {
                                     callback();
                                 }
                         });
                         
                     }
             });
     });
 }

/**
 * Download cordova repositories into correct directories so this tool can be used.
 * If repositories are already created, then it does an update
 */
function downloadCordova(callback) {
    console.log('***************************************************************');
    console.log("* Downloading Cordova from Apache GIT server...");
    console.log('***************************************************************');
    
    // Create dirs if not already there
    for (var i=0; i<appDirs.length; i++) {
        try {
            fs.statSync(base+"/"+appDirs[i]);
            console.log("Dir "+base+"/"+appDirs[i]+" already exists.");
        }
        catch (e) {
            fs.mkdirSync(base+"/"+appDirs[i]);
            console.log("Creating dir "+base+"/"+appDirs[i]);
        }
    }
    
    // Download code from repositories
    downloadCordovaRepository(new Iterator(gitRepos), function() {
                        
            if (callback) {
                callback();
            }
    });
}

/**
 * Download cordova repository
 *
 * @param iterator
 * @param completeCallback
 */
function downloadCordovaRepository(iterator, completeCallback) {
    //console.log("downloadCordovaCallback()");
    
    // If not done
    if (iterator.hasMore()) {
        var repo = iterator.next();
        if (repo.sync) {
            
            // If repo already exists, then "git pull"
            try {
                fs.statSync(base+"/"+repo.dir);
                console.log("Updating repository "+repo.dir);
                run("git", ["pull", "origin", "master"], base+"/"+repo.dir, function() {
                        downloadCordovaRepository(iterator, completeCallback);
                });
            }
            
            // If repo doesn't exist, then "git clone"
            catch (e) {
                console.log("Creating repository "+repo.dir);
                run("git", ["clone", repo.uri], base, function() {
                        downloadCordovaRepository(iterator, completeCallback);
                });
            }
        }
        else {
            downloadCordovaRepository(iterator, completeCallback);
        }
    }
    
    // If done
    else {
        if (completeCallback) {
            completeCallback();
        }
    }    
}

//-----------------------------------------------------------------------------
// Helper functions
//-----------------------------------------------------------------------------

/**
 * Copy file synchronously
 *
 * @param srcFile
 * @param destFile
 */
function copyFileSync(srcFile, destFile) {
    var LENGTH = 1024;
    var buffer = new Buffer(LENGTH);
    
    // Open files
    var fdr = fs.openSync(srcFile, 'r');
    var fdw = fs.openSync(destFile, 'w');
    
    // Read all bytes
    var bytesRead = 1;      // bytes read in to buffer
    var pos = 0;            // total number of bytes read
    while (bytesRead > 0) {
        bytesRead = fs.readSync(fdr, buffer, 0, LENGTH, pos);
        fs.writeSync(fdw, buffer, 0, bytesRead);
        pos += bytesRead;
    }
    
    // Set times of dest to be same as src
    fstat = fs.fstatSync(fdr);
    fs.futimesSync(fdw, fstat.atime, fstat.mtime);
    
    // Close files
    fs.closeSync(fdr);
    fs.closeSync(fdw);
}

/**
 * Copy directory synchronously
 *
 * @param srcDir
 * @param destDir
 */
//function copyDirSync(srcDir, destDir) {
//}


/**
 * Determine if file exists
 *
 * @param path
 * return boolean
 */
function fileExists(path) {
    try {
        fs.statSync(path);
        return true;
    }
    catch (e) {
    }
    return false;
}

/**
 * Run command
 *
 * @param cmd           Program to run
 * @param args          Array of arguments
 * @param cwd           directory
 * @param callback      Optional callback
 */
function run(cmd, args, cwd, callback) {
    console.log('***************************************************************');
    console.log("* Execute '"+cmd+"':");
    console.log('***************************************************************');
    var util  = require('util');
    var spawn = require('child_process').spawn;
    ls    = spawn(cmd, args, {cwd: cwd});
    ls.stdout.on('data', function (data) {
            console.log(''+data);
    });
    ls.stderr.on('data', function (data) {
            console.log(""+data);
    });
    ls.on('exit', function (code) {
            console.log('Exit code: ' + code);
            if (callback) {
                callback();
            }
    });
}

/**
 * Object iterator
 *
 * @param obj
 */
function Iterator(obj) {
    this.index = 0;
    this.indexes = [];
    this.object = obj;
    this.key = null;
    this.value = null;
    for (var i in obj) {
        this.indexes.push(i);
    }
    this.next = function() {
        if (this.index < this.indexes.length) {
            this.key = this.indexes[this.index];
            this.value = this.object[this.key];
            this.index++;
            return this.value;
        }
        else {
            return null;
        }
    };
    this.hasMore = function() {
        if (this.index < this.indexes.length) {
            return true;
        }
        else {
            return false;
        }
    };
    this.getKey = function() {
        return this.key;
    };
    this.getValue = function() {
        return this.value;
    };
}

//-----------------------------------------------------------------------------
// Configuration
//-----------------------------------------------------------------------------

/**
 * Configuration object
 */
function Configuration() {
    this.data = null;
        
    // Save configuration
    this.save = function() {
        //config.data.init = init;
        //config.data.base = base;
        //config.data.appDirs = appDirs;
        //config.data.gitRepos = gitRepos;
        
        var s = JSON.stringify(config.data);
        fs.writeFileSync('./config.json', s);
        
    };
    
    // Load configuration
    this.load = function() {
        
        // If first time, then copy config.orig into config.json
        try {
            fs.statSync('./config.json');
        }
        catch (e) {
            copyFileSync('./config.orig', './config.json');
        }
        
        this.data = JSON.parse(fs.readFileSync('./config.json', 'ascii'));
    };
    
    // Set configuration value
    this.set = function(name, value) {
        this.data[name] = value;
        this.save();
    };
    
    // Retrieve configuration value
    this.get = function(name) {
        return this.data[name];
    };
};

/**
 * Save configuration to config.json
 */
 /*
function saveConfig() {
    config.init = init;
    config.base = base;
    config.appDirs = appDirs;
    config.gitRepos = gitRepos;

    var s = JSON.stringify(config);
    fs.writeFileSync('./config.json', s);
}
*/

/**
 * User selects which repositories to download
 *
 * @param callback
 */
function configReposPrompt(callback) {
    console.log('***************************************************************');
    console.log('* Cordova build tool.                                         *');
    console.log('* This tool helps manage development of Cordova and projects. *');
    console.log('***************************************************************');
    console.log('* Configuration:                                              *');
    console.log('***************************************************************');
    
    program.prompt('* Base directory ('+base+'): ', function(r){
            if (r != "") {
                base = r;
                config.set("base", base);
            }
            configReposPromptItem(new Iterator(gitRepos), callback);
    });
}

/**
 * Show individual user prompts for repos
 *
 * @param iterator
 * @param callback
 */
function configReposPromptItem(iterator, callback) {
    if (iterator.hasMore()) {
        repoObj = iterator.next();
        repoKey = iterator.key;
        var s = repoObj.sync ? 'y' : 'n';
        program.prompt('* Download '+repoKey+' (default='+s+') (y/n)? ', function(r) {
                if (r == '') {
                }
                else if (r != 'y') {
                    repoObj.sync = false;
                }
                else {
                    repoObj.sync = true;
                }
                
                configReposPromptItem(iterator, callback);
        });
    }
    else if (callback) {
        callback();
    }
}

//-----------------------------------------------------------------------------
// Run application
//-----------------------------------------------------------------------------

/*
// If first time, then copy config.orig into config.json
try {
    fs.statSync('./config.json');
}
catch (e) {
    copyFileSync('./config.orig', './config.json');
}

// Load configuration
//config = JSON.parse(fs.readFileSync('./config.json', 'ascii'));
*/
config = new Configuration();
config.load();
init = config.get("init");
base = config.get("base");
appDirs = config.get("appDirs");
gitRepos = config.get("gitRepos");
console.log("init="+init);

// Display main list
try {
    if (!init) {
        throw('force init');
    }
    fs.statSync(base);
    main();
}

// If base dir not there or first run, then set up
catch (e) {
    configReposPrompt(function() {
            program.prompt('* Do you want to run configuration (y/n)?: ', function(r) {
                    if (r != 'y') {
                        console.log("Goodbye.");
                        process.exit(0);
                    }
                    else {
                        //saveConfig();
                        config.save();
                        wrench.mkdirSyncRecursive(base);
                        downloadCordova(function() {
                                config.set("init", true);
                                //saveConfig();
                                main();
                        });
                    }
            });
    });
}


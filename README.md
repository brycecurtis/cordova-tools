Cordova Tools
===

This is a Cordova development tool that helps build and manage Cordova builds and Cordova applications.
It can:

- Download Apache GIT repositories from server
- Build cordova-js for all platforms
- Build Android cordova.js and cordova.jar files
- Create, build and run Android applications
- Create, build and run Android mobile-spec for testing
- Create Android applications from a web directory


It is written using Node.js.


Requires
---

- Node.js
- npm commander (included)
- npm wrench (included)


Installing
---

- Install Node.js
- Copy program files in their own directory.

Running
---

Enter 'node cordova.js' at command line

The first time you run, the installation screen will display:

    ***************************************************************
    * Cordova build tool.                                         *
    * This tool helps manage development of Cordova and projects. *
    ***************************************************************
    * Configuration:                                              *
    ***************************************************************
    * Base directory (cordova): 
    * Download cordova-js (default=y) (y/n)? 
    * Download android (default=y) (y/n)? 
    * Download bada (default=n) (y/n)? 
    * Download blackberry (default=n) (y/n)? 
    * Download docs (default=y) (y/n)? 
    * Download ios (default=y) (y/n)? 
    * Download mac (default=n) (y/n)? 
    * Download spec (default=y) (y/n)? 
    * Download qt (default=n) (y/n)? 
    * Download webos (default=n) (y/n)? 
    * Download weinre (default=y) (y/n)? 
    * Download wp7 (default=y) (y/n)? 
    * Do you want to run configuration (y/n)?: 
    
This will create the base directory where all of the selected repositories will be downloaded.

Once installation is completed, the main menu screen will display:

    ***************************************************************
    * Cordova build tool.                                         *
    * This tool helps manage development of Cordova and projects. *
    ***************************************************************
    * Choose option:
    1) JavaScript: Build new cordova.*.js
    2) Android: Build cordova.js/jar
    3) Android: Create new project
    4) Android: Create new mobile-spec project
    5) Android: Build project
    6) Android: Run project on device or emulator
    7) Android: Update project(s) to latest cordova.js/jar
    8) Android: Delete project
    9) Web: Create or Update Android project
    10) Web: Delete project
    11) Configure: Select repositories to download from Apache git
    12) Configure: Download repositories from Apache git
    13) Exit

Enter 1 to build Cordova-js.

Enter 2 to build cordova.js/jar.  You will be asked where your Android sdk is installed.
After that, Cordova for Android will be built.  Then you can create new Android projects.


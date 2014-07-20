## DESCRIPTION 

A simple **one line** configuration API that combines properties from:
 
- System settings file
- User settings file
- Command line options 
- Application overrides

*All of these are optional.*	

### Design & Features:

  - Although usable in any node package, the API is primarily designed for command line interfaces.
  - Configuration files and command line options use one schema defined in your package `defaults.config` file.
  - Add comments in your `defaults.config` file so the user can understand how to configure their local copy.
  - If you set the `clone: true` flag, it creates an initial user settings file in `~/.<appname>.config` copied from the package `defaults.config` file
  - When users settings file is create it will initially override all the options in the `default.config` file it was copied from, however we still perform a merge with `defaults.config` since a future upgrade of your app may add new properties that will need to be defaulted via your new `default.config` file.
  - To support future upgrades of the user settings file, it's recommended that your `defaults.config` file includes a `_schema` property set to the current schema version number so future versions of your app can detect that the user settings file is out of date and may need to be upgraded.

### Examples:

Combine configuration options from package file `defaults.config` then `~/.<appname>.config` then command line options then force the `debug` option to be `true`.  Uses a shallow merge so only the top level properties are merged.  

	var config = require('../cli-config').getConfig({dirname: __dirname}, {debug: true});
	
Deep merge nested configuration settings from package `defaults.config` then `./config.json` then command line options.  If `./config.json` does not exist, clone a copy from `defaults.config` so the user can use it to override `defaults.config` in the future.

	var config = require('../cli-config').getConfig({
		dirname: __dirname,          // Looks for system wide defaults.config in this package folder
		clone: true,                 // Creates a ./config.json if none exists. 
		configFile: './config.json', // Keep user settings here rather than the default ~/.<appname>.config
		merge: 'deep'                // Deep merge all config file settings & command line settings.
	});

The command line parser returns an object that can be used to override the system settings or user settings options.  You can configure this parser using the **cli** option.  Refer to [minimist](https://github.com/substack/minimist) for more details about command line parsing options.

	var config = require('../cli-config').getConfig({
		dirname: __dirname,
		cli: { 
			boolean: {
				'd': 'debug',
				'v': 'verbose'
			} 
		} 
	});
	
Sets the config.debug and config.verbose options to true.

	$ myapp -d -v     

## API

    var config = require('cli-config').getConfig(options, override);

### Options:

  - `[options]` {Object}
    - `[cli]`			{Object} Command line interface parsing options.  Refer to [minimist](https://github.com/substack/minimist) documentation.
    - `[configFile]`	{String} Local configuration file name. (default: `~/.<appname>.config`).
    - `[clone]`			{Boolean} If `true`, copies package `defaults.config` file to local configuration file. (default: `false`).
    - `[merge]`			{String} Merge attributes using `'shallow'` or `'deep'` recursive merging (default: `'shallow'`).
  - `[override]`		{Object} Optional final override to other configuration properties.  (default: `null`) 

**.config** files are parsed as UTF8 JSON format that can contain `//` or `/* ... */` comments.

### Returns:

  - {Object} A configuration object based on merging attributes in the following order:
    1. Package defaults (`defaults.config` JSON file from the `dirname` folder).
    1. Local configuration file (`configFile` JSON file that defaults to `~/.<appname>.config`).
    1. Command line arguments parsed by [minimist](https://github.com/substack/minimist). 
    1. An optional `override` object from your application. 

*All of these are optional.*
	

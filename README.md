## DESCRIPTION 

A simple **one line** configuration API that combines configuration object properties from:
 
- System configuration file,
- User configuration file, 
- Command line options 
- Application overrides.

Optionally creates an initial user config file cloned from the `defaults.config` defined in your node package.

### Examples:

Combine configuration options from package file `defaults.config` then `~/.<appname>.config` then command line options then force the `debug` option to be `true`.  Uses a shallow merge so only the top level properties are merged.  

	var config = require('../cli-config').getConfig({dirname: __dirname}, {debug: true});
	
Deep merge nested configuration options from package `defaults.config` then `./myapp.config` then command line options.  If `myapp.config` does not exist, clone a copy of `defaults.config` into `./myapp.config` so the user can use it to override `defaults.config` in the future.

	var config = require('../cli-config').getConfig({
		dirname: __dirname,
		clone: true,
		configFile: 'myapp.config',
		merge: 'deep'
	});

The command line parser returns a configuration object can be used to override the system default or local config file options.  You can configure this parser using the **cli** option.  

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

Refer to [minimist](https://github.com/substack/minimist) for more details about command line parsing options.
	
### Design and Usage Recommendations:

  - Although usable in libaries, the API is primarily designed for command line interfaces installed globally.
  - Add comments in your `defaults.config` file so the user can understand how to configure their local copy.
  - If the `clone` option is set, a local ~/.<appname>.config file is created that will initially replace all the options in the `default.config` file it was copied from. We still perform a merge with it since a future upgrade of your app may add new attributes that will need to be defaulted via the new `default.config` file.
  - To support furture upgrades of the local config file, it's recommended that the defaults.config file includes a _schema property set to the current schema version number.
## API

    var config = require('cli-config').getConfig(options, override);

### Options:

  - `[options]` {Object}
    - `[cli]`			{Object} Command line interface parsing options.  Refer to [minimist](https://github.com/substack/minimist) documentation.
    - `[configFile]`	{String} Local configuration file name. (default: `~/.<appname>.config`).
    - `[clone]`			{Boolean} If `true`, copies package `defaults.config` file to local configuration file. (default: `false`).
    - `[merge]`			{String} Merge attributes using `'shallow'` or `'deep'` recursive merging (default: `'shallow'`).
  - `[override]`		{Object} Optional final override to other configuration properties.  (default: `null`) 

**.config** files are UTF8 JSON format that can contain `//` or `/* ... */` comments.

### Returns:

  - {Object} A configuration object based on merging attributes in the following order:
    1. Package defaults (`defaults.config` JSON file from the `dirname` folder).
    1. Local configuration file (`configFile` JSON file that defaults to `~/.<appname>.config`).
    1. Command line arguments parsed by [minimist](https://github.com/substack/minimist). 
    1. An optional `override` object from your application. 

	*All of these are optional.*
	

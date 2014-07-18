## DESCRIPTION 

A dead simple **one line** configuration API that combines:
 
- package defaults.config file,
- local .config file, 
- command line options 
- application overrides.  

You can also optionally create a local .config file based on the `defaults.config` defined in you node package.

## API

    var config = require('cli-config')(options, override);

### Options:

  - `[options]` {Object}
    - `[dirname]`		{String} Directory containing `defaults.config` JSON file used to read package defaults. Normally `__dirname` from calling script.
    - `[configFile]`	{String} Local configuration file name. (default: `./<appname>.config`).
    - `[clone]`	    	{Boolean} If `true`, copies package `defaults.config` file to local configuration file. (default: `false`).
    - `[merge]`			{String} Merge attributes using `'shallow'` or `'deep'` recursive merging (default: `'shallow'`).
  - `[override]`		{Object} Optional final override to other configuration properties.  (default: `null`) 

**.config** files are UTF8 JSON format that can contain `//` or `/* ... */` comments.

### Returns:

  - {Object} A configuration object based on merging attributes in the following order:
    1. Package defaults (`defaults.config` JSON file in the `dirname` folder).
    1. Local configuration file (`configFile` JSON file that defaults to `./<appname>.config`).
    1. Command line arguments parsed by [minimist](https://github.com/substack/minimist). 
    1. An optional `override` object from your application. 

	*All of these are optional.*
	
## Examples:

Combine configuration options from package file `defaults.config` then `./<appname>.config` then command line options then force the `debug` option to be `true`.  Use a shallow merge so only the top level properties are merged.  

	var config = require('../cli-config')({dirname: __dirname}, {debug: true });
	
Deep merge nested configuration options from package `defaults.config` then `./myapp.config` then command line options.  If `myapp.config` does not exist, clone a copy of `defaults.config` into `./myapp.config` so the user can use it to override `defaults.config` in the future.

	var config = require('../cli-config')({
		dirname: __dirname,
		clone: true,
		configFile: 'myapp.config',
		merge: 'deep'
	});

The configuration object returned by [minimist](https://github.com/substack/minimist) command line parser can be used to override the default or local config file options.

## Design Features:

  - Supports comments to your `defaults.config` file so the user can understand how to configure their local copy.
  - Even though the local config file will initially replace all the options in the `default.config` file, we still perform a merge with it since a future upgrade of your app may add new attributes that will need to be defaulted in the package `default.config` file.

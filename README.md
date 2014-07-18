## DESCRIPTION 
	
Simple one line API to manage all configuration file and command line options.

  - Optionally clone a local config file for each app based on defaults.js defined in node package.
  - JSON configuration files support comments.


## API

    var override = { a:1, verbose: true };
    config = require('cli-config')({ dirname: __dirname, clone: true }, override);

### phonegap()

Options:

  - `[options]` {Object}
    - `[dirname]`		{String} Directory containing `defaults.json` file used to read package defaults.
    - `[configFile]`	{String} Local configuration file used by application. (default: `<appname>.json`)
    - `[clone]`	    	{Boolean} If `true`, copies `defaults.json` file to local configuration file. (default: `false`).
  - `[config]`			{Object} Override other configuration file values.  (default: `null`) 

Return:

  - {Object} Configuration object based on options applied in order of precedence from ...      
    1. Command line arguments (See [https://github.com/substack/minimist](https://github.com/substack/minimist) )
    2. `<appname>.json`
    3. `defaults.json` 
    4. `config` Object.

Example:

	var override = { debug: true };
	var config = require('../cli-config')({dirname: __dirname, clone: true});

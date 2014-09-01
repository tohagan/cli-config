## DESCRIPTION

A simple `getConfig()` call that combines properties from ...

- System settings file
- User settings file
- Settings files in current and ancestors directories
- A configuration environment variable
- Command line options
- Application overrides
- Application `package.json` fields
- Assumes it's called once on start up and so uses synchronous calls and exceptions to report errors.

If your app uses commands verbs you can implement your entire command line interface using a single `run()` method  that ...

- Calls `getConfig()` and then finds your command function from a command tree object and executes it.
  - Rapidly build your command tree based on functions exported by your modules.
  - Command functions accept a single `config` argument returned by `getConfig()`.

## Simplest API calls:

This might be all you need to create a complete command line interface to your lib:

    #!/usr/bin/env node
    require('cli-config').run({dirname: __dirname, cmdTree: require(__dirname + '/lib'});

If you only need to fetch configuration and command line options:

    var config = require('cli-config').getConfig({dirname: __dirname});

### Design & Features:

  - Although usable in any node package, the API is primarily designed for command line interfaces.
  - Merges settings from multiple configuration files and command line options.
    - **NOTE**: As of v0.4.0, All settings files are named `.<appname>.json` where `<appname>` is the appname defined in `package.json`.
    - Settings files can be in package, home, current or ancestor directories.
    - Optionally merge settings from environment variable containing serialised JSON (used for cloud deployment).
    - Optionally override final settings.
  - Selects a command function to execute based on command line verbs that select a function from a command tree object.
    - Tree = Nested hash objects with values as functions - easily exported from a lib or created from multiple modules.
  - Detects schema changes in local settings files after users upgrade your app.
    - Reports if schema version number has changed.
    - Reports if a property name is no longer supported.
    - Reports if invalid command line option is used.
  - BYO Parser: You can *bring your own* parser to support YAML, Coffee Script or any other file format 
    - You can change the settings file name to use a different file extension.

### Details:

  - Settings files and command line options use the schema defined in the package settings file (default: `.<appname>.json`).
    - If `clone: true`, creates an initial user settings file in user's home directory copied from the package settings file.     
    - Add comments in your package settings file so users can understand how to configure their local copies.
    - When the users' settings file is create, it will initially override all the options in the home file it was copied from, however we still perform a merge with the package settings since a future upgrade of your app as it may add new properties.
`.stlive.json` file that ships in the root directory of your app.
  - To support future upgrades of the user settings file, it's recommended that your package settings file includes a `_schema` property set to the current schema version number so future versions of your app can detect that the user settings schema is out of date and they may need to be migrate to the new schema.

# API

## getConfig(options)

Returns configuration settings object.

    var config = require('cli-config').getConfig(options);

### Options:

  - `[options]` {Object}
    - `[dirname]`       Root directory of your app package.  Required to find `package.json` and package settings file.
    - `[cli]`           {Object} Command line interface parsing options.  Refer to [minimist](https://github.com/substack/minimist) documentation.
    - `[clone]`         {Boolean} If `true`, copies package settings file to users home directory. (default: `false`).
    - `[merge]`         {String} Merge attributes using `'shallow'` or `'deep'` recursive merging (default: `'shallow'`).
    - `[configFile]`    {String} Settings file name. (default: `.<appname>.json`).
    - `[ancestors]`     {String} or {Boolean} If truthy, Searches current & ancestor directories for config files (default `false`)
      - If a string, `ancestors` options defines the settings file name searched for in current and ancestory directories.
    - `[env]`           {String} If set, merges config properties from a named environment variable containing serialised config object.
    - `[override]`      {Object} Optional final override to other configuration properties.  (default: `null`)

**.json** files are parsed as UTF8 JSON format that can contain `//` or `/* ... */` comments.

### Returns:

  - {Object} A settings object based on merging attributes in the following sequence: 
    1. Package settings file (from the `options.dirname` folder).
    1. User settings file (in user's home directory).
    1. Project or Project group settings file (current or any ancestor directory).
    1. Environment variable containing serialized JSON object (`options.env`) 
    1. Command line arguments parsed by [minimist](https://github.com/substack/minimist).
    1. An optional override object (`options.override`).
  - Add a `obj._pkg` field that is a object instance of your `package.json` file.  

As of v0.4.0, All settings files have the same name which defaults to `.<appname>.json` where `<appname>` is the appname defined in `package.json`. This can be changed by setting `options.configFile`. 

### Example 1:

Assume that the `package.json` file defines appnam to `myapp`. 

This example will combine settings from the package settings file `.myapp.json` then users settings from `~/.myapp.json` then command line options then force the `debug` option to be `true`.  Uses a shallow merge so only the top level properties are merged.

    #!/usr/bin/env node

    var config = require('../cli-config').getConfig({dirname: __dirname, override: {debug: true}});

    console.log(config.pkg.appName + ' ' + config.pkg.version); // Use package.json fields
    console.log(config);

### Example 2:

This example will deep merge nested settings from a package settings file named `$__dirname/app.yaml` then `~/app.yaml` then command line options.  If `$HOME/app.yaml` does not exist, it clones a copy from the package settings file `$__dirname/app.yaml` so the user can override the default package settings with their own.

    var config = require('../cli-config').getConfig({
        dirname: __dirname,      // Looks for `package.json` and a package settings file (named `configFile`) in this folder
        configFile: 'app.yaml',  // Name of settings files (Default '.<appname>.json')
        clone: true,             // Creates a ~/app.yaml file if none exists.
        parser: YAML.parse,      // Parse settings files using YAML parser.  require 'yamljs' package.
        merge: 'deep'            // Deep merge all config file settings & command line settings.
    });

### Example 3:

The command line parser returns an object that can be used to override the system settings or user settings options.  You can configure this parser using the **cli** option.  Refer to [minimist](https://github.com/substack/minimist) used by this lib for more details about command line parsing options.

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

## findCommand(options, config, callback)

Finds a command function from a command tree.

### Options:

   - `[options]` {Object}
      - `[cmdTree]` {Object} Command tree where attributes are command words and leaf node values are functions.
      - `[fnHelp]`  {Function} Function returned when no command matching is found. (default:  `cmdTree.help || function() { throw "Invalid argument"; }`)
   - `[config]`  {Object} Object returned by getConfig() or minimist API.
   - `[callback]` {Function} Called bcak with the arguments:
     - `fnCommand`  {Function} Command function found.
     - `args`       {Array} Command arguments (command line words remaining after traversing command tree).

### Returns:

   - {Any} Value returned by `callback` function.

### Example:

    // libs containing action functions that accept `config` object as single argument created by `getConfig()`
    var pigs = require('lib/pigs");
    var farm = require('lib/farm");

    // Map of command line verbs
    var cmdTree = {
        version: function(options) {
            // Use fields from your package.json file
            console.info(options.pkg.name + ' ' + options.pkg.version);
        },
        settings: function(options) {
            console.info(options);
        },
        // 'help' function is called if no commands match and options. fnHelp is not defined.
        help: function() {
            var appName = path.basename(process.argv[1]);
            [
                'Commands:',
                'pigs add  -n <name>   - Add Pigs to the farm',
                'pigs remove -n <name> - Remove last pig from the farm',
                'pigs fly              - Makes all pigs fly',
                'farm init -n <name>   - Initialise farm',
                'farm list             - List farm animals',
                'version               - Displays app name & version',
                'settings              - Displays app settings'
                'help                  - Displays this help message'
            ].forEach(function(line) {
                console.info(appName + ' ' + line);
            });
        },

        // LIB commands
        // Replace with just "pigs: require('lib/pigs")" and any new exported functions become commands!
        pigs: {
            add:    pigs.add,
            remove: pigs.remove,
            fly:    pigs.fly
        }
        // Replace with just "farm: require('lib/farm")" and any new exported functions become commands!
        farm: {
            init: farm.init,
            list: farm.list
        }
    };

    var cli = require('cli-config');
    var config = cli.getConfig({ dirname: __dirname });
    var result = cli.findCommand({cmdTree: cmdTree}, config, function(fnCmd, args) {   // <== EXAMPLE API CALL
        return fnCmd.call(this, config, args); // Execute command function
    });


## run(options)

Combines `getConfig()` and `findCommand()` into a single `run()` call.

Loads configuration settings and executes a command function from the command tree and returns it's result.

### Options:

   - `[options]` {Object}  - Accepts all the options for `getConfig()` and `getCommandFn()` methods as shown above.

### Returns:

   - {Any} Value returned by command function executed.

### Example

    #!/usr/bin/env node

    try {
        var cmdTree = { ... } // Same as getCommandFn() example above.

        var cli = require('cli-config');
        cli.run({
            dirname: __dirname,
            clone: true,
            cli: {
                boolean: {
                    'v': 'verbose'  // -v = true/false flag
                },
                string: {
                    'n': 'name'     // -n <name> = abbreviation for -name <name>
                }
            },
            cmdTree: cmdTree,
            fnHelp: cmdTree.help
        });
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
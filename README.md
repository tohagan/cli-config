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
  - Configuration files and command line options use one schema defined in your package `defaults.config` file.
  - BYO parser function to support YAML, Coffee Script or any other .config file format.
  - Add comments in your `defaults.config` file so the user can understand how to configure their local copy.
  - If you set the `clone: true` flag, it creates an initial user settings file in `~/.<appname>.config` copied from the package `defaults.config` file
  - When users settings file is create it will initially override all the options in the `default.config` file it was copied from, however we still perform a merge with `defaults.config` since a future upgrade of your app may add new properties that will need to be defaulted via your new `default.config` file.
  - To support future upgrades of the user settings file, it's recommended that your `defaults.config` file includes a `_schema` property set to the current schema version number so future versions of your app can detect that the user settings file is out of date and may need to be migrate to the new schema.

# API

## getConfig(options)

Returns configuration settings object.

    var config = require('cli-config').getConfig(options);

### Options:

  - `[options]` {Object}
    - `[dirname]`       Root directory of your app package.  Used to find `package.json` and `defaults.json` files.
    - `[cli]`           {Object} Command line interface parsing options.  Refer to [minimist](https://github.com/substack/minimist) documentation.
    - `[clone]`         {Boolean} If `true`, copies package `defaults.config` file to local configuration file. (default: `false`).
    - `[merge]`         {String} Merge attributes using `'shallow'` or `'deep'` recursive merging (default: `'shallow'`).
    - `[configFile]`    {String} Local configuration file name. (default: `~/.<appname>.config`).
    - `[ancestors]`     {String} or {Boolean} If truthy, Searches current & ancestor directories for config files (default `false`)
      - Config file name is: `.<appname>.config` but can be specified by `ancestors` options if it's a string value.
    - `[env]`           {String} If set, merges config properties from a named environment variable containing serialised config object.
    - `[override]`      {Object} Optional final override to other configuration properties.  (default: `null`)

**.config** files are parsed as UTF8 JSON format that can contain `//` or `/* ... */` comments.

### Returns:

  - {Object} A configuration object based on merging attributes in the following order:
    1. Package defaults (`defaults.config` JSON file from the `dirname` folder).
    1. Local configuration file (`configFile` JSON file that defaults to `~/.<appname>.config`).
    1. Command line arguments parsed by [minimist](https://github.com/substack/minimist).
    1. An optional `override` object from your application.

Adds a obj.pkg field that is a object instance of your package.json file.

*All of these are optional.*

### Example 1:

Combine configuration options from package file `defaults.config` then `~/.<appname>.config` then command line options then force the `debug` option to be `true`.  Uses a shallow merge so only the top level properties are merged.

    #!/usr/bin/env node

    var config = require('../cli-config').getConfig({dirname: __dirname, override: {debug: true}});

    console.log(config.pkg.appName + ' ' + config.pkg.version); // Use package.json fields
    console.log(config);

### Example 2:

Deep merge nested configuration settings from package `defaults.config` then `./config.json` then command line options.  If `./config.json` does not exist, clone a copy from `defaults.config` so the user can use it to override `defaults.config` in the future.


    var config = require('../cli-config').getConfig({
        dirname: __dirname,          // Looks for system wide defaults.config in this package folder
        clone: true,                 // Creates a ./config.json if none exists.
        configFile: './config.yaml', // Keep user settings here rather than ~/.<appname>.config
        parser: YAML.parse,          // Parse config file using YAML parser.  Add 'yamljs' package.
        merge: 'deep'                // Deep merge all config file settings & command line settings.
    });

### Example 3:

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
        // Replace with just "pigs: require('lib/pigs")" and any new exported functions become the commands!
        pigs: {
            add:    pigs.add,
            remove: pigs.remove,
            fly:    pigs.fly
        }
        // Replace with just "farm: require('lib/farm")" and any new exported functions become the commands!
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
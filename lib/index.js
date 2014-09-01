'use strict';

var fs     = require('fs');
var path   = require('path');
var strip  = require('strip-json-comments');
var assert = require('assert-plus');

var homedir = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];

function expandHomeDir (fileName) {
    assert.equal(typeof fileName, 'string', 'fileName must be a string');
    if (!fileName) return fileName;
    if (fileName == '~') return homedir;
    if (fileName.slice(0, 2) != '~/') return fileName;
    return path.join(homedir, fileName.slice(2));
}

// parse command line options
function shallowMerge(obj1, obj2){
    assert.object(obj1, 'obj1');
    assert.object(obj2, 'obj2');
    if (obj1 && obj2) {
        for (var key in obj2) {
          obj1[key] = obj2[key];
        }
    }
    return obj1;
}

function deepMerge(obj1, obj2) {
    assert.object(obj1, 'obj1');
    assert.object(obj2, 'obj2');
    for (var p in obj2) {
        if (obj2.hasOwnProperty(p)) {
            try {
                if ( obj2[p].constructor === Object ) {
                    obj1[p] = deepMerge(obj1[p], obj2[p]); // recursive
                } else {
                    obj1[p] = obj2[p];
                }
            } catch(e) {
                obj1[p] = obj2[p];
            }
        }
    }
    return obj1;
}

function readConfigFile(parser, fileName) {
    assert.func(parser, 'parser');
    assert.string(fileName, 'fileName');

    if (fs.existsSync(fileName) === false) return {};
    // Remove BOM: https://github.com/joyent/node/issues/1918
    var json = fs.readFileSync(fileName, 'utf8').replace(/^\uFEFF/, '');
    json = strip(json);
    try {
        return parser(json);
    }
    catch (err) {
        throw fileName + ': Failed to read configuration file. ' + err + '.';
    }
}

function findAncestorConfigFiles(fileName) {
    assert.string(fileName, 'fileName');
    var lastDir = null;
    var paths = [];
    for (var dir = process.cwd(); dir !== lastDir; dir = path.resolve(dir, '..')) {
        lastDir = dir;
        var configFile = path.join(dir, fileName);
        // unshift(): Processes config files from root to current dir
        if (fs.existsSync(configFile)) paths.unshift(configFile);
    }
    return paths;
}

// Validates config objects based on default config file that ships with the app.
// Checks obj._schema value and top level property names
function schemaValidator(defaultsFile, defaultsObj, cfg, entity, isFile) {
    assert.string(defaultsFile, 'defaultsFile');
    assert.object(defaultsObj, 'defaultsObj');
    assert.object(cfg, 'cfg');
    assert.string(entity, 'entity');
    assert.bool(isFile, 'isFile');

    var errs = [];

    if (isFile && Object.keys(cfg).length > 0) {
        if (!cfg._schema) {
            errs.push("_schema property is not defined");
        }
        else if (cfg._schema !== defaultsObj._schema) {
            errs.push('Schema has changed');
        }
    }

    for (var key in cfg) {
        if (key !== '_' && !defaultsObj.hasOwnProperty(key)) errs.push("'" + key + "': is an invalid option.");
    }

    if (errs.length > 0) {
        if (isFile) errs.push(entity + ': Please update based on example in\n  ' + defaultsFile);
        throw '\n * ' + errs.join('\n * ');
    }
}

module.exports = {

    // for unit testing
    _private: {
        expandHomeDir: expandHomeDir,
        shallowMerge: shallowMerge,
        deepMerge: deepMerge,
        readConfigFile: readConfigFile,
        findAncestorConfigFiles: findAncestorConfigFiles,
        schemaValidator: schemaValidator
    },

    /**
     * Options:
     *
     *   - `[options]` {Object}
     *     - `[dirname]`        {String} Directory containing `defaults.config` JSON file used to read package defaults. Normally `__dirname` from calling script.
     *     - `[cli]`            {Object} Command line interface parsing options.  Refer to [minimist](https://github.com/substack/minimist) documentation.
     *     - `[configFile]`       {String} Name used for configuration file names. (default: `.<appname>.json`) where `<appname>` is defined in `package.json` .
     *     - `[ancestors]`	    {Boolean} OR {String} if truthy, searches current and ancestors folders for config files (named `[configFile]` or `ancestors` value if it's a String).
     *     - `[env]`            {String} Name of an environment variables that contains a serialised configuration.
     *     - `[clone]`          {Boolean} If `true`, copies package `defaults.config` file to local configuration file. (default: `false`).
     *     - `[merge]`          {String} Merge attributes using `'shallow'` or `'deep'` merging (default: `'shallow'`).
     *     - `[override]`       {Object} Optional final override to other configuration properties.  (default: `null`)
     *     - `[parser]`         {Function} Config file parser. e.g. Send a YAML or CoffeeScript parser or use an improve JSON parser (e.g. report errors better).  (default: JSON.parser). Reports errors as exceptions.
     *     - `[validator]`      {Function} Config object validator.  Reports errors as exceptions.  (Default: Checks obj._schema value and top level property names)
     *        - `[cfg]`         {Object} Configuration object
     *        - `[entity]`      {String} Configuration entity (config file, environment variable or command line). Can be further qualified by property name.
     *
     * **.config** files are UTF8 JSON format that can contain comments.
     *
     * Returns:
     *
     *   - {Object} A configuration object based on merging attributes in the following order:
     *     1. Package defaults (`defaults.config` JSON file in the `dirname` folder).
     *     1. Local configuration file (`configFile` JSON file that defaults to `./<appname>.config`).
     *     1. Command line arguments parsed by [minimist](https://github.com/substack/minimist).
     *     1. An optional `override` object from your application.
     *
     *  *All of these are optional.*
     */

    getConfig: function(options) {
        assert.object(options, 'options');
        assert.string(options.dirname, 'options.dirname');
        assert.optionalObject(options.cli, 'options.cli');
        assert.optionalString(options.configFile, 'options.configFile');
        assert.optionalBool(options.ancestors, 'options.ancestors');
        assert.optionalString(options.env, 'options.env');
        assert.optionalBool(options.clone, 'options.clone');
        assert.optionalString(options.merge, 'options.merge');
        assert.optionalObject(options.override, 'options.override');
        assert.optionalFunc(options.parser, 'options.parser');
        assert.optionalFunc(options.validator, 'options.validator');

        var packageFilename = path.join(options.dirname, 'package.json');
        var pkg = readConfigFile(JSON.parse, packageFilename);

        var configFilename = options.configFile || '.'  + pkg.name + '.json';
        var defaultsFile = path.join(options.dirname, configFilename);
        var homeFile = expandHomeDir('~/' + configFilename);

        var parser    = options.parser    || JSON.parse;     // BYO parser
        var validator = options.validator || function() {};  // BYO validator

        // Clone defaultsFile to user's home config file on first use
        if (options.clone && !fs.existsSync(homeFile)) {
            fs.writeFileSync(homeFile, fs.readFileSync(defaultsFile, 'utf8'), 'utf8');
            console.info(homeFile + ': Created a settings file');
        }

        // Perform deep or shallow merging of config object properties.
        var fnMerge = options.merge === 'deep' ? deepMerge : shallowMerge;

        // Load initial configuration defaults from defaultsFile that ship with the app.
        var defaultsObj = readConfigFile(parser, defaultsFile) || {};
        validator(defaultsObj, defaultsFile, true);

        var cfg = fnMerge({}, defaultsObj); // Preserve defaultsObj to use it in schemaValidation()

        // Add 'package.json' as ._pkg field
        cfg._pkg = pkg;

        // Prepend schemaValidator to validation after we've read the defaultFile
        var validator2 = function(entity, config, isFile) {
            schemaValidator(defaultsFile, defaultsObj, config, entity, isFile);
            validator(entity, config, isFile);
        };

        // Merge config file in home directory or options.configFile:
        var homeCfg = readConfigFile(parser, homeFile);
        validator2(homeFile, homeCfg, true);
        cfg = fnMerge(cfg, homeCfg);

        // Merge config files in current and ancestor directories from root to current dir.
        if (options.ancestors) {
            // options.ancestors can be boolean OR a file name
            var ancestorFileName = typeof options.ancestors === "string" ? options.ancestors : configFilename;
            // Search for config files in current and ancestors folders.
            var ancestors = findAncestorConfigFiles(ancestorFileName);
            ancestors.forEach(function(ancestorFile) {
                var ancestorCfg = readConfigFile(parser, ancestorFile);
                validator2(ancestorFile, homeCfg, true);
                cfg = fnMerge(cfg, ancestorCfg);
            });
        }

        // Merge options from an environment variable
        if (options.env && typeof options.env === "string") {
            var env = process.env[options.env];
            var env_cfg = parser(env) || {};
            validator2('$' + options.env, cli_cfg, false);
            if (env) cfg = fnMerge(cfg, env_cfg);
        }

        // Parse and Merge command line options:
        var cli_cfg = require('minimist')(process.argv.slice(2), options.cli || {});
        if (cli_cfg) {
            validator2('command line args', cli_cfg, false);
            cfg = fnMerge(cfg, cli_cfg);
        }

        // Merge application overrides:
        if (options.override) {
            validator2('options.override', options.override, false);
            cfg = fnMerge(cfg, options.override);
        }

        return cfg;
    },

    /**
     * Returns the function to execute from a tree of commands that correspond to CLI command words.
     * Functions take a single `config` argument which is the configuration settings returned by the `getConfig()` method.
     *
     * Options:
     *
     *   - `[options]` {Object}
     *     - `[cmdTree]` {Object}   Tree of functions with attributes as command line words and leaf node values as functions.
     *     - `[fnHelp]`  {Function} Function used when no command matching is found.  (default: cmdTree.help)
     *   - `[config]`    {Object}   Configuration settings returned by `getConfig`
     *   - callback {Function} called with:
     *       [command] {Function} Command function from
     *       [args]    {Array} Remaining arguments after removing command words.
     *
     * Returns:
     *
     *   - {Any} Value returned by `callback` function.
     *
     */

    findCommand: function(options, config, callback) {
        assert.object(options, 'options');
        assert.object(config, 'config');
        assert.func(callback, 'callback');

        var cmd = options.cmdTree;  // Tree of command functions
        var cmdWords = config._;    // Array returned by minimist API

        while (typeof cmd === "object") {
            var word = cmdWords.shift();
            cmd = word && cmd[word];
        }

        // Return fnHelp() function if no matching command was found.
        var fnHelp = options.fnHelp || options.cmdTree.help || function() { throw "Invalid arguments"; };
        return callback(typeof cmd === "function" ? cmd :  fnHelp, cmdWords);
    },

    /**
     * Executes a command function based on command line options and configuration settings.
     *
     * Options:
     *
     *   - `[options]` {Object}  - Options for `getConfig()` and `findCommand()` methods.
     *
     * Returns:
     *
     *   - {Any}  Value returned by command function.
     *
     */
    run: function(options) {
        var config = this.getConfig(options);
        return this.findCommand(options, config, function(fnCmd, args) {
            return fnCmd(config, args); // Execute command function
        });
    }
};

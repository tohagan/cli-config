'use strict';

var fs = require('fs');
var path = require('path');
var strip = require('strip-json-comments');

var homedir = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];

function expandHomeDir (fileName) {
  if (!fileName) return fileName;
  if (fileName == '~') return homedir;
  if (fileName.slice(0, 2) != '~/') return fileName;
  return path.join(homedir, fileName.slice(2));
}

// parse command line options
function shallowMerge(obj1, obj2){
    if (obj1 && obj2) {
        for (var key in obj2) {
          obj1[key] = obj2[key];
        }
    }
    return obj1;
}

function deepMerge(obj1, obj2) {
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

function findAncestorConfigFiles(filename) {
    var lastDir = null;
    var paths = [];
    for (var dir = process.cwd(); dir !== lastDir; dir = path.resolve(dir, '..')) {
        lastDir = dir;
        var configFile = path.join(dir, filename);
        // unshift(): Processes config files from root to current dir
        if (fs.existsSync(configFile)) paths.unshift(configFile);
    }
    return paths;
}

module.exports = {
    /**
     * Options:
     *
     *   - `[options]` {Object}
     *     - `[cli]`			{Object} Command line interface parsing options.  Refer to [minimist](https://github.com/substack/minimist) documentation.
     *     - `[dirname]`		{String} Directory containing `defaults.config` JSON file used to read package defaults. Normally `__dirname` from calling script.
     *     - `[configFile]`	    {String} Local configuration file name. (default: `./<appname>.config`).
     *     - `[clone]`			{Boolean} If `true`, copies package `defaults.config` file to local configuration file. (default: `false`).
     *     - `[merge]`			{String} Merge attributes using `'shallow'` or `'deep'` merging (default: `'shallow'`).
     *     - `[override]`		{Object} Optional final override to other configuration properties.  (default: `null`) 
     *     - `[parser]`			{Function} .config parser. So you can parse YAML or Coffee script.  (default: JSON.parser)
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
        options = options || {};

        var packageFilename = path.join(options.dirname, 'package.json');
        var pkg = readConfigFile(JSON.parse, packageFilename);

        var defaultsFilename = options.dirname ? path.join(options.dirname, 'defaults.config') : null;
        var configFilename = expandHomeDir(options.configFile || '~/.' + pkg.name + '.config');
        var parser = options.parser || JSON.parse;  // BYO parser

        // Clone defaults.config file to user's home config file on first use
        if (defaultsFilename && options.clone && !fs.existsSync(configFilename)) {
            // Not using streams - avoids async issues on Windows
            fs.writeFileSync(configFilename, fs.readFileSync(defaultsFilename, 'utf8'), 'utf8');
            console.info(configFilename + ': Created a settings file');
        }

        // Perform deep or shallow merging of config object properties.
        var fnMerge = options.merge === 'deep' ? deepMerge : shallowMerge;
        
        // Load package defaults from 'defaults.config' 
        var cfg = readConfigFile(parser, defaultsFilename) || {};
        
        // Add 'package.json' as .pkg field
        cfg.pkg = pkg;

        // Merge config file in home directory or options.configFile:
        cfg = fnMerge(cfg, readConfigFile(parser, configFilename) || {});
        
        // Merge config files in current and ancestor directories from root to current dir.
        if (options.ancestors) {
            // options.ancestors can be boolean OR a file name
            var ancestorFileName = typeof options.ancestors === "string" ? options.ancestors : ('.' + pkg.name + '.config');
            // Search for config files in current and ancestors folders.
            var ancestors = findAncestorConfigFiles(ancestorFileName);
            ancestors.forEach(function(ancestor) {
                cfg = fnMerge(cfg, readConfigFile(parser, ancestor) || {});
            });
        }
        
        // Merge options from an environment variable
        if (options.env && typeof options.env === "string") {
            var env = process.env[options.env];
            if (env) cfg = fnMerge(cfg, parser(env) || {});
        }
                
        // Parse and Merge command line options:
        var cli_options = require('minimist')(process.argv.slice(2), options.cli || {});
        cfg = fnMerge(cfg, cli_options || {});
        
        // Merge application overrides:
        cfg = fnMerge(cfg, options.override || {});

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
            return fnCmd.call(this, config, args); // Execute command function
        });
    }
};

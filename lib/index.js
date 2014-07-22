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
        return JSON.parse(json);
    }
    catch (err) {
        throw fileName + ': Failed to read configuration file. ' + err + '.';
    }
}

module.exports = {
    /**
     * Options:
     *
     *   - `[options]` {Object}
     *     - `[cli]`			{Object} Command line interface parsing options.  Refer to [minimist](https://github.com/substack/minimist) documentation.
     *     - `[dirname]`		{String} Directory containing `defaults.config` JSON file used to read package defaults. Normally `__dirname` from calling script.
     *     - `[configFile]`	{String} Local configuration file name. (default: `./<appname>.config`).
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
        var appName = path.basename(process.argv[1]);
        var defaultsFilename = options.dirname ? path.join(options.dirname, 'defaults.config') : null;
        var configFilename = expandHomeDir(options.configFile || '~/.' + appName + '.config'); 
        var parser = options.parser || JSON.parse;

        if (defaultsFilename && options.clone && !fs.existsSync(configFilename)) {
            fs.writeFileSync(configFilename, fs.readFileSync(defaultsFilename, 'utf8'), 'utf8');
            console.info(configFilename + ': Created a local config file');
        }

        var cli_options = require('minimist')(process.argv.slice(2), options.cli || {});

        var fnMerge = options.merge === 'deep' ? deepMerge : shallowMerge;
        var cfg = readConfigFile(parser, defaultsFilename);
        cfg = fnMerge(cfg, readConfigFile(parser, configFilename));
        cfg = fnMerge(cfg, cli_options);
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
     *     - `[fnHelp]`  {Function} Function used when no command matching is found.
     *   - `[config]`    {Object}   Configuration settings returned by `getConfig`
     *   - callback {Function} called with:
     *       [command] {Function} Command function from 
     *       [args]    {Array} Remaining arguments after removing command words.
     * 
     * Returns:
     * 
     *   - {Function} Function to execute 
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
        var fnHelp = options.fnHelp || function() { throw "Invalid arguments"; };
        callback(typeof cmd === "function" ? cmd :  fnHelp, cmdWords);
    },

    /**
     * Executes a command line function based on command line options and configuration settings.
     *
     * Options:
     *   - `[options]` {Object}  - Options for `getConfig()` and `findCommand()` methods.
     */ 
    run: function(options) {
        var config = this.getConfig(options);
        this.findCommand(options, config, function(fnCmd, args) {
            fnCmd.call(this, config, args); // Execute command function
        });
    }
};

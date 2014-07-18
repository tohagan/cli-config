'use strict';

var fs = require('fs');
var path = require('path');
var strip = require('strip-json-comments');

// parse command line options
var cli_options = require('minimist')(process.argv.slice(2));

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
    
function readConfigFile(fileName) {
    if (!fs.existsSync(fileName)) return {};
    // Remove BOM: https://github.com/joyent/node/issues/1918
    var json = fs.readFileSync(fileName, 'utf8').replace(/^\uFEFF/, '');
    console.log(json);
    json = strip(json);
    console.log(json);
    try {
        return JSON.parse(json);
    }
    catch (err) {
        throw fileName + ': Failed to read configuration file. ' + err + '.';
    }
}

/**
  * Options:
  *   - `[options]` {Object}
  *     - `[dirname]`		{String} Directory containing `defaults.config` JSON file used to read package defaults. Normally `__dirname` from calling script.
  *     - `[configFile]`	{String} Local configuration file name. (default: `./<appname>.config`).
  *     - `[clone]`			{Boolean} If `true`, copies package `defaults.config` file to local configuration file. (default: `false`).
  *     - `[merge]`			{String} Merge attributes using `'shallow'` or `'deep'` merging (default: `'shallow'`).
  *   - `[override]`		{Object} Optional final override to other configuration properties.  (default: `null`) 
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
  * 	*All of these are optional.*
  */ 
  
  module.exports = function(options, config) {    
    options = options || {};
    var defaultsFilename = options.dirname ? path.join(options.dirname, 'defaults.config') : null;
    var configFilename = options.configFile || path.basename(process.argv[1]) + '.config'; 

    if (defaultsFilename && options.clone && !fs.existsSync(configFilename)) {
        fs.writeFileSync(configFilename, fs.readFileSync(defaultsFilename, 'utf8'), 'utf8');
        console.info(configFilename + ': Created a local config file');
    }

    var fnMerge = options.merge === 'deep' ? deepMerge : shallowMerge;
    var cfg = readConfigFile(defaultsFilename);
    cfg = fnMerge(cfg, readConfigFile(configFilename));
    cfg = fnMerge(cfg, cli_options);
    cfg = fnMerge(cfg, config || {});

    return cfg;
};

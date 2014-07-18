'use strict';

var fs = require('fs');
var path = require('path');
var strip = require('strip-json-comments');

// parse command line options
var cli_options = require('minimist')(process.argv.slice(2));

function mergeObject(obj1, obj2) {
    for (var p in obj2) {
        if (obj2.hasOwnProperty(p)) {
            try {
                if ( obj2[p].constructor === Object ) {
                    obj1[p] = mergeObject(obj1[p], obj2[p]);
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
 * Return configuration options applied in order of precedence from ...
 *
 * 1. Command line arguments
 * 2. <app>.json
 * 3. $dirname/lib/defaults.json 
 * 4. config
 *
 * Options:
 *
 *   - `options` {Object}
 *     - `dirname` {String} __dirname module containing the default.json file.  Typically the top level command line app.
 *     - `clone` {Boolean} If true, creates a local config file from __dirname/lib/defaults.json if none exists.
 *     - `configFile` {String} Local configuration filename. (default: ./<appname>.config). UTF8 JSON format with optional comments.
 *   - config {Object}  Overrides final configuration properties.
 *
 * Example:
 *
 */
module.exports = function(options, config) {    
    options = options || {};
    var defaultsFilename = options.dirname ? path.join(options.dirname, 'defaults.json') : null;
    var configFilename = options.configFile || path.basename(process.argv[1]) + '.config'; 

    if (defaultsFilename && options.clone && !fs.existsSync(configFilename)) {
        fs.writeFileSync(configFilename, fs.readFileSync(defaultsFilename, 'utf8'), 'utf8');
        console.info(configFilename + ': Created a local config file');
    }

    var cfg = readConfigFile(defaultsFilename);
    if (options.debug) console.log("cli-config-A: ", cfg);
    cfg = mergeObject(cfg, readConfigFile(configFilename));
    if (options.debug) console.log("cli-config-B: ", cfg);
    cfg = mergeObject(cfg, cli_options);
    if (options.debug) console.log("cli-config-C: ", cfg);
    cfg = mergeObject(cfg, config || {});
    if (options.debug) console.log("cli-config-D: ", cfg);

    return cfg;
};
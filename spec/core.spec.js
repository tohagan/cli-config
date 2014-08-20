// brackets-xunit: includes=index.js
/*global jasmine, describe, it, expect, readConfigFile, findAncestorConfigFiles */

var cliConfig = require('../lib/index');
var _private = cliConfig._private;

describe('cli-config - test exported interface methods', function() {
    it('should be an object', function() {
        expect(cliConfig).toEqual(jasmine.any(Object));
    });

    it('getConfig should be a function', function() {
		expect(cliConfig.getConfig).toEqual(jasmine.any(Function));
    });

    it('findCommand should be a function', function() {
		expect(cliConfig.findCommand).toEqual(jasmine.any(Function));
    });

    it('getConfig should be a function', function() {
		expect(cliConfig.getConfig).toEqual(jasmine.any(Function));
    });

    it('run should be a function', function() {
		expect(cliConfig.run).toEqual(jasmine.any(Function));
    });
});

describe("test expandHomeDir(fileName)", function () {
    var home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    var toPath = (process.platform == 'win32') ? function(p) { return p.replace(/\\/g, '/');} : function(p) { return p; };

    var expandHomeDir = _private.expandHomeDir;

    it("does not expand 'xx'", function () {
        expect(expandHomeDir("xx")).toEqual("xx");
    });

    it("expands '~' -> $HOME", function () {
        expect(toPath(expandHomeDir("~"))).toEqual(toPath(home));
    });

    it("expands '~/xx/yy' -> $HOME/xx/yy", function () {
        expect(toPath(expandHomeDir("~/xx/yy"))).toEqual(toPath(home + "/xx/yy"));
    });
});

describe("test shallowMerge(obj1, obj2)", function () {
    var shallowMerge = _private.shallowMerge;
    it("overrides and adds properties", function () {
        expect(shallowMerge({a: 1, b:2, c: 3}, {b:4, d: 5}))
            .toEqual({a: 1, b: 4, c: 3, d: 5});
    });

    it("replaces nested properties", function () {
        expect(shallowMerge({a: 1, b: { X: 10, Y:20}, c: 3}, {b: {Y: 30, Z: 40}, d: 5}))
            .toEqual({a: 1, b: {Y: 30, Z: 40}, c: 3, d: 5});
    });
});

describe("test deepMerge(obj1, obj2)", function () {
    var deepMerge = _private.deepMerge;

    it("overrides and adds properties", function () {
        expect(deepMerge({a: 1, b:2, c: 3}, {b:4, d: 5})).toEqual({a: 1, b: 4, c: 3, d: 5});
    });

    it("overrides and adds nested properties", function () {
        expect(deepMerge({a: 1, b:{ X: 10, Y:20}, c: 3}, {b:{Y: 30, Z: 40}, d: 5}))
            .toEqual({a: 1, b: { X: 10, Y:30, Z: 40}, c: 3, d: 5});
    });
});

describe("test readConfigFile(parser, fileName)", function () {
    var readConfigFile = _private.readConfigFile;
    var parser = JSON.parse;
    beforeEach(function () {
        process.chdir(__dirname);
    });

    it("returns {} when file does not exist", function () {
        expect(readConfigFile(parser, "notthere.json")).toEqual({});
    });

    it("invalid JSON throws exception with config name", function () {
        expect(function() { readConfigFile(parser, "fixtures/invalid.json"); })
            .toThrow("fixtures/invalid.json: Failed to read configuration file. SyntaxError: Unexpected token [.");
    });
});

describe("test findAncestorConfigFiles(filename)", function () {
    var findAncestorConfigFiles = _private.findAncestorConfigFiles;
    var path = require('path');
    var cwd = process.cwd();

    beforeEach(function () {
        process.chdir(path.join(__dirname, 'fixtures', 'nested1', 'nested2'));
    });

    afterEach(function () {
        jasmine.log(cwd);
        process.chdir(cwd);
    });

    it("finds all ancestors", function () {
        jasmine.log(cwd);
        expect(findAncestorConfigFiles("valid.json").length).toEqual(2);
    });
});

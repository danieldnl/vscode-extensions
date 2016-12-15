"use strict";
var vscode_1 = require('vscode');
var pkg = require('../../../package.json');
var Config = (function () {
    function Config() {
    }
    Config.reloadConfig = function () {
        Config.craneSettings = vscode_1.workspace.getConfiguration("crane");
    };
    Object.defineProperty(Config, "debugMode", {
        get: function () {
            Config.reloadConfig();
            return Config.craneSettings ? Config.craneSettings.get("debugMode", false) : false;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Config, "enableCache", {
        get: function () {
            Config.reloadConfig();
            return Config.craneSettings ? Config.craneSettings.get("enableCache", true) : true;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Config, "showBugReport", {
        get: function () {
            Config.reloadConfig();
            return Config.craneSettings ? Config.craneSettings.get("showStatusBarBugReportLink", true) : true;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Config, "phpstubsZipFile", {
        get: function () {
            Config.reloadConfig();
            return Config.craneSettings ? Config.craneSettings.get("phpstubsZipFile", "https://codeload.github.com/HvyIndustries/crane-php-stubs/zip/master") : "https://codeload.github.com/HvyIndustries/crane-php-stubs/zip/master";
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Config, "ignoredPaths", {
        get: function () {
            Config.reloadConfig();
            return Config.craneSettings ? Config.craneSettings.get("ignoredPaths", []) : [];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Config, "version", {
        get: function () {
            return pkg.version.toString();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Config, "phpFileTypes", {
        get: function () {
            var fileSettings = vscode_1.workspace.getConfiguration("files");
            var obj = fileSettings.get("associations", new Object());
            var extentions = { include: [], exclude: [] };
            for (var i in obj) {
                var value = '**/*' + i.replace(/^\*/, '');
                if (obj[i].toLowerCase() == 'php') {
                    extentions.include.push(value);
                }
                else {
                    extentions.exclude.push(value);
                }
            }
            if (extentions.include.indexOf('**/*.php') == -1) {
                extentions.include.push('**/*.php');
            }
            return extentions;
        },
        enumerable: true,
        configurable: true
    });
    Config.craneSettings = vscode_1.workspace.getConfiguration("crane");
    return Config;
}());
exports.Config = Config;
//# sourceMappingURL=Config.js.map
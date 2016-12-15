"use strict";
var vscode_1 = require('vscode');
var Config_1 = require('./Config');
var outputConsole = vscode_1.window.createOutputChannel("Crane Console");
var Debug = (function () {
    function Debug() {
    }
    /**
     * Displays an info message prefixed with [INFO]
     */
    Debug.info = function (message) {
        if (Config_1.Config.debugMode) {
            Debug.showConsole();
            outputConsole.appendLine("[INFO] " + message);
        }
    };
    /**
     * Displays and error message prefixed with [ERROR]
     */
    Debug.error = function (message) {
        if (Config_1.Config.debugMode) {
            Debug.showConsole();
            outputConsole.appendLine("[ERROR] " + message);
        }
    };
    /**
     * Displays and warning message prefixed with [WARN]
     */
    Debug.warning = function (message) {
        if (Config_1.Config.debugMode) {
            Debug.showConsole();
            outputConsole.appendLine("[WARN] " + message);
        }
    };
    Debug.clear = function () {
        outputConsole.clear();
        outputConsole.dispose();
    };
    Debug.showConsole = function () {
        if (Config_1.Config.debugMode) {
            outputConsole.show();
        }
    };
    Debug.calls = 0;
    return Debug;
}());
exports.Debug = Debug;
//# sourceMappingURL=Debug.js.map
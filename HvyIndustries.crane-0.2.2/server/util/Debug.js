"use strict";
var Debug = (function () {
    function Debug() {
    }
    Debug.SetConnection = function (conn) {
        Debug.connection = conn;
    };
    Debug.info = function (message) {
        Debug.connection.sendNotification({ method: 'serverDebugMessage' }, { type: 'info', message: message });
    };
    Debug.error = function (message) {
        Debug.connection.sendNotification({ method: 'serverDebugMessage' }, { type: 'error', message: message });
    };
    Debug.warning = function (message) {
        Debug.connection.sendNotification({ method: 'serverDebugMessage' }, { type: 'warning', message: message });
    };
    return Debug;
}());
exports.Debug = Debug;
//# sourceMappingURL=Debug.js.map
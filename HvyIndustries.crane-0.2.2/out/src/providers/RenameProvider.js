"use strict";
var vscode_1 = require('vscode');
var process = require('process');
var PHPRenameProvider = (function () {
    function PHPRenameProvider() {
    }
    PHPRenameProvider.prototype.provideRenameEdits = function (document, postion, newString, token) {
        var _this = this;
        return vscode_1.workspace.saveAll(false).then(function () {
            return _this.renameSymbols(document, postion, newString, token);
        });
    };
    PHPRenameProvider.prototype.renameSymbols = function (document, position, newString, token) {
        return new Promise(function (resolve, reject) {
            var wordRange = document.getWordRangeAtPosition(position);
            var word = document.getText(wordRange);
            vscode_1.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', word).then(function (items) {
                var edit = new vscode_1.WorkspaceEdit();
                items.forEach(function (item) {
                    edit.replace(item.location.uri, item.location.range, newString);
                });
                resolve(edit);
            });
        });
    };
    return PHPRenameProvider;
}());
exports.PHPRenameProvider = PHPRenameProvider;
//# sourceMappingURL=RenameProvider.js.map
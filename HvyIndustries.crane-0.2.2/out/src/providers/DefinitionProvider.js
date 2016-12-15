"use strict";
var vscode_1 = require('vscode');
var PHPDefinitionProvider = (function () {
    function PHPDefinitionProvider() {
    }
    PHPDefinitionProvider.prototype.provideDefinition = function (document, position, token) {
        var _this = this;
        return vscode_1.workspace.saveAll(false).then(function () {
            return _this.findDefinition(document, position, token);
        });
    };
    PHPDefinitionProvider.prototype.findDefinition = function (document, position, token) {
        return new Promise(function (resolve, reject) {
            var wordRange = document.getWordRangeAtPosition(position);
            var word = document.getText(wordRange);
            word = word + "::#EXACT";
            vscode_1.commands.executeCommand('vscode.executeWorkspaceSymbolProvider', word).then(function (items) {
                var locations = [];
                items.forEach(function (item) {
                    locations.push(item.location);
                });
                resolve(locations);
            });
        });
    };
    return PHPDefinitionProvider;
}());
exports.PHPDefinitionProvider = PHPDefinitionProvider;
//# sourceMappingURL=DefinitionProvider.js.map
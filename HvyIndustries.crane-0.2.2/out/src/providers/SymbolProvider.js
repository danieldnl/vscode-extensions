"use strict";
var vscode_1 = require('vscode');
var crane_1 = require('../crane');
var process = require('process');
var PHPDocumentSymbolProvider = (function () {
    function PHPDocumentSymbolProvider() {
    }
    PHPDocumentSymbolProvider.prototype.provideDocumentSymbols = function (document, token) {
        var _this = this;
        return vscode_1.workspace.saveAll(false).then(function () {
            return _this.findSymbols(document, token);
        });
    };
    PHPDocumentSymbolProvider.prototype.findSymbols = function (document, token) {
        return new Promise(function (resolve, reject) {
            var filename = document.uri.fsPath;
            var results = [];
            var findFileDocumentSymbols = { method: 'findFileDocumentSymbols' };
            crane_1.default.langClient.sendRequest(findFileDocumentSymbols, {
                path: filename
            }).then(function (result) {
                result.symbols.forEach(function (item) {
                    var symbol = new vscode_1.SymbolInformation(item.name, item.kind - 1, new vscode_1.Range(item.startLine - 1, item.startChar, item.endLine - 1, item.endChar));
                    results.push(symbol);
                });
                resolve(results);
            });
        });
    };
    return PHPDocumentSymbolProvider;
}());
exports.PHPDocumentSymbolProvider = PHPDocumentSymbolProvider;
var PHPWorkspaceSymbolProvider = (function () {
    function PHPWorkspaceSymbolProvider() {
    }
    PHPWorkspaceSymbolProvider.prototype.provideWorkspaceSymbols = function (query, token) {
        var _this = this;
        return vscode_1.workspace.saveAll(false).then(function () {
            return _this.findSymbols(query, token);
        });
    };
    PHPWorkspaceSymbolProvider.prototype.findSymbols = function (query, token) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var results = [];
            var findWorkspaceSymbols = { method: 'findWorkspaceSymbols' };
            crane_1.default.langClient.sendRequest(findWorkspaceSymbols, {
                query: query,
                path: vscode_1.window.activeTextEditor.document.uri.fsPath
            }).then(function (result) {
                result.symbols.forEach(function (item) {
                    var uri = _this.getUri(item.path);
                    if (uri == null) {
                        return;
                    }
                    var symbol = new vscode_1.SymbolInformation(item.name, item.kind - 1, new vscode_1.Range(item.startLine - 1, item.startChar, item.endLine - 1, item.endChar), uri, item.parentName);
                    results.push(symbol);
                });
                resolve(results);
            });
        });
    };
    PHPWorkspaceSymbolProvider.prototype.getUri = function (path) {
        if (path == '' || path == '\\') {
            return;
        }
        var uri = null;
        switch (process.platform) {
            case 'win32':
                uri = vscode_1.Uri.parse('file:///' + path);
                break;
            default:
                uri = vscode_1.Uri.parse('file://' + path);
                break;
        }
        return uri;
    };
    return PHPWorkspaceSymbolProvider;
}());
exports.PHPWorkspaceSymbolProvider = PHPWorkspaceSymbolProvider;
//# sourceMappingURL=SymbolProvider.js.map
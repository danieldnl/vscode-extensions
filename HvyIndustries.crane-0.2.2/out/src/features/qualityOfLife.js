/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
"use strict";
var vscode = require('vscode');
var QualityOfLife = (function () {
    function QualityOfLife() {
        var _this = this;
        var subscriptions = [];
        vscode.workspace.onDidChangeTextDocument(function (e) { return _this.onChangeTextHandler(e.document); }, null, subscriptions);
        vscode.window.onDidChangeActiveTextEditor(function (editor) { _this.onChangeEditorHandler(editor); }, null, subscriptions);
        this.disposable = (_a = vscode.Disposable).from.apply(_a, subscriptions);
        this.todoCommentDecoration = vscode.window.createTextEditorDecorationType({
            overviewRulerLane: vscode.OverviewRulerLane.Right,
            color: "rgba(91, 199, 235, 1)",
            overviewRulerColor: 'rgba(144, 195, 212, 0.7)' // Light Blue
        });
        this.styleTodoComments();
        var _a;
    }
    QualityOfLife.prototype.onChangeEditorHandler = function (editor) {
        this.styleTodoComments();
    };
    QualityOfLife.prototype.onChangeTextHandler = function (textDocument) {
        // Style todo comments as blue (+ add marker in sidebar)
        this.styleTodoComments();
    };
    QualityOfLife.prototype.styleTodoComments = function () {
        var editor = vscode.window.activeTextEditor;
        if (editor == null)
            return;
        // Reset any existing todo style decorations
        editor.setDecorations(this.todoCommentDecoration, []);
        var matchedLines = [];
        // Parse document searching for regex match
        for (var i = 0; i < editor.document.lineCount; i++) {
            var line = editor.document.lineAt(i);
            var regex = /(\/\/|#)(\stodo|todo)/ig;
            var result = regex.exec(line.text);
            if (result != null) {
                var lineOption = { range: new vscode.Range(i, result.index, i, 99999) };
                matchedLines.push(lineOption);
            }
        }
        editor.setDecorations(this.todoCommentDecoration, matchedLines);
    };
    QualityOfLife.prototype.dispose = function () {
        this.disposable.dispose();
    };
    return QualityOfLife;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = QualityOfLife;
//# sourceMappingURL=qualityOfLife.js.map
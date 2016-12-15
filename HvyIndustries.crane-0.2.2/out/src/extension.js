/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
"use strict";
var path = require("path");
var vscode_1 = require("vscode");
var vscode_languageclient_1 = require("vscode-languageclient");
var crane_1 = require("./crane");
var qualityOfLife_1 = require("./features/qualityOfLife");
var Debug_1 = require('./utils/Debug');
function activate(context) {
    var qol = new qualityOfLife_1.default();
    var serverModule = context.asAbsolutePath(path.join("server", "server.js"));
    var debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };
    var serverOptions = {
        run: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc },
        debug: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc, options: debugOptions }
    };
    var clientOptions = {
        documentSelector: ["php"],
        synchronize: {
            configurationSection: "languageServerExample",
            fileEvents: vscode_1.workspace.createFileSystemWatcher("**/.clientrc")
        }
    };
    // Create the language client and start the client.
    var langClient = new vscode_languageclient_1.LanguageClient("Crane Language Server", serverOptions, clientOptions);
    // Use this to handle a request sent from the server
    // https://github.com/Microsoft/vscode/blob/80bd73b5132268f68f624a86a7c3e56d2bbac662/extensions/json/client/src/jsonMain.ts
    // https://github.com/Microsoft/vscode/blob/580d19ab2e1fd6488c3e515e27fe03dceaefb819/extensions/json/server/src/server.ts
    //langClient.onRequest()
    var disposable = langClient.start();
    var crane = new crane_1.default(langClient);
    context.subscriptions.push(vscode_1.commands.registerCommand("crane.reportBug", crane.reportBug));
    context.subscriptions.push(vscode_1.commands.registerCommand('crane.rebuildSources', function () {
        Debug_1.Debug.clear();
        Debug_1.Debug.info('Re-indexing PHP files in the workspace...');
        crane.rebuildProject();
    }));
    context.subscriptions.push(vscode_1.commands.registerCommand('crane.deleteCaches', function () {
        Debug_1.Debug.clear();
        Debug_1.Debug.info('Deleting all PHP caches....');
        crane.deleteCaches();
    }));
    context.subscriptions.push(vscode_1.commands.registerCommand('crane.downloadPHPLibraries', function () {
        Debug_1.Debug.clear();
        Debug_1.Debug.info('Downloading PHP Library Stubs...');
        crane.downloadPHPLibraries();
    }));
    context.subscriptions.push(disposable);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map
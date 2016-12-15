/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
"use strict";
var vscode_1 = require('vscode');
var async_1 = require('./utils/async');
var Cranefs_1 = require('./utils/Cranefs');
var Debug_1 = require('./utils/Debug');
var Config_1 = require('./utils/Config');
var exec = require('child_process').exec;
var util = require('util');
var craneSettings = vscode_1.workspace.getConfiguration("crane");
var cranefs = new Cranefs_1.Cranefs();
console.log(process.platform);
var Crane = (function () {
    function Crane(languageClient) {
        var _this = this;
        Crane.langClient = languageClient;
        this.delayers = Object.create(null);
        var subscriptions = [];
        vscode_1.workspace.onDidChangeTextDocument(function (e) { return _this.onChangeTextHandler(e.document); }, null, subscriptions);
        vscode_1.workspace.onDidCloseTextDocument(function (textDocument) { delete _this.delayers[textDocument.uri.toString()]; }, null, subscriptions);
        vscode_1.workspace.onDidSaveTextDocument(function (document) { return _this.handleFileSave(); });
        this.disposable = vscode_1.Disposable.from.apply(vscode_1.Disposable, subscriptions);
        if (!Crane.statusBarItem) {
            Crane.statusBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left);
            Crane.statusBarItem.hide();
        }
        this.checkVersion().then(function (indexTriggered) {
            _this.doInit(indexTriggered);
        });
    }
    Crane.prototype.checkVersion = function () {
        var self = this;
        Debug_1.Debug.info('Checking the current version of Crane');
        return new Promise(function (resolve, reject) {
            cranefs.getVersionFile().then(function (result) {
                if (result.err && result.err.code == "ENOENT") {
                    // New install
                    vscode_1.window.showInformationMessage("Welcome to Crane v" + Config_1.Config.version + ".", "Getting Started Guide").then(function (data) {
                        if (data != null) {
                            Crane.openLinkInBrowser("https://github.com/HvyIndustries/crane/wiki/end-user-guide#getting-started");
                        }
                    });
                    cranefs.createOrUpdateVersionFile(false);
                    cranefs.deleteAllCaches().then(function (item) {
                        self.processAllFilesInWorkspace();
                        resolve(true);
                    });
                }
                else {
                    // Strip newlines from data
                    result.data = result.data.replace("\n", "");
                    result.data = result.data.replace("\r", "");
                    if (result.data && result.data != Config_1.Config.version) {
                        // Updated install
                        vscode_1.window.showInformationMessage("You're been upgraded to Crane v" + Config_1.Config.version + ".", "View Release Notes").then(function (data) {
                            if (data == "View Release Notes") {
                                Crane.openLinkInBrowser("https://github.com/HvyIndustries/crane/releases");
                            }
                        });
                        cranefs.createOrUpdateVersionFile(true);
                        cranefs.deleteAllCaches().then(function (item) {
                            self.processAllFilesInWorkspace();
                            resolve(true);
                        });
                    }
                    else {
                        resolve(false);
                    }
                }
            });
        });
    };
    Crane.prototype.doInit = function (indexInProgress) {
        console.log("Crane Initialised...");
        this.showIndexingStatusBarMessage();
        var statusBarItem = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Right);
        statusBarItem.text = Config_1.Config.version;
        statusBarItem.tooltip = 'Crane (PHP Code-completion) version ' + Config_1.Config.version;
        statusBarItem.show();
        var serverDebugMessage = { method: "serverDebugMessage" };
        Crane.langClient.onNotification(serverDebugMessage, function (message) {
            switch (message.type) {
                case 'info':
                    Debug_1.Debug.info(message.message);
                    break;
                case 'error':
                    Debug_1.Debug.error(message.message);
                    break;
                case 'warning':
                    Debug_1.Debug.warning(message.message);
                    break;
                default:
                    Debug_1.Debug.info(message.message);
                    break;
            }
        });
        var requestType = { method: "workDone" };
        Crane.langClient.onRequest(requestType, function (tree) {
            // this.projectBuilding = false;
            Crane.statusBarItem.text = '$(check) PHP File Indexing Complete!';
            // Load settings
            var craneSettings = vscode_1.workspace.getConfiguration("crane");
            Debug_1.Debug.info("Processing complete!");
            if (Config_1.Config.showBugReport) {
                setTimeout(function () {
                    Crane.statusBarItem.tooltip = "Found a problem with the PHP Intellisense provided by Crane? Click here to file a bug report on Github";
                    Crane.statusBarItem.text = "$(bug) Found a PHP Intellisense Bug?";
                    Crane.statusBarItem.command = "crane.reportBug";
                    Crane.statusBarItem.show();
                }, 5000);
            }
            else {
                Crane.statusBarItem.hide();
            }
        });
        var types = Config_1.Config.phpFileTypes;
        Debug_1.Debug.info("Watching these files: {" + types.include.join(',') + "}");
        var fsw = vscode_1.workspace.createFileSystemWatcher("{" + types.include.join(',') + "}");
        fsw.onDidChange(function (e) {
            vscode_1.workspace.openTextDocument(e).then(function (document) {
                if (document.languageId != 'php')
                    return;
                Debug_1.Debug.info('File Changed: ' + e.fsPath);
                Crane.langClient.sendRequest({ method: 'buildObjectTreeForDocument' }, {
                    path: e.fsPath,
                    text: document.getText()
                });
            });
        });
        fsw.onDidCreate(function (e) {
            vscode_1.workspace.openTextDocument(e).then(function (document) {
                if (document.languageId != 'php')
                    return;
                Debug_1.Debug.info('File Created: ' + e.fsPath);
                Crane.langClient.sendRequest({ method: 'buildObjectTreeForDocument' }, {
                    path: e.fsPath,
                    text: document.getText()
                });
            });
        });
        fsw.onDidDelete(function (e) {
            Debug_1.Debug.info('File Deleted: ' + e.fsPath);
            Crane.langClient.sendRequest({ method: 'deleteFile' }, {
                path: e.fsPath
            });
        });
        if (!indexInProgress) {
            // Send request to server to build object tree for all workspace files
            this.processAllFilesInWorkspace();
        }
    };
    Crane.prototype.showIndexingStatusBarMessage = function () {
        Crane.statusBarItem.text = "$(zap) Indexing PHP source files...";
        Crane.statusBarItem.tooltip = "Crane is processing the PHP source files in the workspace to build code completion suggestions";
        Crane.statusBarItem.show();
    };
    Crane.prototype.reportBug = function () {
        Crane.openLinkInBrowser("https://github.com/HvyIndustries/crane/issues");
    };
    Crane.openLinkInBrowser = function (link) {
        var openCommand = "";
        switch (process.platform) {
            case 'darwin':
            case 'linux':
                openCommand = 'open ';
                break;
            case 'win32':
                openCommand = 'start ';
                break;
            default:
                return;
        }
        exec(openCommand + link);
    };
    Crane.prototype.handleFileSave = function () {
        var editor = vscode_1.window.activeTextEditor;
        if (editor == null)
            return;
        var document = editor.document;
        this.buildObjectTreeForDocument(document).then(function () {
            Crane.langClient.sendRequest({ method: 'saveTreeCache' }, { projectDir: cranefs.getProjectDir(), projectTree: cranefs.getTreePath() });
        }).catch(function (error) {
            Debug_1.Debug.error(util.inspect(error, false, null));
        });
    };
    Crane.prototype.processAllFilesInWorkspace = function () {
        var _this = this;
        cranefs.createProjectDir().then(function (data) {
            var createTreeFile = false;
            // Folder was created so there is no tree cache
            if (data.folderCreated) {
                _this.processWorkspaceFiles();
            }
            else {
                // Check for a tree file, if it exists load it;
                // otherwise we need to process the files in the workspace
                cranefs.doesProjectTreeExist().then(function (tree) {
                    if (!tree.exists) {
                        _this.processWorkspaceFiles();
                    }
                    else {
                        _this.processProject();
                    }
                });
            }
        }).catch(function (error) {
            Debug_1.Debug.error(util.inspect(error, false, null));
        });
    };
    Crane.prototype.deleteCaches = function () {
        var self = this;
        cranefs.deleteAllCaches().then(function (success) {
            vscode_1.window.showInformationMessage('All PHP file caches were successfully deleted');
            self.processAllFilesInWorkspace();
        });
    };
    Crane.prototype.rebuildProject = function () {
        cranefs.rebuildProject();
    };
    Crane.prototype.downloadPHPLibraries = function () {
        cranefs.downloadPHPLibraries();
    };
    Crane.prototype.processWorkspaceFiles = function () {
        cranefs.processWorkspaceFiles();
    };
    Crane.prototype.processProject = function () {
        cranefs.processProject();
    };
    Crane.prototype.onChangeTextHandler = function (textDocument) {
        var _this = this;
        // Only parse PHP files
        if (textDocument.languageId != "php")
            return;
        var key = textDocument.uri.toString();
        var delayer = this.delayers[key];
        if (!delayer) {
            delayer = new async_1.ThrottledDelayer(500);
            this.delayers[key] = delayer;
        }
        delayer.trigger(function () { return _this.buildObjectTreeForDocument(textDocument); });
    };
    Crane.prototype.buildObjectTreeForDocument = function (document) {
        return new Promise(function (resolve, reject) {
            var path = document.fileName;
            var text = document.getText();
            var projectDir = cranefs.getProjectDir();
            var projectTree = cranefs.getTreePath();
            var requestType = { method: "buildObjectTreeForDocument" };
            Crane.langClient.sendRequest(requestType, { path: path, text: text, projectDir: projectDir, projectTree: projectTree }).then(function () { return resolve(); });
        });
    };
    Crane.prototype.dispose = function () {
        this.disposable.dispose();
        Crane.statusBarItem.dispose();
    };
    return Crane;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Crane;
//# sourceMappingURL=crane.js.map
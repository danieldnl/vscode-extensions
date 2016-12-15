"use strict";
var vscode_1 = require('vscode');
var crane_1 = require('../crane');
var Debug_1 = require('./Debug');
var Config_1 = require('./Config');
var crypto = require('crypto');
var fs = require('fs');
var fstream = require('fstream');
var http = require('https');
var unzip = require('unzip');
var util = require('util');
var mkdirp = require('mkdirp');
var rmrf = require('rimraf');
var craneSettings = vscode_1.workspace.getConfiguration("crane");
var Cranefs = (function () {
    function Cranefs() {
    }
    Cranefs.prototype.isCacheable = function () {
        return Config_1.Config.enableCache;
    };
    Cranefs.prototype.getCraneDir = function () {
        if (process.env.APPDATA) {
            return process.env.APPDATA + '/Crane';
        }
        if (process.platform == 'darwin') {
            return process.env.HOME + '/Library/Preferences/Crane';
        }
        if (process.platform == 'linux') {
            return process.env.HOME + '/Crane';
        }
    };
    Cranefs.prototype.getVersionFile = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var filePath = _this.getCraneDir() + "/version";
            fs.readFile(filePath, "utf-8", function (err, data) {
                resolve({ err: err, data: data });
            });
        });
    };
    Cranefs.prototype.createOrUpdateVersionFile = function (fileExists) {
        var filePath = this.getCraneDir() + "/version";
        if (fileExists) {
            // Delete the file
            fs.unlinkSync(filePath);
        }
        // Create the file + write Config.version into it
        mkdirp(this.getCraneDir(), function (err) {
            if (err) {
                Debug_1.Debug.error(err);
                return;
            }
            fs.writeFile(filePath, Config_1.Config.version, "utf-8", function (err) {
                if (err != null) {
                    Debug_1.Debug.error(err);
                }
            });
        });
    };
    Cranefs.prototype.deleteAllCaches = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            rmrf(_this.getCraneDir() + '/projects/*', function (err) {
                if (!err) {
                    Debug_1.Debug.info('Project caches were deleted');
                    return resolve(true);
                }
                Debug_1.Debug.info('Project caches were not deleted');
                return resolve(false);
            });
        });
    };
    Cranefs.prototype.getProjectDir = function () {
        var md5sum = crypto.createHash('md5');
        // Get the workspace location for the user
        return this.getCraneDir() + '/projects/' + (md5sum.update(vscode_1.workspace.rootPath)).digest('hex');
    };
    Cranefs.prototype.getStubsDir = function () {
        return this.getCraneDir() + '/phpstubs';
    };
    Cranefs.prototype.getTreePath = function () {
        return this.getProjectDir() + '/tree.cache';
    };
    Cranefs.prototype.createProjectDir = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.isCacheable()) {
                _this.createProjectFolder().then(function (projectCreated) {
                    resolve(projectCreated);
                }).catch(function (error) {
                    Debug_1.Debug.error(util.inspect(error, false, null));
                });
            }
            else {
                resolve({ folderExists: false, folderCreated: false, path: null });
            }
        });
    };
    Cranefs.prototype.doesProjectTreeExist = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            fs.stat(_this.getTreePath(), function (err, stat) {
                if (err === null) {
                    resolve({ exists: true, path: _this.getTreePath() });
                }
                else {
                    resolve({ exists: false, path: null });
                }
            });
        });
    };
    Cranefs.prototype.processWorkspaceFiles = function (rebuild) {
        var _this = this;
        if (rebuild === void 0) { rebuild = false; }
        if (vscode_1.workspace.rootPath == undefined)
            return;
        var fileProcessCount = 0;
        // Get PHP files from 'files.associations' to be processed
        var files = Config_1.Config.phpFileTypes;
        // Exclude files ignored by the user
        files.exclude = files.exclude.concat(Config_1.Config.ignoredPaths);
        // Find all the php files to process
        vscode_1.workspace.findFiles("{" + files.include.join(',') + "}", "{" + files.exclude.join(',') + "}").then(function (files) {
            Debug_1.Debug.info("Preparing to parse " + files.length + " PHP source files...");
            fileProcessCount = files.length;
            var filePaths = [];
            // Get the objects path value for the current file system
            files.forEach(function (file) {
                filePaths.push(file.fsPath);
            });
            crane_1.default.statusBarItem.text = "$(zap) Indexing PHP files";
            // Send the array of paths to the language server
            crane_1.default.langClient.sendRequest({ method: "buildFromFiles" }, {
                files: filePaths,
                craneRoot: _this.getCraneDir(),
                projectPath: _this.getProjectDir(),
                treePath: _this.getTreePath(),
                enableCache: _this.isCacheable(),
                rebuild: rebuild
            });
            // Update the UI so the user knows the processing status
            var fileProcessed = { method: "fileProcessed" };
            crane_1.default.langClient.onNotification(fileProcessed, function (data) {
                // Get the percent complete
                var percent = ((data.total / fileProcessCount) * 100).toFixed(1);
                crane_1.default.statusBarItem.text = "$(zap) Indexing PHP files (" + data.total + " of " + fileProcessCount + " / " + percent + "%)";
                if (data.error) {
                    Debug_1.Debug.error("There was a problem parsing PHP file: " + data.filename);
                    Debug_1.Debug.error("" + data.error);
                }
                else {
                    Debug_1.Debug.info("Parsed file " + data.total + " of " + fileProcessCount + " : " + data.filename);
                }
            });
        });
    };
    Cranefs.prototype.processProject = function () {
        Debug_1.Debug.info('Building project from cache file: ' + this.getTreePath());
        crane_1.default.langClient.sendRequest({ method: "buildFromProject" }, {
            treePath: this.getTreePath(),
            enableCache: this.isCacheable()
        });
    };
    Cranefs.prototype.rebuildProject = function () {
        var _this = this;
        Debug_1.Debug.info('Rebuilding the project files');
        fs.unlink(this.getTreePath(), function (err) {
            _this.createProjectFolder().then(function (success) {
                if (success) {
                    _this.processWorkspaceFiles(true);
                }
            });
        });
    };
    Cranefs.prototype.downloadPHPLibraries = function () {
        var _this = this;
        var zip = Config_1.Config.phpstubsZipFile;
        var tmp = this.getCraneDir() + '/phpstubs.tmp.zip';
        Debug_1.Debug.info("Downloading " + zip + " to " + tmp);
        this.createPhpStubsFolder().then(function (created) {
            if (created) {
                var file = fs.createWriteStream(tmp);
                http.get(zip, function (response) {
                    response.pipe(file);
                    response.on('end', function () {
                        Debug_1.Debug.info('PHPStubs Download Complete');
                        Debug_1.Debug.info("Unzipping to " + _this.getStubsDir());
                        fs.createReadStream(tmp)
                            .pipe(unzip.Parse())
                            .pipe(fstream.Writer(_this.getStubsDir()));
                        vscode_1.window.showInformationMessage('PHP Library Stubs downloaded and installed. You may need to re-index the workspace for them to work correctly.', 'Rebuild Now').then(function (item) {
                            _this.rebuildProject();
                        });
                    });
                });
            }
        }).catch(function (error) {
            Debug_1.Debug.error(util.inspect(error, false, null));
        });
    };
    Cranefs.prototype.createProjectFolder = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            mkdirp(_this.getProjectDir(), function (err) {
                if (err) {
                    resolve(false);
                }
                else {
                    resolve(true);
                }
            });
        });
    };
    Cranefs.prototype.createPhpStubsFolder = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var craneDir = _this.getCraneDir();
            mkdirp(craneDir + '/phpstubs', function (err) {
                if (err) {
                    resolve(false);
                }
                else {
                    resolve(true);
                }
            });
        });
    };
    return Cranefs;
}());
exports.Cranefs = Cranefs;
//# sourceMappingURL=Cranefs.js.map
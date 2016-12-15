/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
'use strict';
var vscode_languageserver_1 = require('vscode-languageserver');
var treeBuilder_1 = require("./hvy/treeBuilder");
var Debug_1 = require('./util/Debug');
var suggestionBuilder_1 = require('./suggestionBuilder');
var fs = require("fs");
var util = require('util');
var zlib = require('zlib');
// Glob for file searching
var glob = require("glob");
// FileQueue for queuing files so we don't open too many
var FileQueue = require('filequeue');
var fq = new FileQueue(200);
var connection = vscode_languageserver_1.createConnection(new vscode_languageserver_1.IPCMessageReader(process), new vscode_languageserver_1.IPCMessageWriter(process));
var documents = new vscode_languageserver_1.TextDocuments();
documents.listen(connection);
Debug_1.Debug.SetConnection(connection);
var treeBuilder = new treeBuilder_1.TreeBuilder();
treeBuilder.SetConnection(connection);
var workspaceTree = [];
// Prevent garbage collection of essential objects
var timer = setInterval(function () {
    treeBuilder.Ping();
    return workspaceTree.length;
}, 15000);
var workspaceRoot;
var craneProjectDir;
var enableCache = true;
connection.onInitialize(function (params) {
    workspaceRoot = params.rootPath;
    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', ':', '$', '>']
            }
        }
    };
});
// hold the maxNumberOfProblems setting
var maxNumberOfProblems;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration(function (change) {
    var settings = change.settings;
    maxNumberOfProblems = settings.languageServerExample.maxNumberOfProblems || 100;
    // Revalidate any open text documents
    //documents.all().forEach(validateTextDocument);
});
// Use this to send a request to the client
// https://github.com/Microsoft/vscode/blob/80bd73b5132268f68f624a86a7c3e56d2bbac662/extensions/json/client/src/jsonMain.ts
// https://github.com/Microsoft/vscode/blob/580d19ab2e1fd6488c3e515e27fe03dceaefb819/extensions/json/server/src/server.ts
//connection.sendRequest()
connection.onDidChangeWatchedFiles(function (change) {
    // Monitored files have change in VSCode
    connection.console.log('We recevied an file change event');
});
// This handler provides the initial list of the completion items.
connection.onCompletion(function (textDocumentPosition) {
    if (textDocumentPosition.languageId != "php")
        return;
    var doc = documents.get(textDocumentPosition.uri);
    var suggestionBuilder = new suggestionBuilder_1.SuggestionBuilder();
    suggestionBuilder.prepare(textDocumentPosition, doc, workspaceTree);
    var toReturn = suggestionBuilder.build();
    return toReturn;
});
// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve(function (item) {
    // TODO -- Add phpDoc info
    // if (item.data === 1) {
    //     item.detail = 'TypeScript details',
    //     item.documentation = 'TypeScript documentation'
    // } else if (item.data === 2) {
    //     item.detail = 'JavaScript details',
    //     item.documentation = 'JavaScript documentation'
    // }
    return item;
});
var buildObjectTreeForDocument = { method: "buildObjectTreeForDocument" };
connection.onRequest(buildObjectTreeForDocument, function (requestObj) {
    var fileUri = requestObj.path;
    var text = requestObj.text;
    treeBuilder.Parse(text, fileUri).then(function (result) {
        addToWorkspaceTree(result.tree);
        // notifyClientOfWorkComplete();
        return true;
    })
        .catch(function (error) {
        console.log(error);
        notifyClientOfWorkComplete();
        return false;
    });
});
var deleteFile = { method: "deleteFile" };
connection.onRequest(deleteFile, function (requestObj) {
    var node = getFileNodeFromPath(requestObj.path);
    if (node instanceof treeBuilder_1.FileNode) {
        removeFromWorkspaceTree(node);
    }
});
var saveTreeCache = { method: "saveTreeCache" };
connection.onRequest(saveTreeCache, function (request) {
    saveProjectTree(request.projectDir, request.projectTree).then(function (saved) {
        notifyClientOfWorkComplete();
    }).catch(function (error) {
        Debug_1.Debug.error(util.inspect(error, false, null));
    });
});
var docsDoneCount = 0;
var docsToDo = [];
var stubsToDo = [];
var buildFromFiles = { method: "buildFromFiles" };
connection.onRequest(buildFromFiles, function (project) {
    if (project.rebuild) {
        workspaceTree = [];
        treeBuilder = new treeBuilder_1.TreeBuilder();
    }
    enableCache = project.enableCache;
    docsToDo = project.files;
    docsDoneCount = 0;
    connection.console.log('starting work!');
    // Run asynchronously
    setTimeout(function () {
        glob(project.craneRoot + '/phpstubs/*/*.php', function (err, fileNames) {
            // Process the php stubs
            stubsToDo = fileNames;
            Debug_1.Debug.info("Processing " + stubsToDo.length + " stubs from " + project.craneRoot + "/phpstubs");
            connection.console.log("Stub files to process: " + stubsToDo.length);
            processStub().then(function (data) {
                connection.console.log('stubs done!');
                connection.console.log("Workspace files to process: " + docsToDo.length);
                processWorkspaceFiles(project.projectPath, project.treePath);
            }).catch(function (data) {
                connection.console.log('No stubs found!');
                connection.console.log("Workspace files to process: " + docsToDo.length);
                processWorkspaceFiles(project.projectPath, project.treePath);
            });
        });
    }, 100);
});
var buildFromProject = { method: "buildFromProject" };
connection.onRequest(buildFromProject, function (data) {
    enableCache = data.enableCache;
    fs.readFile(data.treePath, function (err, data) {
        if (err) {
            Debug_1.Debug.error('Could not read cache file');
            Debug_1.Debug.error((util.inspect(err, false, null)));
        }
        else {
            Debug_1.Debug.info('Unzipping the file');
            var treeStream = new Buffer(data);
            zlib.gunzip(treeStream, function (err, buffer) {
                if (err) {
                    Debug_1.Debug.error('Could not unzip cache file');
                    Debug_1.Debug.error((util.inspect(err, false, null)));
                }
                else {
                    Debug_1.Debug.info('Cache file successfully read');
                    workspaceTree = JSON.parse(buffer.toString());
                    Debug_1.Debug.info('Loaded');
                    notifyClientOfWorkComplete();
                }
            });
        }
    });
});
/**
 * Processes the stub files
 */
function processStub() {
    return new Promise(function (resolve, reject) {
        var offset = 0;
        if (stubsToDo.length == 0) {
            reject();
        }
        stubsToDo.forEach(function (file) {
            fq.readFile(file, { encoding: 'utf8' }, function (err, data) {
                treeBuilder.Parse(data, file).then(function (result) {
                    addToWorkspaceTree(result.tree);
                    connection.console.log(offset + " Stub Processed: " + file);
                    offset++;
                    if (offset == stubsToDo.length) {
                        resolve();
                    }
                }).catch(function (err) {
                    connection.console.log(offset + " Stub Error: " + file);
                    Debug_1.Debug.error((util.inspect(err, false, null)));
                    offset++;
                    if (offset == stubsToDo.length) {
                        resolve();
                    }
                });
            });
        });
    });
}
/**
 * Processes the users workspace files
 */
function processWorkspaceFiles(projectPath, treePath) {
    docsToDo.forEach(function (file) {
        fq.readFile(file, { encoding: 'utf8' }, function (err, data) {
            treeBuilder.Parse(data, file).then(function (result) {
                addToWorkspaceTree(result.tree);
                docsDoneCount++;
                connection.console.log("(" + docsDoneCount + " of " + docsToDo.length + ") File: " + file);
                connection.sendNotification({ method: "fileProcessed" }, { filename: file, total: docsDoneCount, error: null });
                if (docsToDo.length == docsDoneCount) {
                    workspaceProcessed(projectPath, treePath);
                }
            }).catch(function (data) {
                docsDoneCount++;
                if (docsToDo.length == docsDoneCount) {
                    workspaceProcessed(projectPath, treePath);
                }
                connection.console.log(util.inspect(data, false, null));
                connection.console.log("Issue processing " + file);
                connection.sendNotification({ method: "fileProcessed" }, { filename: file, total: docsDoneCount, error: util.inspect(data, false, null) });
            });
        });
    });
}
function workspaceProcessed(projectPath, treePath) {
    Debug_1.Debug.info("Workspace files have processed");
    saveProjectTree(projectPath, treePath).then(function (savedTree) {
        notifyClientOfWorkComplete();
        if (savedTree) {
            Debug_1.Debug.info('Project tree has been saved');
        }
    }).catch(function (error) {
        Debug_1.Debug.error(util.inspect(error, false, null));
    });
}
function addToWorkspaceTree(tree) {
    // Loop through existing filenodes and replace if exists, otherwise add
    var fileNode = workspaceTree.filter(function (fileNode) {
        return fileNode.path == tree.path;
    })[0];
    var index = workspaceTree.indexOf(fileNode);
    if (index !== -1) {
        workspaceTree[index] = tree;
    }
    else {
        workspaceTree.push(tree);
    }
    // Debug
    // connection.console.log("Parsed file: " + tree.path);
}
function removeFromWorkspaceTree(tree) {
    var index = workspaceTree.indexOf(tree);
    if (index > -1) {
        workspaceTree.splice(index, 1);
    }
}
function getClassNodeFromTree(className) {
    var toReturn = null;
    var fileNode = workspaceTree.forEach(function (fileNode) {
        fileNode.classes.forEach(function (classNode) {
            if (classNode.name.toLowerCase() == className.toLowerCase()) {
                toReturn = classNode;
            }
        });
    });
    return toReturn;
}
function getTraitNodeFromTree(traitName) {
    var toReturn = null;
    var fileNode = workspaceTree.forEach(function (fileNode) {
        fileNode.traits.forEach(function (traitNode) {
            if (traitNode.name.toLowerCase() == traitName.toLowerCase()) {
                toReturn = traitNode;
            }
        });
    });
    return toReturn;
}
function getFileNodeFromPath(path) {
    var returnNode = null;
    workspaceTree.forEach(function (fileNode) {
        if (fileNode.path == path) {
            returnNode = fileNode;
        }
    });
    return returnNode;
}
function notifyClientOfWorkComplete() {
    var requestType = { method: "workDone" };
    connection.sendRequest(requestType);
}
function saveProjectTree(projectPath, treeFile) {
    return new Promise(function (resolve, reject) {
        if (!enableCache) {
            resolve(false);
        }
        else {
            Debug_1.Debug.info('Packing tree file: ' + treeFile);
            fq.writeFile(projectPath + "/tree.tmp", JSON.stringify(workspaceTree), function (err) {
                if (err) {
                    Debug_1.Debug.error('Could not write to cache file');
                    Debug_1.Debug.error(util.inspect(err, false, null));
                    resolve(false);
                }
                else {
                    var gzip = zlib.createGzip();
                    var inp = fs.createReadStream(projectPath + "/tree.tmp");
                    var out = fs.createWriteStream(treeFile);
                    inp.pipe(gzip).pipe(out).on('close', function () {
                        fs.unlinkSync(projectPath + "/tree.tmp");
                    });
                    Debug_1.Debug.info('Cache file updated');
                    resolve(true);
                }
            });
        }
    });
}
connection.listen();
//# sourceMappingURL=server.js.map
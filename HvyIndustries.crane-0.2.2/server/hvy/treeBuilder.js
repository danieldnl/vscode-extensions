/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var phpParser = require("php-parser");
var connection;
function isset(value) {
    return typeof value != 'undefined';
}
var TreeBuilder = (function () {
    function TreeBuilder() {
    }
    // v1.5 - added extra types for variables
    // v1.4 - added lineCache
    // v1.3 - support for namespaces + use recursion
    // v1.2 - added option to suppress errors
    // v1.1
    // TODO -- Handle PHP written inside an HTML file (strip everything except php code)
    TreeBuilder.prototype.SetConnection = function (conn) {
        connection = conn;
    };
    // Parse PHP code to generate an object tree for intellisense suggestions
    TreeBuilder.prototype.Parse = function (text, filePath) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var parserInst = phpParser.create({
                parser: {
                    locations: true,
                    docBlocks: true,
                    suppressErrors: true
                }
            });
            var ast = parserInst.parseCode(text);
            parserInst = null;
            _this.BuildObjectTree(ast, filePath).then(function (tree) {
                var symbolCache = _this.BuildSymbolCache(tree, filePath).then(function (symbolCache) {
                    var returnObj = {
                        tree: tree,
                        symbolCache: symbolCache
                    };
                    resolve(returnObj);
                }).catch(function (data) {
                    reject(data);
                });
            }).catch(function (data) {
                reject(data);
            });
        });
    };
    TreeBuilder.prototype.Ping = function () {
        return "pong";
    };
    // Convert the generated AST into a usable object tree
    TreeBuilder.prototype.BuildObjectTree = function (ast, filePath) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var tree = new FileNode();
            tree.path = filePath;
            tree = _this.ProcessBranch(ast[1], [], tree);
            resolve(tree);
        });
    };
    TreeBuilder.prototype.ProcessBranch = function (branch, parentBranches, tree) {
        var _this = this;
        if (Array.isArray(branch) && Array.isArray(branch[0])) {
            // Only foreach if branch is an array of arrays
            branch.forEach(function (element) {
                if (element != null) {
                    _this.ProcessBranch(element, parentBranches, tree);
                }
            });
        }
        else {
            switch (branch[0]) {
                case "sys":
                    switch (branch[1]) {
                        case "require":
                        case "require_once":
                        case "include":
                        case "include_once":
                            // TODO -- Convert PHP constants such as dirname(__DIR__) and dirname(__FILE__) to absolute paths
                            // TODO -- Convert concatination to absolute paths (eg. "folder/" . "file.php")
                            if (branch[2].length == 2) {
                                var path = branch[2][1];
                                tree.fileReferences.push(path);
                            }
                            else if (branch[2][0] == "bin" && branch[2][1] == ".") {
                                var path_1 = "";
                                branch[2].forEach(function (item) {
                                    if (Array.isArray(item)) {
                                        if (item[0] == "string") {
                                            path_1 += item[1];
                                        }
                                        else if (item[0] == "var") {
                                        }
                                    }
                                });
                                tree.fileReferences.push(path_1);
                            }
                            break;
                    }
                    break;
                case "const":
                    var constantNode = new ConstantNode();
                    if (isset(branch[1][0][0] || false) && isset(branch[1][0][1][0] || false)) {
                        constantNode.name = branch[1][0][0];
                        constantNode.type = branch[1][0][1][0];
                        constantNode.value = branch[1][0][1][1];
                        // TODO -- Add location
                        tree.constants.push(constantNode);
                    }
                    break;
                case "use":
                    var namespaceUsingNode_1 = new NamespaceUsingNode();
                    namespaceUsingNode_1.name = branch[2];
                    branch[1].forEach(function (item) {
                        if (item != namespaceUsingNode_1.name) {
                            namespaceUsingNode_1.parents.push(item);
                        }
                    });
                    // TODO -- Add location
                    tree.namespaceUsings.push(namespaceUsingNode_1);
                    break;
                case "namespace":
                    // branch[1] is array of namespace parts
                    // branch[2] is array of classes/interfaces/traits inside namespace
                    branch[2].forEach(function (item) {
                        if (item != null) {
                            _this.ProcessBranch(item, branch[1], tree);
                        }
                    });
                    break;
                case "call":
                    // let calls = this.BuildFunctionCallsToOtherFunctions(branch);
                    break;
                case "set":
                    var variable = this.BuildVariableOrProp(branch);
                    if (variable != null) {
                        tree.topLevelVariables.push(variable.variableNode);
                        if (variable.lineCache != null) {
                            tree.lineCache.push(variable.lineCache);
                        }
                        var symbolCache = new FileSymbolCache();
                        symbolCache.name = variable.name;
                        symbolCache.type = SymbolType.TopLevelVariable;
                        tree.symbolCache.push(symbolCache);
                    }
                    break;
                case "position":
                    switch (branch[3][0]) {
                        case "function":
                            var methodNode_1 = new MethodNode();
                            methodNode_1.startPos = this.BuildStartLocation(branch[1]);
                            methodNode_1.endPos = this.BuildEndLocation(branch[2]);
                            methodNode_1.name = branch[3][1];
                            // Build return type
                            if (branch[3][5] != null && Array.isArray(branch[3][5]) && branch[3][5][0] != null) {
                                methodNode_1.returns = branch[3][5][0];
                            }
                            methodNode_1.params = this.BuildFunctionParams(branch[3][2], tree.lineCache, methodNode_1.startPos);
                            branch[3][6].forEach(function (codeLevel) {
                                if (codeLevel != null) {
                                    // Build local scope variable setters
                                    var scopeVar = _this.BuildVariableOrProp(codeLevel);
                                    if (scopeVar != null) {
                                        methodNode_1.scopeVariables.push(scopeVar.variableNode);
                                        if (scopeVar.lineCache != null) {
                                            tree.lineCache.push(scopeVar.lineCache);
                                        }
                                    }
                                    // Build function calls
                                    var functionCalls = _this.BuildFunctionCallsToOtherFunctions(codeLevel);
                                    functionCalls.forEach(function (element) {
                                        methodNode_1.functionCalls.push(element);
                                    });
                                    // Build imported global variables
                                    if (codeLevel[0] == "global") {
                                        codeLevel[1].forEach(function (importGlobalLevel) {
                                            if (importGlobalLevel[0] == "var") {
                                                methodNode_1.globalVariables.push(importGlobalLevel[1]);
                                            }
                                        });
                                    }
                                }
                            });
                            var symbolCache = new FileSymbolCache();
                            symbolCache.name = methodNode_1.name;
                            symbolCache.type = SymbolType.TopLevelFunction;
                            tree.symbolCache.push(symbolCache);
                            tree.functions.push(methodNode_1);
                            break;
                        case "interface":
                            var interfaceNode_1 = new InterfaceNode();
                            interfaceNode_1.name = branch[3][1];
                            // Build position
                            interfaceNode_1.startPos = this.BuildStartLocation(branch[1]);
                            interfaceNode_1.endPos = this.BuildEndLocation(branch[2]);
                            if (branch[3][3] != false) {
                                branch[3][3].forEach(function (extendedInterface) {
                                    interfaceNode_1.extends.push(extendedInterface[0]);
                                });
                            }
                            // Build constants
                            branch[3][4].constants.forEach(function (constant) {
                                var constantNode = new ConstantNode();
                                constantNode.name = constant[3][0][3][0];
                                if (constant[3][0][3][1] != null) {
                                    constantNode.type = constant[3][0][3][1][0];
                                    constantNode.value = constant[3][0][3][1][1];
                                }
                                constantNode.startPos = _this.BuildStartLocation(constant[3][0][1]);
                                constantNode.endPos = _this.BuildEndLocation(constant[3][0][2]);
                                interfaceNode_1.constants.push(constantNode);
                            });
                            // Build methods
                            branch[3][4].methods.forEach(function (method) {
                                var methodNode = new MethodNode();
                                methodNode.name = method[3][1];
                                methodNode.startPos = _this.BuildStartLocation(method[1]);
                                methodNode.endPos = _this.BuildEndLocation(method[2]);
                                // Build return type
                                if (method[3][5] != null && Array.isArray(method[3][5]) && method[3][5][0] != null) {
                                    methodNode.returns = method[3][5][0];
                                }
                                methodNode.params = _this.BuildFunctionParams(method[3][2], tree.lineCache, methodNode.startPos);
                                interfaceNode_1.methods.push(methodNode);
                            });
                            var symbolCache = new FileSymbolCache();
                            symbolCache.name = interfaceNode_1.name;
                            symbolCache.type = SymbolType.Interface;
                            tree.symbolCache.push(symbolCache);
                            tree.interfaces.push(interfaceNode_1);
                            break;
                        case "trait":
                            var traitNode = new TraitNode();
                            traitNode.name = branch[3][1];
                            // Build position
                            traitNode.startPos = this.BuildStartLocation(branch[1]);
                            traitNode.endPos = this.BuildEndLocation(branch[2]);
                            if (branch[3][2] != false) {
                                traitNode.extends = branch[3][2][0];
                            }
                            branch[3][4].properties.forEach(function (propLevel) {
                                var propNode = new PropertyNode();
                                propNode.startPos = _this.BuildStartLocation(propLevel[3][0][1]);
                                propNode.endPos = _this.BuildEndLocation(propLevel[3][0][2]);
                                if (propLevel[4][0] == 0) {
                                    propNode.accessModifier = AccessModifierNode.public;
                                }
                                if (propLevel[4][0] == 1) {
                                    propNode.accessModifier = AccessModifierNode.protected;
                                }
                                if (propLevel[4][0] == 2) {
                                    propNode.accessModifier = AccessModifierNode.private;
                                }
                                if (propLevel[4][1] == 1) {
                                    propNode.isStatic = true;
                                }
                                propLevel = propLevel[3][0];
                                propNode.name = propLevel[3][0];
                                if (propLevel[3][1] != null) {
                                    propNode.type = propLevel[3][1][0];
                                }
                                var symbolCache = new FileSymbolCache();
                                symbolCache.name = propNode.name;
                                symbolCache.type = SymbolType.Property;
                                symbolCache.parentName = traitNode.name;
                                tree.symbolCache.push(symbolCache);
                                traitNode.properties.push(propNode);
                            });
                            // Build constants
                            branch[3][4].constants.forEach(function (constant) {
                                var constantNode = new ConstantNode();
                                constantNode.name = constant[3][0][3][0];
                                if (constant[3][0][3][1] != null) {
                                    constantNode.type = constant[3][0][3][1][0];
                                    constantNode.value = constant[3][0][3][1][1];
                                }
                                constantNode.startPos = _this.BuildStartLocation(constant[3][0][1]);
                                constantNode.endPos = _this.BuildEndLocation(constant[3][0][2]);
                                var symbolCache = new FileSymbolCache();
                                symbolCache.name = constantNode.name;
                                symbolCache.type = SymbolType.Constant;
                                symbolCache.parentName = traitNode.name;
                                tree.symbolCache.push(symbolCache);
                                traitNode.constants.push(constantNode);
                            });
                            // Build methods
                            branch[3][4].methods.forEach(function (method) {
                                var methodNode = new MethodNode();
                                methodNode.name = method[3][1];
                                methodNode.startPos = _this.BuildStartLocation(method[1]);
                                methodNode.endPos = _this.BuildEndLocation(method[2]);
                                // Build return type
                                if (method[3][5] != null && Array.isArray(method[3][5]) && method[3][5][0] != null) {
                                    methodNode.returns = method[3][5][0];
                                }
                                methodNode.params = _this.BuildFunctionParams(method[3][2], tree.lineCache, methodNode.startPos);
                                methodNode.isAbstract = false;
                                var symbolCache = new FileSymbolCache();
                                symbolCache.name = methodNode.name;
                                symbolCache.type = SymbolType.Method;
                                symbolCache.parentName = traitNode.name;
                                tree.symbolCache.push(symbolCache);
                                traitNode.methods.push(methodNode);
                            });
                            branch[3][4].use.traits.forEach(function (traitLevel) {
                                traitNode.traits.push(traitLevel[0]);
                            });
                            var symbolCache = new FileSymbolCache();
                            symbolCache.name = traitNode.name;
                            symbolCache.type = SymbolType.Trait;
                            tree.symbolCache.push(symbolCache);
                            tree.traits.push(traitNode);
                            break;
                        case "class":
                            var classNode_1 = new ClassNode();
                            classNode_1.startPos = this.BuildStartLocation(branch[1]);
                            classNode_1.endPos = this.BuildEndLocation(branch[2]);
                            classNode_1.name = branch[3][1];
                            if (branch[3][3] != false) {
                                classNode_1.extends = branch[3][3][0];
                            }
                            if (parentBranches != null && parentBranches.length > 0) {
                                // Add namespaces
                                parentBranches.forEach(function (item) {
                                    classNode_1.namespaceParts.push(item);
                                });
                            }
                            branch = branch[3];
                            // Build interfaces
                            if (branch[4] != false) {
                                for (var i = 0; i < branch[4].length; i++) {
                                    var subElement = branch[4][i];
                                    classNode_1.implements.push(subElement[0]);
                                }
                            }
                            if (branch[2] == 187) {
                                classNode_1.isAbstract = true;
                            }
                            if (branch[2] == 189) {
                                classNode_1.isFinal = true;
                            }
                            // Build properties
                            branch[5].properties.forEach(function (propLevel) {
                                var propNode = new PropertyNode();
                                propNode.startPos = _this.BuildStartLocation(propLevel[1]);
                                propNode.endPos = _this.BuildEndLocation(propLevel[2]);
                                if (propLevel[4][0] == 0) {
                                    propNode.accessModifier = AccessModifierNode.public;
                                }
                                if (propLevel[4][0] == 1) {
                                    propNode.accessModifier = AccessModifierNode.protected;
                                }
                                if (propLevel[4][0] == 2) {
                                    propNode.accessModifier = AccessModifierNode.private;
                                }
                                if (propLevel[4][1] == 1) {
                                    propNode.isStatic = true;
                                }
                                if (propLevel[3][0] != null) {
                                    propLevel = propLevel[3][0];
                                    propNode.name = propLevel[3][0];
                                    if (propLevel[3][1] != null) {
                                        var type = propLevel[3][1][0];
                                        if (type == "position") {
                                            type = propLevel[3][1][3][0];
                                        }
                                        if (type == "string" || type == "number" || type == "array") {
                                            propNode.type = type;
                                        }
                                        else if (type == "const") {
                                            if (propLevel[3][1][1][0].toLowerCase() == "true" || propLevel[3][1][1][0].toLowerCase() == "false") {
                                                propNode.type = "boolean";
                                            }
                                            else if (propLevel[3][1][1][0].toLowerCase() == "null") {
                                                propNode.type = "null";
                                            }
                                        }
                                    }
                                    var symbolCache = new FileSymbolCache();
                                    symbolCache.name = propNode.name;
                                    symbolCache.type = SymbolType.Property;
                                    symbolCache.parentName = classNode_1.name;
                                    tree.symbolCache.push(symbolCache);
                                    classNode_1.properties.push(propNode);
                                }
                            });
                            // Build constants
                            branch[5].constants.forEach(function (constLevel) {
                                var constNode = new ConstantNode();
                                constNode.startPos = _this.BuildStartLocation(constLevel[1]);
                                constNode.endPos = _this.BuildEndLocation(constLevel[2]);
                                constNode.name = constLevel[3][0][3][0];
                                if (constLevel[3][0][3][1] != null) {
                                    constNode.type = constLevel[3][0][3][1][0];
                                    constNode.value = constLevel[3][0][3][1][1];
                                }
                                var symbolCache = new FileSymbolCache();
                                symbolCache.name = constNode.name;
                                symbolCache.type = SymbolType.Constant;
                                symbolCache.parentName = classNode_1.name;
                                tree.symbolCache.push(symbolCache);
                                classNode_1.constants.push(constNode);
                            });
                            // Build methods
                            branch[5].methods.forEach(function (methodLevel) {
                                // Build constructor (newstyle + oldstyle)
                                if (methodLevel[3][1] == "__construct" || methodLevel[3][1] == classNode_1.name) {
                                    var constructorNode_1 = new ConstructorNode();
                                    constructorNode_1.name = methodLevel[3][1];
                                    constructorNode_1.startPos = _this.BuildStartLocation(methodLevel[1]);
                                    constructorNode_1.endPos = _this.BuildEndLocation(methodLevel[2]);
                                    if (methodLevel[3][1] == classNode_1.name) {
                                        constructorNode_1.isDeprecated = true;
                                    }
                                    constructorNode_1.params = _this.BuildFunctionParams(methodLevel[3][2], tree.lineCache, constructorNode_1.startPos);
                                    if (methodLevel[3][6] != null) {
                                        methodLevel[3][6].forEach(function (codeLevel) {
                                            if (codeLevel != null) {
                                                // Build local scope variable setters
                                                var scopeVar = _this.BuildVariableOrProp(codeLevel);
                                                if (scopeVar != null) {
                                                    constructorNode_1.scopeVariables.push(scopeVar.variableNode);
                                                    if (scopeVar.lineCache != null) {
                                                        tree.lineCache.push(scopeVar.lineCache);
                                                    }
                                                }
                                                // Build function calls
                                                var functionCalls = _this.BuildFunctionCallsToOtherFunctions(codeLevel);
                                                functionCalls.forEach(function (element) {
                                                    constructorNode_1.functionCalls.push(element);
                                                });
                                                // Build imported global variables
                                                if (codeLevel[0] == "global") {
                                                    codeLevel[1].forEach(function (importGlobalLevel) {
                                                        if (importGlobalLevel[0] == "var") {
                                                            constructorNode_1.globalVariables.push(importGlobalLevel[1]);
                                                        }
                                                    });
                                                }
                                            }
                                        });
                                    }
                                    classNode_1.construct = constructorNode_1;
                                }
                                else {
                                    var methodNode_2 = new MethodNode();
                                    methodNode_2.startPos = _this.BuildStartLocation(methodLevel[1]);
                                    methodNode_2.endPos = _this.BuildEndLocation(methodLevel[2]);
                                    // Build access modifier
                                    if (methodLevel[4][0] == 0) {
                                        methodNode_2.accessModifier = AccessModifierNode.public;
                                    }
                                    if (methodLevel[4][0] == 1) {
                                        methodNode_2.accessModifier = AccessModifierNode.protected;
                                    }
                                    if (methodLevel[4][0] == 2) {
                                        methodNode_2.accessModifier = AccessModifierNode.private;
                                    }
                                    methodNode_2.name = methodLevel[3][1];
                                    // Mark static
                                    if (methodLevel[4][1] == 1) {
                                        methodNode_2.isStatic = true;
                                    }
                                    // Mark abstract
                                    if (methodLevel[4][2] == 1) {
                                        methodNode_2.isAbstract = true;
                                    }
                                    // Build return type
                                    if (methodLevel[3][5] != null && Array.isArray(methodLevel[3][5]) && methodLevel[3][5][0] != null) {
                                        methodNode_2.returns = methodLevel[3][5][0];
                                    }
                                    methodNode_2.params = _this.BuildFunctionParams(methodLevel[3][2], tree.lineCache, methodNode_2.startPos);
                                    if (methodLevel[3][6] != null) {
                                        methodLevel[3][6].forEach(function (codeLevel) {
                                            if (codeLevel != null) {
                                                // Build local scope variable setters
                                                var scopeVar = _this.BuildVariableOrProp(codeLevel);
                                                if (scopeVar != null) {
                                                    methodNode_2.scopeVariables.push(scopeVar.variableNode);
                                                    if (scopeVar.lineCache != null) {
                                                        tree.lineCache.push(scopeVar.lineCache);
                                                    }
                                                }
                                                // Build function calls
                                                var functionCalls = _this.BuildFunctionCallsToOtherFunctions(codeLevel);
                                                functionCalls.forEach(function (element) {
                                                    methodNode_2.functionCalls.push(element);
                                                });
                                                // Build imported global variables
                                                if (codeLevel[0] == "global") {
                                                    codeLevel[1].forEach(function (importGlobalLevel) {
                                                        if (importGlobalLevel[0] == "var") {
                                                            methodNode_2.globalVariables.push(importGlobalLevel[1]);
                                                        }
                                                    });
                                                }
                                            }
                                        });
                                    }
                                    var symbolCache = new FileSymbolCache();
                                    symbolCache.name = methodNode_2.name;
                                    symbolCache.type = SymbolType.Method;
                                    symbolCache.parentName = classNode_1.name;
                                    tree.symbolCache.push(symbolCache);
                                    classNode_1.methods.push(methodNode_2);
                                }
                            });
                            // Build Traits
                            branch[5].use.traits.forEach(function (traitLevel) {
                                classNode_1.traits.push(traitLevel[0]);
                            });
                            var symbolCache = new FileSymbolCache();
                            symbolCache.name = classNode_1.name;
                            symbolCache.type = SymbolType.Class;
                            tree.symbolCache.push(symbolCache);
                            tree.classes.push(classNode_1);
                            break;
                    }
                    break;
            }
        }
        return tree;
    };
    // Crunch through the generated tree to build a cache of symbols in this file
    TreeBuilder.prototype.BuildSymbolCache = function (tree, filePath) {
        return new Promise(function (resolve, reject) {
            var cache = [];
            // TODO
            resolve(cache);
        });
    };
    TreeBuilder.prototype.BuildStartLocation = function (start) {
        return new PositionInfo(start[0], start[1], start[2]);
    };
    TreeBuilder.prototype.BuildEndLocation = function (end) {
        return new PositionInfo(end[0], end[1], end[2]);
    };
    // paramsArray == methodLevel[3][2]
    TreeBuilder.prototype.BuildFunctionParams = function (paramsArray, lineCache, methodStartPos) {
        var params = [];
        if (paramsArray != null && paramsArray.length != 0) {
            // Build parameters
            paramsArray.forEach(function (paramLevel) {
                var paramNode = new ParameterNode();
                paramNode.name = paramLevel[0];
                paramNode.startPos = methodStartPos;
                if (Array.isArray(paramLevel[1])) {
                    paramNode.type = paramLevel[1][paramLevel[1].length - 1];
                    var lineCacheItem = new LineCache();
                    lineCacheItem.name = paramNode.name;
                    lineCacheItem.value = paramNode.type;
                    lineCacheItem.line = paramNode.startPos.line;
                    lineCache.push(lineCacheItem);
                }
                else {
                    paramNode.type = paramLevel[1];
                }
                if (paramLevel[2] != null && paramLevel[2].length != 0) {
                    paramNode.optional = true;
                    paramNode.type = paramLevel[2][0];
                }
                params.push(paramNode);
            });
        }
        return params;
    };
    TreeBuilder.prototype.BuildVariableOrProp = function (codeLevel) {
        if (codeLevel[0] == "set") {
            if (codeLevel[1][0] == "var") {
                var variableNode = new VariableNode();
                var lineCache = null;
                variableNode.name = codeLevel[1][1];
                var type = codeLevel[2][0];
                if (type == "string" || type == "number") {
                    variableNode.type = type;
                    variableNode.value = codeLevel[2][1];
                }
                else if (type == "const") {
                    variableNode.type = "boolean";
                    variableNode.value = codeLevel[2][1];
                }
                else if (type == "position") {
                    if (codeLevel[2][3] != null && Array.isArray(codeLevel[2][3]) && codeLevel[2][3][0] == "new") {
                        if (codeLevel[2][3][1][0] == "ns") {
                            variableNode.type = codeLevel[2][3][1][1][0];
                        }
                        else {
                            variableNode.type = codeLevel[2][3][1][0];
                        }
                        variableNode.startPos = this.BuildStartLocation(codeLevel[2][1]);
                        variableNode.endPos = this.BuildEndLocation(codeLevel[2][2]);
                        lineCache = new LineCache();
                        lineCache.line = variableNode.startPos.line;
                        lineCache.name = variableNode.name;
                        lineCache.value = variableNode.value;
                    }
                }
                else if (type == "call") {
                }
                return { variableNode: variableNode, lineCache: lineCache };
            }
            else if (codeLevel[1][0] == "prop") {
                var propSetNode = new VariableNode();
                var lineCache = null;
                if (codeLevel[1][1][1] == "$this") {
                    propSetNode.name = codeLevel[1][2][1];
                    var type_1 = codeLevel[2][0];
                    if (type_1 == "string" || type_1 == "number") {
                        propSetNode.type = type_1;
                        propSetNode.value = codeLevel[2][1];
                    }
                    else if (type_1 == "const") {
                        propSetNode.type = "boolean";
                        propSetNode.value = codeLevel[2][1];
                    }
                    else if (type_1 == "position") {
                        if (codeLevel[2][3] != null && Array.isArray(codeLevel[2][3]) && codeLevel[2][3][0] == "new") {
                            propSetNode.type = codeLevel[2][3][1][0];
                            //propSetNode.value = codeLevel[2][3][1][0];
                            propSetNode.variableType = "property";
                            propSetNode.startPos = this.BuildStartLocation(codeLevel[2][1]);
                            propSetNode.endPos = this.BuildEndLocation(codeLevel[2][2]);
                            lineCache = new LineCache();
                            lineCache.line = propSetNode.startPos.line;
                            lineCache.name = propSetNode.name;
                            lineCache.value = propSetNode.value;
                        }
                    }
                }
                return { variableNode: propSetNode, lineCache: lineCache };
            }
        }
        return null;
    };
    TreeBuilder.prototype.BuildFunctionCallsToOtherFunctions = function (codeLevel) {
        var _this = this;
        var functionCalls = [];
        // Handle cases where the function call isn't at the start of the line (eg. echo myFunc())
        if (codeLevel[0] != "call" && Array.isArray(codeLevel[2]) && Array.isArray(codeLevel[2][0]) && codeLevel[2][0].length > 0) {
            // TODO -- Handle more than one nested array
            // TODO -- Handle a function being called as a parameter
            codeLevel = codeLevel[2][0];
        }
        if (codeLevel[0] == "call") {
            var funcNode = new FunctionCallNode();
            if (codeLevel[1][0] == "ns") {
                var arrLength = codeLevel[1][1].length;
                funcNode.name = codeLevel[1][1][arrLength - 1];
                codeLevel[1][1].forEach(function (item) {
                    if (item != funcNode.name) {
                        funcNode.parents.push(item);
                    }
                });
            }
            else {
                // Set the name
                funcNode.name = codeLevel[1][codeLevel[1].length - 1][1];
                // Build parents of called function (eg. $this from $this->func(), etc)
                var parents = this.BuildParents(codeLevel[1], funcNode.name);
                if (parents != null) {
                    funcNode.parents = parents;
                }
            }
            codeLevel[2].forEach(function (funcCallLevel) {
                var paramNode = new ParameterNode();
                if (funcCallLevel.length == 2) {
                    paramNode.name = funcCallLevel[1];
                }
                else {
                    // Set the name
                    paramNode.name = funcCallLevel[funcCallLevel.length - 1][1];
                    // Build parents of provided parameters (eg. $this from $this->myProp, etc)
                    var parents = _this.BuildParents(funcCallLevel, paramNode.name);
                    if (parents != null) {
                        paramNode.parents = parents;
                    }
                }
                funcNode.params.push(paramNode);
            });
            functionCalls.push(funcNode);
        }
        return functionCalls;
    };
    // Recurse through the provided array building up an array of parents
    TreeBuilder.prototype.BuildParents = function (sourceArray, existingName) {
        var _this = this;
        var toReturn = [];
        if (Array.isArray(sourceArray)) {
            sourceArray.forEach(function (element) {
                if (Array.isArray(element)) {
                    if (element.length > 2) {
                        var results = _this.BuildParents(element, existingName);
                        results.forEach(function (subElement) {
                            toReturn.push(subElement);
                        });
                    }
                    else {
                        if (typeof element[1] == "string") {
                            if (element[1] != existingName) {
                                toReturn.push(element[1]);
                            }
                        }
                    }
                }
            });
        }
        return toReturn;
    };
    return TreeBuilder;
}());
exports.TreeBuilder = TreeBuilder;
// Entity Schema
// TODO - if/else blocks
//      - switch blocks
//      - handle autoloaded files
var BaseNode = (function () {
    function BaseNode() {
    }
    return BaseNode;
}());
var FileNode = (function () {
    function FileNode() {
        this.constants = [];
        this.topLevelVariables = [];
        this.functions = [];
        this.namespaceUsings = [];
        this.classes = [];
        this.interfaces = [];
        this.traits = [];
        // Any files that we're referencing with include(), require(), include_once() or require_once()
        this.fileReferences = [];
        this.symbolCache = [];
        this.lineCache = [];
    }
    return FileNode;
}());
exports.FileNode = FileNode;
var FileSymbolCache = (function () {
    function FileSymbolCache() {
    }
    return FileSymbolCache;
}());
exports.FileSymbolCache = FileSymbolCache;
var LineCache = (function () {
    function LineCache() {
    }
    return LineCache;
}());
exports.LineCache = LineCache;
(function (SymbolType) {
    SymbolType[SymbolType["Unknown"] = 0] = "Unknown";
    SymbolType[SymbolType["Class"] = 1] = "Class";
    SymbolType[SymbolType["Interface"] = 2] = "Interface";
    SymbolType[SymbolType["Trait"] = 3] = "Trait";
    SymbolType[SymbolType["Property"] = 4] = "Property";
    SymbolType[SymbolType["Method"] = 5] = "Method";
    SymbolType[SymbolType["Constant"] = 6] = "Constant";
    SymbolType[SymbolType["TopLevelVariable"] = 7] = "TopLevelVariable";
    SymbolType[SymbolType["TopLevelFunction"] = 8] = "TopLevelFunction";
})(exports.SymbolType || (exports.SymbolType = {}));
var SymbolType = exports.SymbolType;
var NamespaceUsingNode = (function (_super) {
    __extends(NamespaceUsingNode, _super);
    function NamespaceUsingNode() {
        _super.apply(this, arguments);
        // The parent parts in the correct order (eg. use [Parent1]\[Parent1]\Namespace)
        this.parents = [];
    }
    return NamespaceUsingNode;
}(BaseNode));
exports.NamespaceUsingNode = NamespaceUsingNode;
var ClassNode = (function (_super) {
    __extends(ClassNode, _super);
    function ClassNode() {
        _super.apply(this, arguments);
        this.implements = [];
        this.isAbstract = false;
        this.isFinal = false;
        this.isStatic = false;
        this.properties = [];
        this.methods = [];
        this.constants = [];
        this.traits = [];
        this.namespaceParts = [];
    }
    return ClassNode;
}(BaseNode));
exports.ClassNode = ClassNode;
var TraitNode = (function (_super) {
    __extends(TraitNode, _super);
    function TraitNode() {
        _super.apply(this, arguments);
    }
    return TraitNode;
}(ClassNode));
exports.TraitNode = TraitNode;
var InterfaceNode = (function (_super) {
    __extends(InterfaceNode, _super);
    function InterfaceNode() {
        _super.apply(this, arguments);
        this.extends = [];
        this.constants = [];
        this.methods = [];
        this.namespace = [];
    }
    return InterfaceNode;
}(BaseNode));
exports.InterfaceNode = InterfaceNode;
var MethodNode = (function (_super) {
    __extends(MethodNode, _super);
    function MethodNode() {
        _super.apply(this, arguments);
        this.params = [];
        this.returns = "unknown";
        this.accessModifier = AccessModifierNode.public;
        this.isStatic = false;
        this.isAbstract = false;
        this.globalVariables = [];
        this.scopeVariables = [];
        this.functionCalls = [];
    }
    return MethodNode;
}(BaseNode));
exports.MethodNode = MethodNode;
var ConstructorNode = (function (_super) {
    __extends(ConstructorNode, _super);
    function ConstructorNode() {
        _super.apply(this, arguments);
        this.isDeprecated = false;
    }
    return ConstructorNode;
}(MethodNode));
exports.ConstructorNode = ConstructorNode;
var FunctionCallNode = (function (_super) {
    __extends(FunctionCallNode, _super);
    function FunctionCallNode() {
        _super.apply(this, arguments);
        this.params = [];
        this.parents = [];
    }
    return FunctionCallNode;
}(BaseNode));
exports.FunctionCallNode = FunctionCallNode;
var VariableNode = (function (_super) {
    __extends(VariableNode, _super);
    function VariableNode() {
        _super.apply(this, arguments);
        this.type = "unknown";
        this.variableType = "variable"; // "variable" or "property"
    }
    return VariableNode;
}(BaseNode));
exports.VariableNode = VariableNode;
var ParameterNode = (function (_super) {
    __extends(ParameterNode, _super);
    function ParameterNode() {
        _super.apply(this, arguments);
        this.optional = false;
        this.parents = [];
    }
    return ParameterNode;
}(VariableNode));
exports.ParameterNode = ParameterNode;
var PropertyNode = (function (_super) {
    __extends(PropertyNode, _super);
    function PropertyNode() {
        _super.apply(this, arguments);
        this.type = "unknown";
        this.isStatic = false;
    }
    return PropertyNode;
}(BaseNode));
exports.PropertyNode = PropertyNode;
var ConstantNode = (function (_super) {
    __extends(ConstantNode, _super);
    function ConstantNode() {
        _super.apply(this, arguments);
        // Constants are always public
        // Constants (should) only be basic types
        this.type = "unknown";
    }
    return ConstantNode;
}(BaseNode));
exports.ConstantNode = ConstantNode;
(function (AccessModifierNode) {
    AccessModifierNode[AccessModifierNode["public"] = 0] = "public";
    AccessModifierNode[AccessModifierNode["private"] = 1] = "private";
    AccessModifierNode[AccessModifierNode["protected"] = 2] = "protected";
})(exports.AccessModifierNode || (exports.AccessModifierNode = {}));
var AccessModifierNode = exports.AccessModifierNode;
var PositionInfo = (function () {
    function PositionInfo(line, col, offset) {
        if (line === void 0) { line = 0; }
        if (col === void 0) { col = 0; }
        if (offset === void 0) { offset = 0; }
        this.line = line;
        this.col = col;
        this.offset = offset;
    }
    return PositionInfo;
}());
exports.PositionInfo = PositionInfo;
var SymbolLookupCache = (function () {
    function SymbolLookupCache() {
    }
    return SymbolLookupCache;
}());
exports.SymbolLookupCache = SymbolLookupCache;
var SymbolCache = (function () {
    function SymbolCache() {
    }
    return SymbolCache;
}());
exports.SymbolCache = SymbolCache;
//# sourceMappingURL=treeBuilder.js.map
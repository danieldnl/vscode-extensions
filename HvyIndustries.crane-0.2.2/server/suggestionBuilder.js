/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Hvy Industries. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *  "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 *--------------------------------------------------------------------------------------------*/
'use strict';
var vscode_languageserver_1 = require('vscode-languageserver');
var treeBuilder_1 = require("./hvy/treeBuilder");
var fs = require('fs');
var SuggestionBuilder = (function () {
    function SuggestionBuilder() {
    }
    SuggestionBuilder.prototype.prepare = function (textDocumentPosition, document, workspaceTree) {
        var _this = this;
        this.workspaceTree = workspaceTree;
        this.filePath = this.buildDocumentPath(textDocumentPosition.uri);
        this.lineIndex = textDocumentPosition.position.line;
        this.charIndex = textDocumentPosition.position.character;
        this.doc = document;
        var text = document.getText();
        var lines = text.split(/\r\n|\r|\n/gm);
        // Replace tabs with spaces
        this.currentLine = lines[this.lineIndex].replace(/\t/gm, " ");
        this.lastChar = this.currentLine[this.charIndex - 1];
        // Note - this.lastChar will always be the last character of the line
        // because whitespace is stripped from the text so the index is wrong
        this.currentFileNode = this.workspaceTree.filter(function (item) {
            return item.path == _this.filePath;
        })[0];
    };
    SuggestionBuilder.prototype.isSelf = function () {
        if (this.currentLine.substr(this.charIndex - 6, this.charIndex - 1) == "self::") {
            return true;
        }
        if (this.currentLine.substr(this.charIndex - 8, this.charIndex - 1) == "static::") {
            return true;
        }
        return false;
    };
    SuggestionBuilder.prototype.build = function () {
        var _this = this;
        var scope = this.getScope();
        var toReturn = [];
        var options = new ScopeOptions();
        if (this.lastChar == ">") {
            toReturn = toReturn.concat(this.checkAccessorAndAddMembers(scope));
        }
        else if (this.lastChar == ":") {
            if (this.isSelf()) {
                // Accessing via self::
                this.currentFileNode.classes.forEach(function (classNode) {
                    if (_this.withinBlock(classNode)) {
                        // Add static members for this class
                        toReturn = toReturn.concat(_this.addClassMembers(classNode, true, true, true));
                    }
                });
            }
            else {
                // Probably accessing via [ClassName]::
                var classNames = this.currentLine.trim().match(/\S(\B[a-z]+?)(?=::)/ig);
                if (classNames && classNames.length > 0) {
                    var className = classNames[classNames.length - 1];
                    var classNode = this.getClassNodeFromTree(className);
                    if (classNode != null) {
                        // Add static members for this class
                        toReturn = toReturn.concat(this.addClassMembers(classNode, true, false, false));
                    }
                }
            }
        }
        else {
            switch (scope.level) {
                case ScopeLevel.Root:
                    if (scope.name == null) {
                        // Top level
                        // Suggestions:
                        //  / other top level variables/constants
                        //  / top level functions
                        //  / classes/interfaces/traits
                        //  - namespaces (after 'use')
                        options.topConstants = true;
                        options.topVariables = true;
                        options.topFunctions = true;
                        options.classes = true;
                        options.interfaces = true;
                        options.traits = true;
                        options.namespaces = true;
                        toReturn = this.buildSuggestionsForScope(scope, options);
                    }
                    else {
                        // Top level function
                        // Suggestions:
                        //  / other top level functions
                        //  / local scope variables
                        //  / parameters
                        //  / variables included with 'global'
                        //  / classes
                        options.topFunctions = true;
                        options.localVariables = true;
                        options.parameters = true;
                        options.globalVariables = true;
                        options.classes = true;
                        toReturn = this.buildSuggestionsForScope(scope, options);
                    }
                    break;
                case ScopeLevel.Trait:
                case ScopeLevel.Class:
                    if (scope.name == null) {
                        // Within class, not in method or constructor
                        // Suggestions
                        //  / classes (after '=' or 'extends')
                        //  / interfaces (after 'implements')
                        //  / traits (after 'use')
                        options.classes = true;
                        options.interfaces = true;
                        options.traits = true;
                        toReturn = this.buildSuggestionsForScope(scope, options);
                    }
                    else {
                        if (scope.name == "constructor") {
                            // Within constructor
                            // Suggestions
                            //  / classes
                            //  / local variables
                            //  / parameters
                            options.classes = true;
                            options.localVariables = true;
                            options.parameters = true;
                            toReturn = this.buildSuggestionsForScope(scope, options);
                        }
                        else {
                            // Within method
                            // Suggestions
                            //  / classes
                            //  / local variables
                            //  / parameters
                            options.classes = true;
                            options.localVariables = true;
                            options.parameters = true;
                            toReturn = this.buildSuggestionsForScope(scope, options);
                        }
                    }
                    break;
                case ScopeLevel.Interface:
                default:
                    break;
            }
        }
        // Remove duplicated (overwritten) items
        var filtered = [];
        toReturn.forEach(function (item) {
            var found = false;
            filtered.forEach(function (subItem) {
                if (subItem.label == item.label) {
                    found = true;
                }
            });
            if (!found) {
                filtered.push(item);
            }
        });
        return filtered;
    };
    SuggestionBuilder.prototype.buildSuggestionsForScope = function (scope, options) {
        var _this = this;
        var toReturn = [];
        // Interpret the options object to determine what to include in suggestions
        // Interpret the scope object to determine what suggestions to include for -> and :: accessors, etc
        // TODO -- Check we're on a line below where they're defined
        // TODO -- Include these if the file is included in the current file
        if (options.topConstants) {
            this.currentFileNode.constants.forEach(function (item) {
                var value = item.value;
                if (item.type == "string") {
                    value = "\"" + value + "\"";
                }
                toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Value, detail: "(constant) : " + item.type + " : " + value });
            });
        }
        if (options.topVariables) {
            this.currentFileNode.topLevelVariables.forEach(function (item) {
                toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Variable, detail: "(variable) : " + item.type });
            });
        }
        if (options.topFunctions) {
            this.currentFileNode.functions.forEach(function (item) {
                toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Function, detail: "(function) : " + item.returns, insertText: item.name + "()" });
            });
        }
        if (options.localVariables || options.parameters || options.globalVariables) {
            // Find out what top level function we're in
            var funcs = [];
            funcs = funcs.concat(this.currentFileNode.functions.filter(function (func) {
                return _this.withinBlock(func);
            }));
            // Find out which method call/constructor we're in
            this.currentFileNode.classes.forEach(function (classNode) {
                funcs = funcs.concat(classNode.methods.filter(function (item) {
                    return _this.withinBlock(item);
                }));
                if (classNode.construct != null && _this.withinBlock(classNode.construct)) {
                    funcs.push(classNode.construct);
                }
            });
            // Find out which trait we're in
            this.currentFileNode.traits.forEach(function (traitNode) {
                funcs = funcs.concat(traitNode.methods.filter(function (item) {
                    return _this.withinBlock(item);
                }));
            });
            if (funcs.length > 0) {
                if (options.localVariables) {
                    funcs[0].scopeVariables.forEach(function (item) {
                        toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Variable, detail: "(variable) : " + item.type });
                    });
                }
                if (options.parameters) {
                    funcs[0].params.forEach(function (item) {
                        toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Property, detail: "(parameter) : " + item.type });
                    });
                }
                if (options.globalVariables) {
                    funcs[0].globalVariables.forEach(function (item) {
                        // TODO -- look up original variable to find the type
                        toReturn.push({ label: item, kind: vscode_languageserver_1.CompletionItemKind.Variable, detail: "(imported global) : mixed" });
                    });
                }
            }
        }
        this.workspaceTree.forEach(function (fileNode) {
            if (options.classes) {
                fileNode.classes.forEach(function (item) {
                    toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Class, detail: "(class)" });
                });
            }
            if (options.interfaces) {
                fileNode.interfaces.forEach(function (item) {
                    toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Interface, detail: "(interface)" });
                });
            }
            if (options.traits) {
                fileNode.traits.forEach(function (item) {
                    toReturn.push({ label: item.name, kind: vscode_languageserver_1.CompletionItemKind.Module, detail: "(trait)" });
                });
            }
        });
        return toReturn;
    };
    SuggestionBuilder.prototype.getScope = function () {
        var _this = this;
        var scope = null;
        // Are we inside a class?
        this.currentFileNode.classes.forEach(function (classNode) {
            if (_this.withinBlock(classNode)) {
                if (classNode.construct != null) {
                    if (_this.withinBlock(classNode.construct)) {
                        scope = new Scope(ScopeLevel.Class, "constructor", classNode.name);
                        return;
                    }
                }
                classNode.methods.forEach(function (method) {
                    if (_this.withinBlock(method)) {
                        scope = new Scope(ScopeLevel.Class, method.name, classNode.name);
                        return;
                    }
                });
                if (scope == null) {
                    scope = new Scope(ScopeLevel.Class, null, classNode.name);
                    return;
                }
            }
        });
        // Are we inside a trait?
        this.currentFileNode.traits.forEach(function (trait) {
            if (_this.withinBlock(trait)) {
                if (trait.construct != null) {
                    if (_this.withinBlock(trait.construct)) {
                        scope = new Scope(ScopeLevel.Trait, "constructor", trait.name);
                        return;
                    }
                }
                trait.methods.forEach(function (method) {
                    if (_this.withinBlock(method)) {
                        scope = new Scope(ScopeLevel.Trait, method.name, trait.name);
                        return;
                    }
                });
                if (scope == null) {
                    scope = new Scope(ScopeLevel.Trait, null, trait.name);
                    return;
                }
            }
        });
        // Are we inside an interface?
        this.currentFileNode.interfaces.forEach(function (item) {
            if (_this.withinBlock(item)) {
                scope = new Scope(ScopeLevel.Interface, null, item.name);
                return;
            }
        });
        // Are we inside a top level function?
        this.currentFileNode.functions.forEach(function (func) {
            if (_this.withinBlock(func)) {
                scope = new Scope(ScopeLevel.Root, func.name, null);
                return;
            }
        });
        if (scope == null) {
            // Must be at the top level of a file
            return new Scope(ScopeLevel.Root, null, null);
        }
        else {
            return scope;
        }
    };
    SuggestionBuilder.prototype.withinBlock = function (block) {
        if (block.startPos.line <= this.lineIndex && block.endPos.line >= this.lineIndex) {
            return true;
        }
        return false;
    };
    SuggestionBuilder.prototype.buildDocumentPath = function (uri) {
        var path = uri;
        path = path.replace("file:///", "");
        path = path.replace("%3A", ":");
        // Handle Windows and Unix paths
        switch (process.platform) {
            case 'darwin':
            case 'linux':
                path = "/" + path;
                break;
            case 'win32':
                path = path.replace(/\//g, "\\");
                break;
        }
        return path;
    };
    SuggestionBuilder.prototype.getClassNodeFromTree = function (className) {
        var toReturn = null;
        var fileNode = this.workspaceTree.forEach(function (fileNode) {
            fileNode.classes.forEach(function (classNode) {
                if (classNode.name.toLowerCase() == className.toLowerCase()) {
                    toReturn = classNode;
                }
            });
        });
        return toReturn;
    };
    SuggestionBuilder.prototype.getTraitNodeFromTree = function (traitName) {
        var toReturn = null;
        var fileNode = this.workspaceTree.forEach(function (fileNode) {
            fileNode.traits.forEach(function (traitNode) {
                if (traitNode.name.toLowerCase() == traitName.toLowerCase()) {
                    toReturn = traitNode;
                }
            });
        });
        return toReturn;
    };
    SuggestionBuilder.prototype.buildAccessModifierText = function (modifier) {
        switch (modifier) {
            case 0:
                return "public";
            case 1:
                return "private";
            case 2:
                return "protected";
        }
        return "";
    };
    SuggestionBuilder.prototype.checkAccessorAndAddMembers = function (scope) {
        var _this = this;
        var toReturn = [];
        var rawParts = this.currentLine.trim().match(/\$\S*(?=->)/gm);
        var parts = [];
        var rawLast = rawParts.length - 1;
        if (rawParts[rawLast].indexOf("->") > -1) {
            rawParts.forEach(function (part) {
                var splitParts = part.split("->");
                splitParts.forEach(function (splitPart) {
                    parts.push(splitPart);
                });
            });
        }
        else {
            parts = rawParts;
        }
        // TODO -- handle instantiated properties (+ static) (eg. $this->prop->suggestion)
        // TODO -- use the char offset to work out which part to use instead of always last
        var last = parts.length - 1;
        if (parts[last].indexOf("$this", parts[last].length - 5) > -1) {
            // We're referencing the current class; show everything
            this.currentFileNode.classes.forEach(function (classNode) {
                if (_this.withinBlock(classNode)) {
                    toReturn = _this.addClassMembers(classNode, false, true, true);
                }
            });
        }
        else {
            // We're probably calling from a instantiated variable
            // Check the variable is in scope to work out which suggestions to provide
            toReturn = this.checkForInstantiatedVariableAndAddSuggestions(parts[last], scope);
        }
        return toReturn;
    };
    SuggestionBuilder.prototype.checkForInstantiatedVariableAndAddSuggestions = function (variableName, scope) {
        var toReturn = [];
        var variablesFound = [];
        // Check the scope paramater to find out where we're calling from
        switch (scope.level) {
            case ScopeLevel.Root:
                if (scope.name == null) {
                    // Top level variable
                    variablesFound = this.currentFileNode.topLevelVariables.filter(function (item) {
                        return item.name == variableName;
                    });
                }
                else {
                    // Top level function
                    this.currentFileNode.functions.forEach(function (func) {
                        if (func.name == scope.name) {
                            variablesFound = variablesFound.concat(func.params.filter(function (item) {
                                return item.name == variableName;
                            }));
                            variablesFound = variablesFound.concat(func.scopeVariables.filter(function (item) {
                                return item.name == variableName;
                            }));
                        }
                    });
                }
                break;
            case ScopeLevel.Trait:
            case ScopeLevel.Class:
                if (scope.name == null) {
                }
                else {
                    if (scope.name == "constructor") {
                        // Within constructor
                        this.currentFileNode.classes.forEach(function (classNode) {
                            if (classNode.name == scope.parent) {
                                variablesFound = variablesFound.concat(classNode.construct.params.filter(function (item) {
                                    return item.name == variableName;
                                }));
                                variablesFound = variablesFound.concat(classNode.construct.scopeVariables.filter(function (item) {
                                    return item.name == variableName;
                                }));
                            }
                        });
                    }
                    else {
                        // Within method
                        this.currentFileNode.classes.forEach(function (classNode) {
                            if (classNode.name == scope.parent) {
                                classNode.methods.forEach(function (method) {
                                    if (method.name == scope.name) {
                                        variablesFound = variablesFound.concat(method.params.filter(function (item) {
                                            return item.name == variableName;
                                        }));
                                        variablesFound = variablesFound.concat(method.scopeVariables.filter(function (item) {
                                            return item.name == variableName;
                                        }));
                                    }
                                });
                            }
                        });
                    }
                }
                break;
            case ScopeLevel.Interface:
            default:
                break;
        }
        if (variablesFound.length > 0) {
            var className = null;
            if (variablesFound[0].type == "class") {
                className = variablesFound[0].value;
            }
            else {
                className = variablesFound[0].type;
            }
            var classNode = this.getClassNodeFromTree(className);
            if (classNode != null) {
                toReturn = this.addClassMembers(classNode, false, false, false);
            }
        }
        return toReturn;
    };
    SuggestionBuilder.prototype.addClassMembers = function (classNode, staticOnly, includePrivate, includeProtected) {
        var _this = this;
        var toReturn = [];
        classNode.constants.forEach(function (subNode) {
            var value = subNode.value;
            if (subNode.type == "string") {
                value = "\"" + value + "\"";
            }
            toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Value, detail: "(constant) : " + subNode.type + " : " + value });
        });
        classNode.methods.forEach(function (subNode) {
            if (subNode.isStatic == staticOnly) {
                var accessModifier = "(" + _this.buildAccessModifierText(subNode.accessModifier);
                var insertText = subNode.name + "()";
                accessModifier = accessModifier + (" method) : " + subNode.returns);
                if (includeProtected && subNode.accessModifier == treeBuilder_1.AccessModifierNode.protected) {
                    toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Function, detail: accessModifier, insertText: insertText });
                }
                if (includePrivate && subNode.accessModifier == treeBuilder_1.AccessModifierNode.private) {
                    toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Function, detail: accessModifier, insertText: insertText });
                }
                if (subNode.accessModifier == treeBuilder_1.AccessModifierNode.public) {
                    toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Function, detail: accessModifier, insertText: insertText });
                }
            }
        });
        classNode.properties.forEach(function (subNode) {
            if (subNode.isStatic == staticOnly) {
                var accessModifier = "(" + _this.buildAccessModifierText(subNode.accessModifier) + (" property) : " + subNode.type);
                var insertText = subNode.name;
                if (!staticOnly) {
                    // Strip the leading $
                    insertText = subNode.name.substr(1, subNode.name.length - 1);
                }
                if (includeProtected && subNode.accessModifier == treeBuilder_1.AccessModifierNode.protected) {
                    toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Property, detail: accessModifier, insertText: insertText });
                }
                if (includePrivate && subNode.accessModifier == treeBuilder_1.AccessModifierNode.private) {
                    toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Property, detail: accessModifier, insertText: insertText });
                }
                if (subNode.accessModifier == treeBuilder_1.AccessModifierNode.public) {
                    toReturn.push({ label: subNode.name, kind: vscode_languageserver_1.CompletionItemKind.Property, detail: accessModifier, insertText: insertText });
                }
            }
        });
        // Add items from included traits
        classNode.traits.forEach(function (traitName) {
            // Look up the trait node in the tree
            var traitNode = _this.getTraitNodeFromTree(traitName);
            if (traitNode != null) {
                toReturn = toReturn.concat(_this.addClassMembers(traitNode, staticOnly, true, true));
            }
        });
        // Add items from parent(s)
        if (classNode.extends != null && classNode.extends != "") {
            // Look up the class node in the tree
            var extendedClassNode = this.getClassNodeFromTree(classNode.extends);
            if (extendedClassNode != null) {
                toReturn = toReturn.concat(this.addClassMembers(extendedClassNode, staticOnly, false, true));
            }
        }
        // Remove duplicated (overwritten) items
        var filtered = [];
        toReturn.forEach(function (item) {
            var found = false;
            filtered.forEach(function (subItem) {
                if (subItem.label == item.label) {
                    found = true;
                }
            });
            if (!found) {
                filtered.push(item);
            }
        });
        return filtered;
    };
    return SuggestionBuilder;
}());
exports.SuggestionBuilder = SuggestionBuilder;
var Scope = (function () {
    function Scope(level, name, parent) {
        this.level = level;
        this.name = name;
        this.parent = parent;
    }
    return Scope;
}());
var ScopeOptions = (function () {
    function ScopeOptions() {
        this.topVariables = false;
        this.topConstants = false;
        this.topFunctions = false;
        this.classes = false;
        this.interfaces = false;
        this.traits = false;
        this.namespaces = false;
        this.localVariables = false;
        this.globalVariables = false;
        this.parameters = false;
    }
    return ScopeOptions;
}());
var ScopeLevel;
(function (ScopeLevel) {
    ScopeLevel[ScopeLevel["Root"] = 0] = "Root";
    ScopeLevel[ScopeLevel["Class"] = 1] = "Class";
    ScopeLevel[ScopeLevel["Interface"] = 2] = "Interface";
    ScopeLevel[ScopeLevel["Trait"] = 3] = "Trait";
})(ScopeLevel || (ScopeLevel = {}));
//# sourceMappingURL=suggestionBuilder.js.map
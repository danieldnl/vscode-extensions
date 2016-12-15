var vscode = require('vscode');
var beautify = require('js-beautify').html;

function format(document, range, options) {
    if (range === null) {
        var start = new vscode.Position(0, 0);
        var end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
        range = new vscode.Range(start, end);
    }
    var result = [];
    var content = document.getText(range);
    var formatted = Indentation(content);
    var newFormatted = beautify(formatted, { indent_size: 2 });

    var index = 0;
    var newFormatted1;
    var newFormatted2;

    newFormatted1 = replaceAll(newFormatted, '[" ', '["');

    newFormatted2 = replaceAll(newFormatted1, ' "]', '"]');

    if (newFormatted2) {
        result.push(new vscode.TextEdit(range, newFormatted2));
    }

    return result;
}

function replaceAll(str, find, replace) {
    var i = str.indexOf(find);
    if (i > -1) {
        str = str.replace(find, replace);
        i = i + replace.length;
        var st2 = str.substring(i);
        if (st2.indexOf(find) > -1) {
            str = str.substring(0, i) + replaceAll(st2, find, replace);
        }
    }
    return str;
}

function Indentation(oString) {
    var indentString = "    ";
    var code = oString;
    var newCode = "";
    var indentLevel = 0;
    var indentDuration = 0;
    var newLines = [];
    var caseMode = false;
    var inMultiLineComment = false;
    var lines = code.split(/[\r]?\n/gi);
    for (var i = 0; i < lines.length; i++) {
        var line = trim(lines[i]);
        var lineForMatching = line.replace(/\/\/.*/, "");
        if (inMultiLineComment) {
            if (line.match(/\*\//)) {
                lineForMatching = line.replace(/.*\*\//, "");
                inMultiLineComment = false;
            }
            else {
                lineForMatching = "";
            }
        }
        if (lineForMatching.match(/\/\*/)) {
            if (lineForMatching.match(/\*\//)) {
                lineForMatching = lineForMatching.replace(/\/\*.*\*\//, "");
            }
            else {
                inMultiLineComment = true;
                lineForMatching = lineForMatching.replace(/\/\*.*/, "");
            }
        }
        var lbrackets = lineForMatching.replace(/[^\{]+/gi, "");
        var rbrackets = lineForMatching.replace(/[^\}]+/gi, "");
        var lbracket1 = lineForMatching.indexOf("{");
        var rbracket1 = lineForMatching.indexOf("}");
        var lbracketN = lineForMatching.lastIndexOf("{");
        var rbracketN = lineForMatching.lastIndexOf("}");
        var increaseIndentBefore = false;
        var decreaseIndentBefore = false;
        var increaseIndentAfter = false;
        var decreaseIndentAfter = false;
        if (lbrackets.length > rbrackets.length ||
            lbracketN >= 0 && lbracketN > rbracketN) {
            increaseIndentAfter = true;
        }
        if (rbrackets.length > lbrackets.length ||
            rbracket1 >= 0 && rbracket1 < lbracket1) {
            decreaseIndentBefore = true;
        }
        if (indentDuration > 0) {
            indentDuration--;
            if (trim(lineForMatching).indexOf("{") >= 0) {
                decreaseIndentBefore = true;
            }
            else if (indentDuration == 0) {
                decreaseIndentAfter = true;
            }
        }
        if ((((lbrackets.length == 0 && rbrackets.length == 0)) && ((lineForMatching.match(/(if |while )[ \t]*([^)]*)/) && !lineForMatching.match(/;/)) || (lineForMatching.match(/(for )[ \t]*([^)]*)/)) || (lineForMatching.match(/else/) &&
            (!lineForMatching.match(/else[ ]+if/) && (lbrackets.length == 0 || lbrackets.length > rbrackets.length))))) || trim(lineForMatching).match(/}[ \t]*else$/)) {
            increaseIndentAfter = true;
            indentDuration = 1;
        }
        if ((lineForMatching.match(/case/) && lineForMatching.match(/:/)) || (lineForMatching.match(/default/) && lineForMatching.match(/:/))) {
            increaseIndentAfter = true;
            caseMode = true;
        }
        if (lineForMatching.match(/break;/)) {
            decreaseIndentAfter = true;
        }
        if (lineForMatching.match(/}/) && caseMode == true) {
            indentLevel--;
            caseMode = false;
        }
        if (increaseIndentBefore) {
            indentLevel++;
        }
        else if (decreaseIndentBefore) {
            indentLevel = Math.max(0, indentLevel - 1);
        }
        for (var tabs = 0; tabs < indentLevel; tabs++) {
            line = indentString + line;
        }
        newLines.push(line);
        if (increaseIndentAfter) {
            indentLevel++;
        }
        else if (decreaseIndentAfter) {
            indentLevel = Math.max(0, indentLevel - 1);
        }
    }
    newCode = newLines.join("\n");
    return newCode;
}

exports.Indentation = Indentation;

function ltrim(str) {
    for (var k = 0; k < str.length && str.charAt(k) <= " "; k++)
        ;
    return str.substring(k, str.length);
}
function rtrim(str) {
    for (var j = str.length - 1; j >= 0 && str.charAt(j) <= " "; j--)
        ;
    return str.substring(0, j + 1);
}
function trim(str) {
    return ltrim(rtrim(str));
}

function activate(context) {
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('php', {
        provideDocumentFormattingEdits: function (document, options, token) {
            return format(document, null, options);
        }
    }));
    context.subscriptions.push(vscode.languages.registerDocumentRangeFormattingEditProvider('php', {
        provideDocumentRangeFormattingEdits: function (document, range, options, token) {
            var start = new vscode.Position(0, 0);
            var end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
            return format(document, new vscode.Range(start, end), options);
        }
    }));
}

exports.activate = activate;
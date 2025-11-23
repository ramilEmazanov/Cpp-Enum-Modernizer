const vscode = require('vscode');

// kPascalCase: red, RED_VALUE, someValue -> kRed, kRedValue, kSomeValue
function toKStyle(name) {
    if (!name) return name;
    // уже начинается на 'k' — не трогаем (максимально неинтеллектуально)
    if (/^\s*k/.test(name)) return name;

    // разбиваем camelCase и разделители
    name = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    name = name.replace(/[_\-\.\s]+/g, ' ');
    const parts = name.trim().split(' ').filter(Boolean);

    const pascal = parts.map(p => {
        const low = p.toLowerCase();
        return low.charAt(0).toUpperCase() + low.slice(1);
    }).join('');
    return 'k' + pascal;
}

function transformEnumBody(body, enumName) {
    const rawItems = body.split(',');
    const outItems = [];

    for (let item of rawItems) {
        const orig = item;
        item = item.trim();
        if (!item) continue;

        // <name> [= ...] [коммент/хвост]
        const m = item.match(/^([A-Za-z_]\w*)(\s*=\s*[^\/,]+)?(.*)$/);
        if (!m) { outItems.push(orig.trim()); continue; }

        const [, name, init = '', tail = ''] = m;

        // если уже начинается с 'k' — оставляем как есть
        const newName = /^\s*k/.test(name) ? name : toKStyle(name);

        outItems.push(`${newName}${init}${tail}`);
    }
    return `{\n    ${outItems.join(',\n    ')}\n}`;
}

function transformEnumBlock(fullMatch, enumKw, afterEnum, enumName, body) {
    const alreadyClass = /\bclass\b/.test(afterEnum);
    const newBody = transformEnumBody(body, enumName || 'Enum');
    if (alreadyClass) {
        return fullMatch.replace(/\{([\s\S]*?)\}/, newBody);
    } else {
        return fullMatch.replace(/\benum\b/, 'enum class').replace(/\{[\s\S]*?\}/, newBody);
    }
}

function processText(text) {
    // enum [class|struct]? <Name>? { ... }
    const enumRegex = /\b(enum)\b(\s+(?:class|struct))?\s+(\w+)?\s*\{([\s\S]*?)\}/g;
    return text.replace(enumRegex, (match, enumKw, afterEnum = '', enumName = '', body = '') =>
        transformEnumBlock(match, enumKw, afterEnum || '', enumName || '', body)
    );
}

function activate(context) {
    const cmd = vscode.commands.registerCommand('extension.enumsToEnumClassKStyle', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const sel = editor.selection;
        const hasSelection = !sel.isEmpty;
        const source = hasSelection
            ? editor.document.getText(sel)
            : editor.document.getText();

        const transformed = processText(source);
        if (transformed === source) return;

        editor.edit(edit => {
            if (hasSelection) {
                edit.replace(sel, transformed);
            } else {
                const fullRange = new vscode.Range(
                    editor.document.positionAt(0),
                    editor.document.positionAt(source.length)
                );
                edit.replace(fullRange, transformed);
            }
        });
    });

    context.subscriptions.push(cmd);
}

function deactivate() {}

module.exports = { activate, deactivate };

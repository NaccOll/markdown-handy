const vscode = require('vscode')
const cp = require('copy-paste')
const kt = require('katex')
const utils = require('katex')
const path = require('path')
const convert = require('./convert')

const previewCss = convert.totalCss;
class MarkdownProvider {
    constructor(engine, context) {
        this.engine = engine;
        this.context = context;
        this.emitter = new vscode.EventEmitter();
        this.basePath = context.asAbsolutePath('.');
    }
    provideTextDocumentContent(uri, token) {
        if (!token || !token.isCancellationRequested) {
            if (!this.activeDocument) {
                return;
            }
            this._activeDocument = this.activeDocument
            const res = [
                '<!DOCTYPE html>',
                '<html>',
                '<head>',
                '<meta http-equiv="Content-type" content="text/html;charset=UTF-8">',
                previewCss,
                `<base href="${this.activeDocument.uri.toString(true)}">`,
                '</head>',
                '<body class="markdown-body">',
                `${this.document}`,
                '</body>',
                '</html>'
            ].join('\n');
            
            return res;
        }
    }
    // viewUri: vscode.Uri.parse('markdown-handy://extension/markdown-handy')
    get activeDocument() {
        let doc = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document || this._activeDocument || false;
        if (!doc) vscode.window.showInformationMessage('Cannot locate current text document!');
        return doc;
    }
    get fname() {
        return this.activeDocument.uri.fsPath;
    }
    get document() {
        let text = this.activeDocument.getText();
        if (this.hideFrontMatter) {
            text = text.replace(/^\s*?[{-]{3}([\s\S]+?)[}-]{3}\s*?/, '');
        }
        for (let rule of this.rules) { // apply rules ...
            text = text.replace(rule.rex, rule.tmpl);
        }
        return this.engine.render(this.activeDocument.uri, this.hideFrontMatter, text);
        // return this.engine.engine.render(text);

    }
    // implement 'hideFrontMatter' as a lazy getter for better performance.
    // ... (see https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Functions/get)
    get hideFrontMatter() {
        return vscode.workspace.getConfiguration('markdown')['previewFrontMatter'] === 'hide';
    }
    get onDidChange() {
        return this.emitter.event;
    }
    update(uri) {
        if (!this._waiting) {
            this._waiting = true;
            setTimeout(() => {
                this._waiting = false;
                this.emitter.fire(uri);
            }, 300);
        }
    }
    math(tex, disp) {
        let res;
        try {
            // don't forget to escape '_','*', and '\' .. after math rendering
            res = kt.renderToString(tex, {
                throwOnError: false,
                displayMode: disp
            }).replace(/([_\*\\])/g, "\\$1");
        } catch (err) {
            res = err;
        }
        return res;
    }
    get rules() {
        return [{
            rex: /\\\$/g,
            tmpl: "\xB6"
        }, // substitute '\$' by '¶' temporarily ...
        {
            rex: /(\r?\n|^|>)\s*?\${2}([^$]*?)\${2}\s*?\(([^)$\r\n]*?)\)(?=$|\r?\n|\s)/g,
            tmpl: ($0, $1, $2, $3) => `${$1}<section class="eqno"><eqn>${this.math($2, true)}</eqn><span>(${$3})</span></section>\n`
        }, // display equation $$...$$ equation number
        {
            rex: /(\r?\n|^|>)\s*?\${2}([^$]*?)\${2}(?=$|\r?\n|\s)/g,
            tmpl: ($0, $1, $2) => `${$1}<section><eqn>${this.math($2, true)}</eqn></section>\n`
        }, // display equation $$...$$
        {
            rex: /(\D|\$|^)\$(\S[^$\r\n]*?\S)\$(?!\d)/g,
            tmpl: ($0, $1, $2) => `${$1}<eq>${this.math($2, false)}</eq>`
        }, // multi-character inline equation $...$
        {
            rex: /(\D|^)\$([^$\r\n\t ]{1})\$(?!\d)/g,
            tmpl: ($0, $1, $2) => `${$1}<eq>${this.math($2, false)}</eq>`
        }, // single-character inline equation $...$
        {
            rex: /\xB6/g,
            tmpl: "$"
        } // reverse temporary substitution ...
        ]
    }

    clipHtmlCmd() {
        let html = `<!doctype html><html><head><meta charset='utf-8'>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/2.4.1/github-markdown.min.css">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.9.0/styles/default.min.css">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.6.0/katex.min.css">
            <link rel="stylesheet" href="https://gitcdn.xyz/repo/goessner/mdmath/master/css/mdmath.css">
            </head><body class="markdown-body">
            ${this.document}
            </body></html>`;
        cp.copy(html, () => vscode.window.showInformationMessage('Html copied to clipboard!'));
    }
    
}

MarkdownProvider.rules = MarkdownProvider.prototype.rules
MarkdownProvider.hideFrontMatter = MarkdownProvider.prototype.hideFrontMatter
exports.MarkdownProvider = MarkdownProvider
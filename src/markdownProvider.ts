'use strict'

import * as vscode from 'vscode'
import { TextDocument } from 'vscode'
import * as kt from 'katex'
import * as path from 'path'
import { MarkdownEngine } from './markdownEngine'
import * as convert from './convert'
import * as utils from './utils'
import { rootPath } from './utils'
import * as url from 'url'


export class MarkdownProvider implements vscode.TextDocumentContentProvider{
    public engine: MarkdownEngine
    public context: vscode.ExtensionContext
    private emitter = new vscode.EventEmitter<vscode.Uri>();
    private _waiting: boolean
    private basePath: string
    private _styles: string
    private _scripts: string

    constructor(engine: MarkdownEngine, context: vscode.ExtensionContext) {
        this.engine = engine
        this.context = context
        this.emitter = new vscode.EventEmitter()
        this.basePath = context.asAbsolutePath('.')
    }
    get MDFileName() {
        if (vscode.window.activeTextEditor) {
            return vscode.window.activeTextEditor.document.uri.path
        }
    }
    getStyles() {
        function makeCss(filename) {
            let css = utils.readFile(filename)
            return css ? '\n<style>\n' + css + '\n</style>\n' : ''
        }
        let style = ''
        if (!this._styles) {
            let styles = ''
            let filename = ''
            let i

            // read the style of the vscode.
            style += makeCss(path.join(rootPath, 'styles', 'markdown.css'))

            // read the style of the markdown.styles setting.
            styles = vscode.workspace.getConfiguration('markdown-handy')['styles']
            if (styles && Array.isArray(styles) && styles.length > 0) {
                for (i = 0; i < styles.length; i++) {
                    let href = filename = styles[i]
                    let protocol = url.parse(href).protocol
                    if (protocol === 'http:' || protocol === 'https:') {
                        style += '<link rel=\"stylesheet\" href=\""' + href + '"\" type=\"text/css\">'
                    } else if (protocol === 'file:') {
                        style += makeCss(filename)
                    }
                }
            }

            // read the style of the highlight.js.
            let highlightStyle = vscode.workspace.getConfiguration('markdown-handy')['highlightStyle'] || ''
            let ishighlight = vscode.workspace.getConfiguration('markdown-handy')['highlight']
            if (ishighlight) {
                if (highlightStyle) {
                    let css = vscode.workspace.getConfiguration('markdown-handy')['highlightStyle'] || 'github.css'
                    filename = path.join(rootPath, 'node_modules', 'highlight.js', 'styles', css)
                } else {
                    filename = path.join(rootPath, 'styles', 'tomorrow.css')
                }
                style += makeCss(filename)
            }

            // read the style of the markdown-pdf.styles settings.
            styles = vscode.workspace.getConfiguration('markdown-handy')['styles'] || ''
            if (styles && Array.isArray(styles) && styles.length > 0) {
                for (i = 0; i < styles.length; i++) {
                    filename = styles[i]
                    if (!path.isAbsolute(filename)) {
                        if (vscode.workspace.rootPath == undefined) {
                            filename = path.join(path.dirname(this.MDFileName), filename)
                        } else {
                            filename = path.join(vscode.workspace.rootPath, filename)
                        }
                    }
                    style += makeCss(filename)
                }
            }

            // 6. read the style of katex and mdmath.
            let isMath = vscode.workspace.getConfiguration('markdown-handy')['math']
            if (isMath) {
                style += makeCss(path.join(rootPath, 'styles', 'katex.min.css'))
            }
        } else {
            style = this._styles
        }
        return style
    }

    getScripts(): string {
        function makeScript(filename: string): string {
            let script = utils.readFile(filename)
            return script ? '\n<script>\n' + script + '\n</script>\n' : ''
        }
        let script = ''
        if (!this._scripts) {
            script += makeScript(path.join(rootPath,'scripts','flowchart.min.js'))
        } else {
            script = this._scripts
        }
        return script
    }

    math(tex, disp) {
        let res;
        try {
            // don't forget to escape '_','*', and '\' .. after math rendering
            res = kt.renderToString(tex, {
                displayMode: disp
            }).replace(/([_\*\\])/g, "\\$1")
        } catch (err) {
            res = err
        }
        return res
    }
    get rules(): Array<any> {
        return [
            {
                rex: /\\\$/g,
                tmpl: "\xB6"
            }, // substitute '\$' by '¶' temporarily ...
            {
                rex: /(\r?\n|^|>)\s*?\${2}([^$]*?)\${2}\s*?\(([^)$\r\n]*?)\)(?=$|\r?\n|\s)/g,
                tmpl: ($0, $1, $2, $3): string => `${$1}<section class="eqno"><eqn>${this.math($2, true)}</eqn><span>(${$3})</span></section>\n`
            }, // display equation $$...$$ equation number
            {
                rex: /(\r?\n|^|>)\s*?\${2}([^$]*?)\${2}(?=$|\r?\n|\s)/g,
                tmpl: ($0, $1, $2): string => `${$1}<section><eqn>${this.math($2, true)}</eqn></section>\n`
            }, // display equation $$...$$
            {
                rex: /(\D|\$|^)\$(\S[^$\r\n]*?\S)\$(?!\d)/g,
                tmpl: ($0, $1, $2): string => `${$1}<eq>${this.math($2, false)}</eq>`
            }, // multi-character inline equation $...$
            {
                rex: /(\D|^)\$([^$\r\n\t ]{1})\$(?!\d)/g,
                tmpl: ($0, $1, $2): string => `${$1}<eq>${this.math($2, false)}</eq>`
            }, // single-character inline equation $...$
            {
                rex: /\xB6/g,
                tmpl: "$"
            } // reverse temporary substitution ...
        ]
    }
    get activeDocument(): TextDocument {
        let doc = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document
        if (!doc) vscode.window.showInformationMessage('Cannot locate current text document!')
        return doc
    }
    get hideFrontMatter(): boolean {
        return vscode.workspace.getConfiguration('markdown')['previewFrontMatter'] === 'hide'
    }
    get documentBody(): string {
        let text = this.activeDocument.getText()
        if (this.hideFrontMatter) {
            text = text.replace(/^\s*?[{-]{3}([\s\S]+?)[}-]{3}\s*?/, '')
        }
        for (let rule of this.rules) { // apply rules ...
            text = text.replace(rule.rex, rule.tmpl)
        }
        return this.engine.render(this.activeDocument.uri, this.hideFrontMatter, text)
    }
    get documentFile(): string {
        // read template
        let filename = path.join(rootPath, 'template', 'template.html')
        let template = utils.readFile(filename)

        // compile template
        const mustache = require('mustache')
        let view
        try {
            view = {
                style: this.getStyles(),
                content: this.documentBody
            }
        } catch (e) {
            vscode.window.showErrorMessage('ERROR: mustache:view')
            vscode.window.showErrorMessage(e.message)
        }
        return mustache.render(template.toString(), view)
    }
    provideTextDocumentContent(uri: vscode.Uri) {
        if (!this.activeDocument) {
            return ''
        }
        const res = [
            '<!DOCTYPE html>',
            '<html>',
            '<head>',
            '<meta http-equiv="Content-type" content="text/html;charset=UTF-8">',
            this.getStyles(),
            // this.getScripts(),
            `<base href="${this.activeDocument.uri.toString(true)}">`,
            '</head>',
            '<body class="markdown-body">',
            `${this.documentBody}`,
            '</body>',
            '</html>'
        ].join('\n')

        return res
    }

    get onDidChange(): vscode.Event<vscode.Uri> {
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
}
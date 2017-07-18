'use strict'

import * as vscode from 'vscode'
import { TextDocument } from 'vscode'
import * as kt from 'katex'
import * as path from 'path'
import { MarkdownEngine } from './markdownEngine'
import * as convert from './convert'
let previewCss = convert.readStyles()

export class MarkdownProvider {
    public engine: MarkdownEngine
    public context: vscode.ExtensionContext
    private emitter: vscode.EventEmitter<1> // ??
    private _waiting: boolean
    private basePath: string

    constructor(engine: MarkdownEngine, context: vscode.ExtensionContext) {
        this.engine = engine
        this.context = context
        this.emitter = new vscode.EventEmitter()
        this.basePath = context.asAbsolutePath('.')
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
    get document(): string {
        let text = this.activeDocument.getText()
        if (this.hideFrontMatter) {
            text = text.replace(/^\s*?[{-]{3}([\s\S]+?)[}-]{3}\s*?/, '')
        }
        for (let rule of this.rules) { // apply rules ...
            text = text.replace(rule.rex, rule.tmpl)
        }
        return this.engine.render(this.activeDocument.uri, this.hideFrontMatter, text)
    }
    provideTextDocumentContent(uri: vscode.Uri) {
        if (!this.activeDocument) {
            return
        }
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
        ].join('\n')

        return res
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
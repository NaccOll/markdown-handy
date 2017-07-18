'use strict'

import * as utils from './utils'
import * as convert from './convert'
import { MarkdownEngine } from './markdownEngine'
import { MarkdownProvider } from './markdownProvider'
import * as path from 'path'
import * as cp from 'copy-paste'

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    utils.init();
    let engine = new MarkdownEngine();
    let provider = new MarkdownProvider(engine, context);
    let reg1 = vscode.workspace.registerTextDocumentContentProvider('markdown-handy', provider);
    let reg2 = vscode.commands.registerCommand('markdown-handy.showPreview', showPreviewCmd);
    let reg3 = vscode.commands.registerCommand('markdown-handy.exportToOther', exportHtmlCmd(provider));
    let reg4 = vscode.commands.registerCommand('markdown-handy.clipToHtml', clipHtmlCmd(provider));

    vscode.workspace.onDidSaveTextDocument(document => {
        if (isTargetMarkdownFile(document)) {
            const uri = utils.getMarkdownUri(document.uri);
            provider.update(uri);
        }
    });
    vscode.workspace.onDidChangeTextDocument(event => {
        if (isTargetMarkdownFile(event.document)) {
            const uri = utils.getMarkdownUri(event.document.uri);
            provider.update(uri);
        }
    });

    context.subscriptions.push(reg1, reg2, reg3, reg4);
    context.subscriptions.push(reg1, reg2, reg3, reg4);
    console.log("'markdown-handy' activated !")

}

// this method is called when your extension is deactivated
export function deactivate() {
}
function isTargetMarkdownFile(document) {
    return document.languageId === 'markdown';
}

function showPreviewCmd(uri) {
    let resource = uri;
    // if(!isTargetMarkdownFile(vscode.window.activeTextEditor.document)){
    //   return;
    // }
    if (!(resource instanceof vscode.Uri)) {
        if (vscode.window.activeTextEditor) {
            resource = vscode.window.activeTextEditor.document.uri;
        }
    }
    if (!(resource instanceof vscode.Uri)) {
        if (!vscode.window.activeTextEditor) {
            return vscode.commands.executeCommand('markdown-handy.showPreview');
        }
        return;
    }
    let thenable = vscode.commands.executeCommand('vscode.previewHtml', utils.getMarkdownUri(resource), vscode.ViewColumn.Two, `Preview '${path.basename(resource.fsPath)}'`);
    return thenable;
}

function exportHtmlCmd(provider: MarkdownProvider) {
    return function() {
        if (vscode.window.activeTextEditor) {
            convert.MarkdownConvert(provider)
        }
    }
}

function clipHtmlCmd(provider: MarkdownProvider) {
    return function() {
        if (vscode.window.activeTextEditor) {
            let html = `
            <!doctype html>
            <html>
                <head>
                    <meta charset='utf-8'>
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/2.4.1/github-markdown.min.css">
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.9.0/styles/default.min.css">
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.6.0/katex.min.css">
                    <link rel="stylesheet" href="https://gitcdn.xyz/repo/goessner/mdmath/master/css/mdmath.css">
                </head>
                <body class="markdown-body">
                    ${provider.document}
                </body>
            </html>`;
            cp.copy(html, () => vscode.window.showInformationMessage('Html copied to clipboard!'));
        }
    }
}
'use strict';
const vscode = require('vscode')
const utils = require('./utils')
const path = require('path')
const convert = require('./convert')
const MarkdownProvider_1 = require('./MarkdownProvider')
const MarkdownEngine_1 = require('./MarkdownEngine')
function activate(context) {
  utils.init();
  let engine = new MarkdownEngine_1.MarkdownEngine();
  let provider = new MarkdownProvider_1.MarkdownProvider(engine, context);
  let reg1 = vscode.workspace.registerTextDocumentContentProvider('markdown-handy', provider);
  let reg2 = vscode.commands.registerCommand('markdown-handy.showPreview', showPreviewCmd);
  let reg3 = vscode.commands.registerCommand('markdown-handy.exportToOther', exportHtmlCmd(provider));
  let reg4 = vscode.commands.registerCommand('markdown-handy.clipToHtml', provider.clipHtmlCmd);

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
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;

function isTargetMarkdownFile(document) {
  return document.languageId === 'markdown';
}

process.exit = function () {
  console.info('process.exit');
};


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

function exportHtmlCmd(provider) {
  return function () {
    if (vscode.window.activeTextEditor) {
      convert.MarkdownConvert(provider)
    }
  }
}
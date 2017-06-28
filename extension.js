'use strict';
const vscode = require('vscode')
const engine = require('./engine')
const md = engine.md
const utils = require('./utils')
const provider_1 = require('./provider')

function activate(context) {
  utils.init();

  let provider = provider_1.MarkdownProvider.create(context)
  let reg1 = vscode.workspace.registerTextDocumentContentProvider('markdown-handy', provider)
  let reg2 = vscode.commands.registerCommand('markdown-handy.showPreview', provider_1.MarkdownProvider.showPreviewCmd)
  let reg3 = vscode.commands.registerCommand('markdown-handy.exportToOther', provider_1.MarkdownProvider.exportHtmlCmd)
  let reg4 = vscode.commands.registerCommand('markdown-handy.clipToHtml', provider_1.MarkdownProvider.clipHtmlCmd)
  let cfg = (key) => vscode.workspace.getConfiguration('markdown-handy')[key]


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

  // context.subscriptions.push(reg1, reg2, reg3);
  context.subscriptions.push(reg1, reg2, reg3, reg4);

  // load additional extensions upon configuration ...
  if (cfg('footnotes')) {
    md.use(require('markdown-it-footnote'));
    console.log("'markdown-it-footnote' enabled.");
  }
  if (cfg('toc')['enabled']) {
    md.use(require('markdown-it-anchor'), {
      level: cfg('toc')['permalinkLevel'],
      permalink: cfg('toc')['permalink'],
      permalinkBefore: true,
      permalinkSymbol: cfg('toc')['permalinkSymbol']
    });
    md.use(require('markdown-it-table-of-contents'), {
      includeLevel: cfg('toc')['includeLevel']
    });
    console.log("'markdown-it-table-of-contents' enabled.");
  }

  console.log("'markdown-handy' activated !")
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}
exports.deactivate = deactivate;

function isTargetMarkdownFile(document) {
  return document.languageId === 'markdown';
}




// for './node_modules/phantomjs-prebuilt/install.js'
// 'An extension called process.exit() and this was prevented.'
process.exit = function () {
  console.info('process.exit');
};

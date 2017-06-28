const vscode = require('vscode')
const path = require('path')
const cp = require('copy-paste')
const kt = require('katex')
const engine = require('./engine')
const md = engine.md
const convert = require('./convert')
const utils = require('./utils')
let previewCss = convert.readStyles();
const MarkdownProvider = {
  create: function () {
    var o = Object.create(this.prototype);
    o.constructor.apply(o, arguments);
    return o;
  },
  rules: [{
      rex: /\\\$/g,
      tmpl: "\xB6"
    }, // substitute '\$' by '¶' temporarily ...
    {
      rex: /(\r?\n|^|>)\s*?\${2}([^$]*?)\${2}\s*?\(([^)$\r\n]*?)\)(?=$|\r?\n|\s)/g,
      tmpl: ($0, $1, $2, $3) => `${$1}<section class="eqno"><eqn>${MarkdownProvider.math($2,true)}</eqn><span>(${$3})</span></section>\n`
    }, // display equation $$...$$ equation number
    {
      rex: /(\r?\n|^|>)\s*?\${2}([^$]*?)\${2}(?=$|\r?\n|\s)/g,
      tmpl: ($0, $1, $2) => `${$1}<section><eqn>${MarkdownProvider.math($2,true)}</eqn></section>\n`
    }, // display equation $$...$$
    {
      rex: /(\D|\$|^)\$(\S[^$\r\n]*?\S)\$(?!\d)/g,
      tmpl: ($0, $1, $2) => `${$1}<eq>${MarkdownProvider.math($2,false)}</eq>`
    }, // multi-character inline equation $...$
    {
      rex: /(\D|^)\$([^$\r\n\t ]{1})\$(?!\d)/g,
      tmpl: ($0, $1, $2) => `${$1}<eq>${MarkdownProvider.math($2,false)}</eq>`
    }, // single-character inline equation $...$
    {
      rex: /\xB6/g,
      tmpl: "$"
    } // reverse temporary substitution ...
  ],
  math: function (tex, disp) {
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
  },
  viewUri: vscode.Uri.parse('markdown-handy://extension/markdown-handy'),
  get activeDocument() {
    let doc = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document || MarkdownProvider._activeDocument || false;
    if (!doc) vscode.window.showInformationMessage('Cannot locate current text document!');
    return doc;
  },
  get fname() {
    return MarkdownProvider.activeDocument.uri.fsPath;
  },
  get document() {
    let text = MarkdownProvider.activeDocument.getText();
    if (MarkdownProvider.hideFrontMatter) {
      text = text.replace(/^\s*?[{-]{3}([\s\S]+?)[}-]{3}\s*?/, '');
    }
    for (let rule of MarkdownProvider.rules) { // apply rules ...
      text = text.replace(rule.rex, rule.tmpl);
    }
    return md.render(text);
  },
  // implement 'hideFrontMatter' as a lazy getter for better performance.
  // ... (see https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Functions/get)
  get hideFrontMatter() {
    delete this.hideFrontMatter;
    return this.hideFrontMatter = vscode.workspace.getConfiguration('markdown')['previewFrontMatter'] === 'hide';
  },

  // see https://github.com/Microsoft/vscode/blob/master/extensions/markdown/src/extension.ts@getViewColumn
  targetPreviewColumn(sideBySide) {
    const vuecol = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : false;

    return !vuecol ? vscode.ViewColumn.One :
      !sideBySide ? vuecol :
      vuecol === vscode.ViewColumn.One ? vscode.ViewColumn.Two :
      vuecol === vscode.ViewColumn.Two ? vscode.ViewColumn.Three :
      vuecol;
  },
  // proto ...
  prototype: {
    constructor: function (context) {
      this.context = context;
      this.emitter = new vscode.EventEmitter();
      this.basePath = context.asAbsolutePath('.');
    },
    get onDidChange() {
      return this.emitter.event;
    },
    update: function (uri) {
      if (!this._waiting) {
        this._waiting = true;
        setTimeout(() => {
          this._waiting = false;
          this.emitter.fire(uri);
        }, 300);
      }
    },
    provideTextDocumentContent: function (uri, token) {
      if (!token || !token.isCancellationRequested) {
        MarkdownProvider._activeDocument = MarkdownProvider.activeDocument
        if (!MarkdownProvider.activeDocument) {
          return;
        }
        const res = [
          '<!DOCTYPE html>',
          '<html>',
          '<head>',
          '<meta http-equiv="Content-type" content="text/html;charset=UTF-8">',
          previewCss,
          `<base href="${MarkdownProvider.activeDocument.uri.toString(true)}">`,
          '</head>',
          '<body class="markdown-body">',
          `${MarkdownProvider.document}`,
          '</body>',
          '</html>'
        ].join('\n');
        return res;
      }
    }
  },

  showPreviewCmd: function (uri) {
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
  },
  clipHtmlCmd: function () {
    let html = `<!doctype html><html><head><meta charset='utf-8'>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/2.4.1/github-markdown.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.9.0/styles/default.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.6.0/katex.min.css">
    <link rel="stylesheet" href="https://gitcdn.xyz/repo/goessner/mdmath/master/css/mdmath.css">
    </head><body class="markdown-body">
    ${MarkdownProvider.document}
    </body></html>`;
    cp.copy(html, () => vscode.window.showInformationMessage('Html copied to clipboard!'));
  },
  exportHtmlCmd: function () { // 
    if (vscode.window.activeTextEditor) {
      convert.MarkdownConvert()
    }
  }
};

exports.MarkdownProvider=MarkdownProvider
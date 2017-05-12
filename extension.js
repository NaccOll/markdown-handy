'use strict';

const vscode = require('vscode')
const path = require('path')
const fs = require('fs')
const url = require('url')
const hljs = require('highlight.js')
const cp = require('copy-paste')
const kt = require('katex')
const md = require('markdown-it')({
  html: true,
  breaks: vscode.workspace.getConfiguration('markdown-handy')['breaks'],
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        str = hljs.highlight(lang, str, true).value;
      } catch (e) {
        str = md.utils.escapeHtml(str);

        vscode.window.showErrorMessage('ERROR: markdown-it:highlight');
        vscode.window.showErrorMessage(e.message);
        vscode.window.setStatusBarMessage('');
      }
    } else {
      str = md.utils.escapeHtml(str);
    }
    return '<pre class="hljs"><code><div>' + str + '</div></code></pre>';
  }
});
// checkbox
md.use(require('markdown-it-checkbox'));
let f = vscode.workspace.getConfiguration('markdown-handy')['emoji'];
let options;
if (f) {
  const emojies_defs = require(path.join(__dirname, 'data', 'emoji.json'));
  try {
    options = {
      defs: emojies_defs
    };
  } catch (e) {
    vscode.window.showErrorMessage('ERROR: markdown-it-emoji:options');
    vscode.window.showErrorMessage(e.message);
    vscode.window.setStatusBarMessage('');
  }
  md.use(require('markdown-it-emoji'), options);
  md.renderer.rules.emoji = function (token, idx) {
    let emoji = token[idx].markup;
    let emojipath = path.join(
      __dirname, 'node_modules', 'emoji-images', 'pngs', emoji + '.png');
    let emojidata = utils.readFile(emojipath, null).toString('base64');
    if (emojidata) {
      return '<img class="emoji" alt="' + emoji +
        '" src="data:image/png;base64,' + emojidata + '" />';
    } else {
      return ':' + emoji + ':';
    }
  };
}

const utils = require('./utils')
let mdfilename = '';


function activate(context) {
  utils.init();
  // let disposable_command = vscode.commands.registerCommand(
  //   'extension.markdown-handy.convert',
  //   function () {
  //     MarkdownConvert();
  //   });
  // context.subscriptions.push(disposable_command);

  let provider = MarkdownProvider.create(context)
  let reg1 = vscode.workspace.registerTextDocumentContentProvider('markdown-handy', provider)
  let reg2 = vscode.commands.registerCommand('markdown-handy.showPreview', MarkdownProvider.showPreviewCmd)
  let reg3 = vscode.commands.registerCommand('markdown-handy.exportToOther', MarkdownProvider.exportHtmlCmd)
  let reg4 = vscode.commands.registerCommand('markdown-handy.clipToHtml', MarkdownProvider.clipHtmlCmd)
  let cfg = (key) => vscode.workspace.getConfiguration('markdown-handy')[key]


  vscode.workspace.onDidChangeTextDocument(event => {
    if (event.document.languageId === 'markdown' &&
      event.document.uri.scheme !== 'markdown' // prevent processing of own documents
      &&
      event.document.isDirty) {
      const uri = vscode.Uri.parse('markdown-handy://extension/markdown-handy');
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

function MarkdownConvert() {
  // check active window
  let editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active Editor!');
    return;
  }

  // check markdown mode
  let mode = editor.document.languageId;
  if (mode != 'markdown') {
    vscode.window.showWarningMessage('It is not a markdown mode!');
    return;
  }

  mdfilename = editor.document.fileName;
  let ext = path.extname(mdfilename);
  if (!utils.isExistsFile(mdfilename)) {
    if (editor.document.isUntitled) {
      vscode.window.showWarningMessage('Please save the file!');
      return;
    }
    vscode.window.showWarningMessage('File name does not get!');
    return;
  }

  let items = [];
  items.push({
    label: 'pdf',
    description: 'Render as pdf document'
  });
  items.push({
    label: 'html',
    description: 'Render as html document'
  });

  vscode.window.showQuickPick(items).then(function (qpSelection) {
    // check the select
    if (!qpSelection) {
      return;
    }

    // assign the type of convert
    let type = qpSelection.label;

    // convert markdown to html
    let content = convertMarkdownToHtml(mdfilename, type);

    // make html
    let html = makeHtml(content);

    // let types = ['html', 'pdf'];
    let filename = mdfilename.replace(ext, '.' + type);
    filename = utils.getOutputDir(filename);
    // export html
    if (type == 'html') {
      exportHtml(html, filename);
      // export pdf/png/jpeg
    } else if (type == 'pdf') {
      exportPdf(html, filename, type);

      let debug =
        vscode.workspace.getConfiguration('markdown-handy')['debug'] || false;
      if (debug) {
        let f = path.parse(mdfilename);
        filename = path.join(f.dir, f.name + '_debug.html');
        filename = utils.getOutputDir(filename);
        exportHtml(html, filename);
      }
    }
  });
}

/*
 * convert markdown to html (markdown-it)
 */
function convertMarkdownToHtml(filename, type) {
  // convert the img src of the markdown
  let defaultRender = md.renderer.rules.image;
  md.renderer.rules.image = function (tokens, idx, options, env, self) {
    let token = tokens[idx];
    let href = token.attrs[token.attrIndex('src')][1];
    if (type === 'html') {
      href = decodeURIComponent(href).replace(/("|')/g, '');
    } else {
      href = convertImgPath(href, filename);
    }
    token.attrs[token.attrIndex('src')][1] = href;
    // pass token to default renderer.
    return defaultRender(tokens, idx, options, env, self);
  };

  if (type !== 'html') {
    // convert the img src of the html
    md.renderer.rules.html_block = function (tokens, idx) {
      let html = tokens[idx].content;
      const cheerio = require('cheerio');
      let $ = cheerio.load(html);
      $('img').each(function () {
        let src = $(this).attr('src');
        let href = convertImgPath(src, filename);
        $(this).attr('src', href);
      });
      return $.html();
    };
  }

  let text = fs.readFileSync(filename, 'utf-8');
  let isMath = vscode.workspace.getConfiguration('markdown-handy')['math'];
  if (isMath) {
    if (MarkdownProvider.hideFrontMatter) {
      text = text.replace(/^\s*?[{-]{3}([\s\S]+?)[}-]{3}\s*?/, '');
    }
    for (let rule of MarkdownProvider.rules) { // apply rules ...
      text = text.replace(rule.rex, rule.tmpl);
    }
  }


  return md.render(text);
}

function convertImgPath(src, filename) {
  let href = decodeURIComponent(src);
  href = href.replace(/("|')/g, '').replace(/\\/g, '/').replace(/#/g, '%23');
  let protocol = url.parse(href).protocol;
  if (protocol === 'file:' && href.indexOf('file:///') !== 0) {
    return href.replace(/^file:\/\//, 'file:///');
  } else if (protocol === 'file:') {
    return href;
  } else if (!protocol || path.isAbsolute(href)) {
    href = path.resolve(path.dirname(filename), href)
      .replace(/\\/g, '/')
      .replace(/#/g, '%23');
    if (href.indexOf('//') === 0) {
      return 'file:' + href;
    } else if (href.indexOf('/') === 0) {
      return 'file://' + href;
    } else {
      return 'file:///' + href;
    }
  } else {
    return src;
  }
}

/*
 * export a html to a html file
 */
function exportHtml(data, filename) {
  vscode.window.setStatusBarMessage('$(markdown) Converting...');
  let StatusbarMessageTimeout = vscode.workspace.getConfiguration(
    'markdown-handy')['StatusbarMessageTimeout'];
  fs.writeFile(filename, data, 'utf-8', function (err) {
    if (err) {
      vscode.window.showErrorMessage('ERROR: exportHtml()');
      vscode.window.showErrorMessage(err.message);
      vscode.window.setStatusBarMessage('');
      return;
    }
    vscode.window.setStatusBarMessage('');
    vscode.window.setStatusBarMessage(
      '$(markdown) OUTPUT : ' + filename, StatusbarMessageTimeout);
  });
}


function makeHtml(data) {
  // read styles
  let style = '';
  style += readStyles();

  // read template
  let filename = path.join(__dirname, 'template', 'template.html');
  let template = utils.readFile(filename);

  // compile template
  const mustache = require('mustache');
  let view;
  try {
    view = {
      style: style,
      content: data
    };
  } catch (e) {
    vscode.window.showErrorMessage('ERROR: mustache:view');
    vscode.window.showErrorMessage(e.message);
  }
  return mustache.render(template, view);
}

function readStyles() {
  let style = '';
  let styles = '';
  let filename = '';
  let i;

  // 1. read the style of the vscode.
  style += makeCss(path.join(__dirname, 'styles', 'markdown.css'));

  // 2. read the style of the markdown.styles setting.
  styles = vscode.workspace.getConfiguration('markdown-handy')['styles'];
  if (styles && Array.isArray(styles) && styles.length > 0) {
    for (i = 0; i < styles.length; i++) {
      let href = filename = styles[i];
      let protocol = url.parse(href).protocol;
      if (protocol === 'http:' || protocol === 'https:') {
        style += '<link rel=\"stylesheet\" href=\""' + href + '"\" type=\"text/css\">';
      } else if (protocol === 'file:') {
        style += makeCss(filename);
      }
    }
  }

  // 3. read the style of the highlight.js.
  let highlightStyle = vscode.workspace.getConfiguration('markdown-handy')['highlightStyle'] || '';
  let ishighlight = vscode.workspace.getConfiguration('markdown-handy')['highlight'];
  if (ishighlight) {
    if (highlightStyle) {
      let css = vscode.workspace.getConfiguration('markdown-handy')['highlightStyle'] || 'github.css';
      filename = path.join(__dirname, 'node_modules', 'highlight.js', 'styles', css);
    } else {
      filename = path.join(__dirname, 'styles', 'tomorrow.css');
    }
    style += makeCss(filename);
  }

  // 4. read the style of the markdown-pdf.
  style += makeCss(path.join(__dirname, 'styles', 'markdown-pdf.css'));

  // 5. read the style of the markdown-pdf.styles settings.
  styles = vscode.workspace.getConfiguration('markdown-handy')['styles'] || '';
  if (styles && Array.isArray(styles) && styles.length > 0) {
    for (i = 0; i < styles.length; i++) {
      filename = styles[i];
      if (!path.isAbsolute(filename)) {
        if (vscode.workspace.rootPath == undefined) {
          filename = path.join(path.dirname(mdfilename), filename);
        } else {
          filename = path.join(vscode.workspace.rootPath, filename);
        }
      }
      style += makeCss(filename);
    }
  }

  // 6. read the style of katex and mdmath.
  let isMath = vscode.workspace.getConfiguration('markdown-handy')['math'];
  if (isMath) {
    style += makeCss(path.join(__dirname, 'styles', 'katex.min.css'));
  }
  return style;
}

function makeCss(filename) {
  let css = utils.readFile(filename);
  return css ? '\n<style>\n' + css + '\n</style>\n' : '';
}


/*
 * export a html to a pdf file (html-pdf)
 */
function exportPdf(data, filename, type) {
  vscode.window.setStatusBarMessage('$(markdown) Converting...');
  let StatusbarMessageTimeout = vscode.workspace.getConfiguration(
    'markdown-handy')['StatusbarMessageTimeout'];
  let phantomPath = utils.getPhantomjsPath();
  if (!utils.checkPhantomjs()) {
    utils.installPhantomjsBinary();
  }
  if (!utils.checkPhantomjs()) {
    vscode.window.showErrorMessage(
      'ERROR: phantomjs binary does not exist: ' + phantomPath);
    vscode.window.setStatusBarMessage('');
    return;
  }

  const htmlpdf = require('html-pdf');
  let options;
  try {
    options = {
      'format': vscode.workspace.getConfiguration('markdown-handy')['format'] || 'A4',
      'orientation': vscode.workspace.getConfiguration('markdown-handy')['orientation'] ||
        'portrait',
      'border': {
        'top': vscode.workspace.getConfiguration(
            'markdown-handy')['border']['top'] ||
          '',
        'right': vscode.workspace.getConfiguration(
            'markdown-handy')['border']['right'] ||
          '',
        'bottom': vscode.workspace.getConfiguration(
            'markdown-handy')['border']['bottom'] ||
          '',
        'left': vscode.workspace.getConfiguration(
            'markdown-handy')['border']['left'] ||
          ''
      },
      'type': type,
      'header': {
        'height': vscode.workspace.getConfiguration(
            'markdown-handy')['header']['height'] ||
          '',
        'contents': vscode.workspace.getConfiguration(
            'markdown-handy')['header']['contents'] ||
          ''
      },
      'footer': {
        'height': vscode.workspace.getConfiguration(
            'markdown-handy')['footer']['height'] ||
          '',
        'contents': vscode.workspace.getConfiguration(
          'markdown-handy')['footer']['contents'] || ''
      },
      'phantomPath': phantomPath
    };
  } catch (e) {
    vscode.window.showErrorMessage('ERROR: html-pdf:options');
    vscode.window.showErrorMessage(e.message);
    vscode.window.setStatusBarMessage('');
  }
  try {
    htmlpdf.create(data, options).toBuffer(function (err, buffer) {
      fs.writeFile(filename, buffer, function (err) {
        if (err) {
          vscode.window.showErrorMessage('ERROR: exportPdf()');
          vscode.window.showErrorMessage(err.message);
          vscode.window.setStatusBarMessage('');
          return;
        }
        vscode.window.setStatusBarMessage('');
        vscode.window.setStatusBarMessage(
          '$(markdown) OUTPUT : ' + filename, StatusbarMessageTimeout);
      });
    });
  } catch (e) {
    vscode.window.showErrorMessage('ERROR: htmlpdf.create()');
    vscode.window.showErrorMessage(e.message);
    vscode.window.setStatusBarMessage('');
  }
}

// for './node_modules/phantomjs-prebuilt/install.js'
// 'An extension called process.exit() and this was prevented.'
process.exit = function () {
  console.info('process.exit');
};


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
        }, 600);
      }
    },
    provideTextDocumentContent: function (uri, token) {
      if (!token || !token.isCancellationRequested) {
        // save current document for accessing it from preview window later ...
        MarkdownProvider._activeDocument = vscode.window.activeTextEditor.document;
        return `<!doctype html><html><head><meta charset='utf-8'>
        <link rel="stylesheet" href="file://${this.basePath}/styles/markdown.css">
        <link rel="stylesheet" href="file://${this.basePath}/styles/tomorrow.css">
        <link rel="stylesheet" href="file://${this.basePath}/styles/katex.min.css">
        <link rel="stylesheet" href="file://${this.basePath}/styles/mdmath.css">
        <base href="${MarkdownProvider.activeDocument.uri.toString(true)}">
        </head>
        <body>
        ${MarkdownProvider.document}
        </body></html>`;
      }
    }
  },

  showPreviewCmd: function () {
    vscode.commands.executeCommand('vscode.previewHtml',
        MarkdownProvider.viewUri,
        vscode.ViewColumn.Two,
        "Preview: " + path.basename(MarkdownProvider.fname))
      .then(success => {}, error => {
        console.error(error)
      });
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
      MarkdownConvert()
    }
  }
};

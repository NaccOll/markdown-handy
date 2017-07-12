'use strict';
const vscode = require('vscode')
const hljs = require('highlight.js')
const path = require('path')
const utils = require('./utils')
var tableOfContentsProvider_1 = require("./tableOfContentsProvider");
var mdnh = require('markdown-it-named-headers');
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
}).use(mdnh, {
  slugify: function (header) { return tableOfContentsProvider_1.TableOfContentsProvider.slugify(header); }
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
let defaultRender = md.renderer.rules.image
md.renderer.rules.image = function (tokens, idx, options, env, self) {
  let token = tokens[idx];
  let href = token.attrs[token.attrIndex('src')][1];
  let data = utils.readFile(href, null).toString('base64');
  token.attrs[token.attrIndex('src')][1] = 'data:image/png;base64,' + data;
  let res = defaultRender(tokens, idx, options, env, self);
  return res;
};
const normalizeLink = md.normalizeLink;
md.normalizeLink = function (link) {
  try {
    var uri = vscode.Uri.parse(link);
    if (!uri.scheme && uri.path && !uri.fragment) {
      // Assume it must be a file
      if (uri.path[0] === '/') {
        uri = vscode.Uri.file(path.join(vscode.workspace.rootPath || '', uri.path));
      } else {
        let document = vscode.window.activeTextEditor.document;
        uri = vscode.Uri.file(path.join(path.dirname(document.uri.fsPath), uri.path));
      }
      let res = normalizeLink(uri.toString(true))
      return res;
    }
  } catch (e) {
    // noop
  }
  return normalizeLink(link);
};
const validateLink = md.validateLink;
md.validateLink = function (link) {
  // support file:// links
  let res = validateLink(link) || link.indexOf('file:') === 0;
  return res;
};

exports.md = md

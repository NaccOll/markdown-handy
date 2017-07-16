const vscode = require('vscode')
const path = require('path')
const utils = require('./utils')
const tableOfContentsProvider_1 = require('./tableOfContentsProvider')

const FrontMatterRegex = /^---\s*[^]*?(-{3}|\.{3})\s*/;
class MarkdownEngine {
    constructor() {
        this.plugins = [];
    }
    addPlugin(factory) {
        if (this.md) {
            this.usePlugin(factory);
        } else {
            this.plugins.push(factory);
        }
    }
    usePlugin(factory) {
        try {
            this.md = factory(this.md);
        } catch (e) { }
    }
    stripFrontmatter(text) {
        let offset = 0;
        let frontMatterMatch = FrontMatterRegex.exec(text);
        if (frontMatterMatch) {
            let frontMatter = frontMatterMatch[0];
            offset = frontMatter.split(/\r\n|\n|\r/g).length - 1;
            text = text.substr(frontMatter.length);
        }
        return { text: text, offset: offset };
    }
    render(document, stripFrontmatter, text) {
        let offset = 0;
        if (stripFrontmatter) {
            let markdownContent = this.stripFrontmatter(text);
            offset = markdownContent.offset;
            text = markdownContent.text;
        }
        this.currentDocument = document;
        this.firstLine = offset;
        return this.engine.render(text);
    }
    parse(document, source) {
        let _a = this.stripFrontmatter(source), text = _a.text, offset = _a.offset;
        this.currentDocument = document;
        return this.engine.parse(text, {}).map(function (token) {
            if (token.map) {
                token.map[0] += offset;
            }
            return token;
        });
    }
    addLineNumberRenderer(md, ruleName) {
        let _this = this;
        let original = md.renderer.rules[ruleName];
        md.renderer.rules[ruleName] = function (tokens, idx, options, env, self) {
            let token = tokens[idx];
            if (token.map && token.map.length) {
                token.attrSet('data-line', _this.firstLine + token.map[0]);
                token.attrJoin('class', 'code-line');
            }
            if (original) {
                return original(tokens, idx, options, env, self);
            }
            else {
                return self.renderToken(tokens, idx, options, env, self);
            }
        };
    }
    addLinkNormalizer(md) {
        let _this = this;
        let normalizeLink = md.normalizeLink;
        md.normalizeLink = function (link) {
            try {
                let uri = vscode.Uri.parse(link);
                if (!uri.scheme && uri.path && !uri.fragment) {
                    // Assume it must be a file
                    if (uri.path[0] === '/') {
                        uri = vscode.Uri.file(path.join(vscode.workspace.rootPath || '', uri.path));
                    }
                    else {
                        uri = vscode.Uri.file(path.join(path.dirname(_this.currentDocument.path), uri.path));
                    }
                    return normalizeLink(uri.toString(true));
                }
            }
            catch (e) {
                // noop
            }
            return normalizeLink(link);
        };
    }
    addLinkValidator(md) {
        let validateLink = md.validateLink;
        md.validateLink = function (link) {
            // support file:// links
            return validateLink(link) || link.indexOf('file:') === 0;
        };
    }

    get engine() {
        let self = this;
        if (!this.md) {
            const hljs_1  = require('highlight.js');
            let cfg = (key) => vscode.workspace.getConfiguration('markdown-handy')[key]

            this.md = require('markdown-it')({
                html: true,
                highlight: function (str, lang) {
                    if (lang && hljs_1.getLanguage(lang)) {
                        try {
                            return "<pre class=\"hljs\"><code><div>" + hljs_1.highlight(lang, str, true).value + "</div></code></pre>";
                        }
                        catch (error) { }
                    }
                    return "<pre class=\"hljs\"><code><div>" + self.engine.utils.escapeHtml(str) + "</div></code></pre>";
                }
            });
            if (cfg('checkbox.enable')) {
                this.md.use(require('markdown-it-checkbox'))
                console.log("'markdown-it-checkbox' enabled.");
            }
            if (cfg('named-headers')) {
                this.md.use(require('markdown-it-named-headers'), {
                    slugify: function (header) { return tableOfContentsProvider_1.TableOfContentsProvider.slugify(header); }
                })
                console.log("'markdown-it-named-headers' enabled.");
            }
            if (cfg('footnotes')) {
                this.md.use(require('markdown-it-footnote'));
                console.log("'markdown-it-footnote' enabled.");
            }
            if (cfg('toc')['enabled']) {
                this.md.use(require('markdown-it-anchor'), {
                    level: cfg('toc')['permalinkLevel'],
                    permalink: cfg('toc')['permalink'],
                    permalinkBefore: true,
                    permalinkSymbol: cfg('toc')['permalinkSymbol']
                });
                this.md.use(require('markdown-it-table-of-contents'), {
                    includeLevel: cfg('toc')['includeLevel']
                });
                console.log("'markdown-it-table-of-contents' enabled.");
            }
            if (vscode.workspace.getConfiguration('markdown-handy')['emoji']) {
                const emojies_defs = require(path.join(__dirname, 'data', 'emoji.json'));
                this.md.use(require('markdown-it-emoji'), {
                    defs: emojies_defs
                });
                this.md.renderer.rules.emoji = function (token, idx) {
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
            for (let _i = 0, _a = this.plugins; _i < _a.length; _i++) {
                let plugin = _a[_i];
                this.usePlugin(plugin);
            }
            this.plugins = [];
            for (let _b = 0, _c = ['paragraph_open', 'heading_open', 'image', 'code_block', 'blockquote_open', 'list_item_open']; _b < _c.length; _b++) {
                let renderName = _c[_b];
                this.addLineNumberRenderer(this.md, renderName);
            }
            this.addLinkNormalizer(this.md);
            this.addLinkValidator(this.md);
            let defaultRender = this.md.renderer.rules.image
            this.md.renderer.rules.image = function (tokens, idx, options, env, self) {
                let token = tokens[idx];
                let href = token.attrs[token.attrIndex('src')][1];
                var hrefUri = vscode.Uri.parse(href);
                if (['http', 'https'].indexOf(hrefUri.scheme) === -1) {
                    let data = utils.readFile(href, null).toString('base64');
                    token.attrs[token.attrIndex('src')][1] = 'data:image/png;base64,' + data;
                }
                let res = defaultRender(tokens, idx, options, env, self);
                return res;
            };
        }
        this.md.set({ breaks: vscode.workspace.getConfiguration('markdown').get('preview.breaks', false) });
        return this.md;
    }
}

exports.MarkdownEngine = MarkdownEngine
'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import * as url from 'url'
import * as utils from './utils'
import * as fs from 'fs'
import { MarkdownProvider } from './markdownProvider'
let mdfilename = ''

class ConvertFormat {
    label: string
    desciption: string
}

export function MarkdownConvert(provider: MarkdownProvider) {
    // check active window
    let editor = vscode.window.activeTextEditor
    if (!editor) {
        vscode.window.showWarningMessage('No active Editor!')
        return
    }

    // check the mode of language
    let mode = editor.document.languageId
    if (mode != 'markdown') {
        vscode.window.showWarningMessage('It is not a markdown mode!')
        return
    }

    // check the status of document
    mdfilename = editor.document.fileName
    let ext = path.extname(mdfilename)
    if (!utils.isExistsFile(mdfilename)) {
        if (editor.document.isUntitled) {
            vscode.window.showWarningMessage('Please save the file!')
            return
        }
        vscode.window.showWarningMessage('File name does not get!')
        return
    }

    let items = []
    items.push({ label: 'pdf', description: 'Render as pdf document' })
    items.push({ label: 'html', description: 'Render as html document' })

    vscode.window.showQuickPick(items).then((qpSelection) => {
        // check the select
        if (!qpSelection) {
            return
        }
        // assign the type of convert
        let type = qpSelection.label

        // convert markdown to html
        let content = convertMarkdownToHtml(mdfilename, type, provider)

        // make html
        let html = makeHtml(content, type)

        let filename = mdfilename.replace(ext, '.' + type)
        filename = utils.getOutputDir(filename)
        // export html
        if (type == 'html') {
            exportHtml(html, filename)
            // export pdf/png/jpeg
        } else if (type == 'pdf') {
            exportPdf(html, filename, type)

            let debug =
                vscode.workspace.getConfiguration('markdown-handy')['debug'] || false
            if (debug) {
                let f = path.parse(mdfilename)
                filename = path.join(f.dir, f.name + '_debug.html')
                filename = utils.getOutputDir(filename)
                exportHtml(html, filename)
            }
        }

    })
}

/*
 * convert markdown to html (markdown-it)
 */
function convertMarkdownToHtml(filename: string, type: string, provider: MarkdownProvider) {
    // convert the img src of the markdown
    let md = provider.engine.engine
    let defaultRender = md.renderer.rules.image
    md.renderer.rules.image = function(tokens, idx, options, env, self) {
        let token = tokens[idx]
        let href = token.attrs[token.attrIndex('src')][1]
        if (type === 'html') {
            href = decodeURIComponent(href).replace(/("|')/g, '')
        } else {
            href = convertImgPath(href, filename)
        }
        token.attrs[token.attrIndex('src')][1] = href
        // pass token to default renderer.
        return defaultRender(tokens, idx, options, env, self)
    }

    if (type !== 'html') {
        // convert the img src of the html
        md.renderer.rules.html_block = function(tokens, idx) {
            let html = tokens[idx].content
            const cheerio = require('cheerio')
            let $ = cheerio.load(html)
            $('img').each(function() {
                let src = $(this).attr('src')
                let href = convertImgPath(src, filename)
                $(this).attr('src', href)
            })
            return $.html()
        }
    }
    return provider.document
    // let text = fs.readFileSync(filename, 'utf-8')
    // let isMath = vscode.workspace.getConfiguration('markdown-handy')['math']
    // if (isMath) {
    //     if (provider.hideFrontMatter) {
    //         text = text.replace(/^\s*?[{-]{3}([\s\S]+?)[}-]{3}\s*?/, '')
    //     }
    //     for (let rule of provider.rules) { // apply rules ...
    //         text = text.replace(rule.rex, rule.tmpl)
    //     }
    // }
    // return md.render(text)
}

function convertImgPath(src: string, filename: string): string {
    let href = decodeURIComponent(src)
    href = href.replace(/("|')/g, '').replace(/\\/g, '/').replace(/#/g, '%23')
    let protocol = url.parse(href).protocol
    if (protocol === 'file:' && href.indexOf('file:///') !== 0) {
        return href.replace(/^file:\/\//, 'file:///')
    } else if (protocol === 'file:') {
        return href
    } else if (!protocol || path.isAbsolute(href)) {
        href = path.resolve(path.dirname(filename), href)
            .replace(/\\/g, '/')
            .replace(/#/g, '%23')
        if (href.indexOf('//') === 0) {
            return 'file:' + href
        } else if (href.indexOf('/') === 0) {
            return 'file://' + href
        } else {
            return 'file:///' + href
        }
    } else {
        return src
    }
}

function makeHtml(data, type) {
    // read styles
    let style = ''
    style += readStyles(type)

    // read template
    let filename = path.join(__dirname, '../..', 'template', 'template.html')
    let template = utils.readFile(filename)

    // compile template
    const mustache = require('mustache')
    let view
    try {
        view = {
            style: style,
            content: data
        }
    } catch (e) {
        vscode.window.showErrorMessage('ERROR: mustache:view')
        vscode.window.showErrorMessage(e.message)
    }
    return mustache.render(template.toString(), view)
}

export function readStyles(type: string = 'html'): string {
    let style = ''
    let styles = ''
    let filename = ''
    let i

    // 1. read the style of the vscode.
    style += makeCss(path.join(__dirname, '../..', 'styles', 'markdown.css'))

    // 2. read the style of the markdown.styles setting.
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


    // 3. read the style of the highlight.js.
    let highlightStyle = vscode.workspace.getConfiguration('markdown-handy')['highlightStyle'] || ''
    let ishighlight = vscode.workspace.getConfiguration('markdown-handy')['highlight']
    if (ishighlight) {
        if (highlightStyle) {
            let css = vscode.workspace.getConfiguration('markdown-handy')['highlightStyle'] || 'github.css'
            filename = path.join(__dirname, '../..', 'node_modules', 'highlight.js', 'styles', css)
        } else {
            filename = path.join(__dirname, '../..', 'styles', 'tomorrow.css')
        }
        style += makeCss(filename)
    }

    // 4. read the style of the markdown-pdf.
    if (type === 'pdf') {
        style += makeCss(path.join(__dirname, '../..', 'styles', 'markdown-pdf.css'))
    }
    // 5. read the style of the markdown-pdf.styles settings.
    styles = vscode.workspace.getConfiguration('markdown-handy')['styles'] || ''
    if (styles && Array.isArray(styles) && styles.length > 0) {
        for (i = 0; i < styles.length; i++) {
            filename = styles[i]
            if (!path.isAbsolute(filename)) {
                if (vscode.workspace.rootPath == undefined) {
                    filename = path.join(path.dirname(mdfilename), filename)
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
        style += makeCss(path.join(__dirname, '../..', 'styles', 'katex.min.css'))
    }
    return style
}

function makeCss(filename) {
    let css = utils.readFile(filename)
    return css ? '\n<style>\n' + css + '\n</style>\n' : ''
}

function exportPdf(data, filename, type) {
    vscode.window.setStatusBarMessage('$(markdown) Converting...')
    let StatusbarMessageTimeout = vscode.workspace.getConfiguration(
        'markdown-handy')['StatusbarMessageTimeout']
    let phantomPath = utils.getPhantomjsPath()
    if (!utils.checkPhantomjs()) {
        utils.installPhantomjsBinary()
    }
    if (!utils.checkPhantomjs()) {
        vscode.window.showErrorMessage(
            'ERROR: phantomjs binary does not exist: ' + phantomPath)
        vscode.window.setStatusBarMessage('')
        return
    }

    const htmlpdf = require('html-pdf')
    let options
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
        }
    } catch (e) {
        vscode.window.showErrorMessage('ERROR: html-pdf:options')
        vscode.window.showErrorMessage(e.message)
        vscode.window.setStatusBarMessage('')
    }
    try {
        htmlpdf.create(data, options).toBuffer(function(err, buffer) {
            fs.writeFile(filename, buffer, function(err) {
                if (err) {
                    vscode.window.showErrorMessage('ERROR: exportPdf()')
                    vscode.window.showErrorMessage(err.message)
                    vscode.window.setStatusBarMessage('')
                    return
                }
                vscode.window.setStatusBarMessage('')
                vscode.window.setStatusBarMessage(
                    '$(markdown) OUTPUT : ' + filename, StatusbarMessageTimeout)
            });
        });
    } catch (e) {
        vscode.window.showErrorMessage('ERROR: htmlpdf.create()')
        vscode.window.showErrorMessage(e.message)
        vscode.window.setStatusBarMessage('')
    }
}

function exportHtml(data, filename) {
    vscode.window.setStatusBarMessage('$(markdown) Converting...')
    let StatusbarMessageTimeout = vscode.workspace.getConfiguration(
        'markdown-handy')['StatusbarMessageTimeout']
    fs.writeFile(filename, data, {
        encoding: 'utf-8'
    }, function(err) {
        if (err) {
            vscode.window.showErrorMessage('ERROR: exportHtml()')
            vscode.window.showErrorMessage(err.message)
            vscode.window.setStatusBarMessage('')
            return
        }
        vscode.window.setStatusBarMessage('')
        vscode.window.setStatusBarMessage(
            '$(markdown) OUTPUT : ' + filename, StatusbarMessageTimeout)
    })
}
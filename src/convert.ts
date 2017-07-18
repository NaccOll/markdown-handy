'use strict'

import * as vscode from 'vscode'
import * as path from 'path'
import * as url from 'url'
import * as utils from './utils'
import * as fs from 'fs'
import { MarkdownProvider } from './markdownProvider'
let mdfilename = ''

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

        let html = provider.documentFile

        let filename = mdfilename.replace(ext, '.' + type)
        filename = utils.getOutputDir(filename)
        if (type == 'html') {
            exportHtml(html, filename)
        } else if (type == 'pdf') {
            exportPdf(html, filename, type)
        }

    })
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
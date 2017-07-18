'use strict'

import * as vscode from 'vscode'
import { TextDocument } from 'vscode'
import * as path from 'path'
import * as fs from 'fs'

export const rootPath = path.join(__dirname, '../..')

vscode.window.activeTextEditor.document
export function getPhantomjsPath(): string {
    // for reload phantomjs binary path
    delete require.cache[path.join(__dirname, '../..', 'node_modules', 'phantomjs-prebuilt', 'lib', 'location.js')]
    delete require.cache[path.join(__dirname, '../..', 'node_modules', 'phantomjs-prebuilt', 'lib', 'phantomjs.js')]
    // load phantomjs binary path
    const phantomPath = require(path.join(__dirname, '../..', 'node_modules', 'phantomjs-prebuilt', 'lib', 'phantomjs')).path

    return phantomPath
}
export function getOutputDir(filename: string): string {
    let output_dir =
        vscode.workspace.getConfiguration('markdown-handy')['outputDirectory'] ||
        ''
    if (output_dir.length !== 0) {
        if (isExistsDir(output_dir)) {
            return path.join(output_dir, path.basename(filename))
        } else {
            vscode.window.showWarningMessage(
                'Output directory does not exist! (markdown-pdf.outputDirectory) : ' +
                output_dir)
            return filename
        }
    }
    return filename
}

export function checkPhantomjs(): boolean {
    let phantomPath = getPhantomjsPath()
    if (isExistsFile(phantomPath)) {
        return true
    } else {
        return false
    }
}

export function installPhantomjsBinary() {
    // which npm
    const which = require('which')
    let npm: string = ''
    try {
        npm = which.sync('npm')
    } catch (e) {
        console.warn(e.message)
    }

    // which node
    let node = ''
    try {
        node = which.sync('node')
    } catch (e) {
        console.warn(e.message)
    }

    // npm rebuild phantomjs-prebuilt
    const execSync = require('child_process').execSync
    if (isExistsFile(npm) && isExistsFile(node)) {
        try {
            let std = execSync('npm rebuild phantomjs-prebuilt', {
                cwd: __dirname
            })
            console.log(std.toString())
        } catch (e) {
            vscode.window.showErrorMessage('ERROR: "npm rebuild phantomjs-prebuilt"')
            vscode.window.showErrorMessage(e.message)
            vscode.window.setStatusBarMessage('')
        }
    } else {
        // node_modules/phantomjs-prebuilt/install.js
        let install =
            path.join(__dirname, '../..', 'node_modules', 'phantomjs-prebuilt', 'install.js')
                .replace(/\\/g, '/')
        try {
            if (isExistsFile(install)) {
                require(install)
            }
        } catch (e) {
            console.error(e.message)
        }
    }

    if (checkPhantomjs()) {
        return
    }
}

export function init() {
    if (!checkPhantomjs()) {
        installPhantomjsBinary()
    }
}

export function isExistsFile(filename: string): boolean {
    if (filename.length === 0) {
        return false
    }
    try {
        if (fs.statSync(filename).isFile()) return true
        else return false
    } catch (error) {
        console.warn(error.message)
        return false
    }
}

export function isExistsDir(dirname: string): boolean {
    if (dirname.length === 0) {
        return false
    }
    try {
        if (fs.statSync(dirname).isDirectory()) return true
        else return false
    } catch (e) {
        console.warn(e.message)
        return false
    }
}

export function readFile(filename: string, encode: string = null): string {
    if (filename.length === 0) {
        return ''
    }
    if (!encode && encode !== null) {
        encode = 'utf-8'
    }
    if (filename.indexOf('file://') === 0) {
        if (process.platform === 'win32') {
            filename = filename.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '')
        } else {
            filename = filename.replace(/^file:\/\//, '')
        }
    }
    if (isExistsFile(filename)) {
        return fs.readFileSync(filename, encode)
    } else {
        return ''
    }
}

export function getMarkdownUri(uri: vscode.Uri): vscode.Uri {
    // return vscode.Uri.parse('markdown-handy://extension/markdown-handy')
    return uri.with({ scheme: 'markdown-handy', path: uri.path + '.rendered', query: uri.toString() })
}

export function getActiveDocument(): TextDocument {
    let doc = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document || this._activeDocument || false
    if (!doc) vscode.window.showInformationMessage('Cannot locate current text document!')
    return doc
}

export function getHideFrontMatter(): boolean {
    return vscode.workspace.getConfiguration('markdown')['previewFrontMatter'] === 'hide';
}
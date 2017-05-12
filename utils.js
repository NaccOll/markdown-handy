/**
 * File: \utils.js
 * Project: Markdown Handy
 * Created Date: 2017-05-11 19:08:13
 * Author: NaccOll
 * -----
 * Modified By: NaccOll
 * Last Modified: 2017-05-12 22:25:44
 * -----
 */

const vscode = require('vscode')
const path = require('path')
const fs = require('fs')

function isExistsFile(filename) {
  if (filename.length === 0) {
    return false;
  }
  try {
    if (fs.statSync(filename).isFile()) {
      return true;
    }
  } catch (e) {
    console.warn(e.message);
    return false;
  }
}

function isExistsDir(dirname) {
  if (dirname.length === 0) {
    return false;
  }
  try {
    if (fs.statSync(dirname).isDirectory()) {
      return true;
    } else {
      console.warn('undefined');
      return false;
    }
  } catch (e) {
    console.warn('false : ' + e.message);
    return false;
  }
}

function getOutputDir(filename) {
  let output_dir =
    vscode.workspace.getConfiguration('markdown-handy')['outputDirectory'] ||
    '';
  if (output_dir.length !== 0) {
    if (isExistsDir(output_dir)) {
      return path.join(output_dir, path.basename(filename));
    } else {
      vscode.window.showWarningMessage(
        'Output directory does not exist! (markdown-pdf.outputDirectory) : ' +
        output_dir);
      return filename;
    }
  }
  return filename;
}

function readFile(filename, encode) {
  if (filename.length === 0) {
    return '';
  }
  if (!encode && encode !== null) {
    encode = 'utf-8';
  }
  if (filename.indexOf('file://') === 0) {
    if (process.platform === 'win32') {
      filename = filename.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '');
    } else {
      filename = filename.replace(/^file:\/\//, '');
    }
  }
  if (isExistsFile(filename)) {
    return fs.readFileSync(filename, encode);
  } else {
    return '';
  }
}

function init() {
  if (!checkPhantomjs()) {
    installPhantomjsBinary();
  }
}

function checkPhantomjs() {
  let phantomPath = getPhantomjsPath();
  if (isExistsFile(phantomPath)) {
    return true;
  } else {
    return false;
  }
}

function getPhantomjsPath() {
  // for reload phantomjs binary path
  delete require.cache[path.join(__dirname, 'node_modules', 'phantomjs-prebuilt', 'lib', 'location.js')];
  delete require.cache[path.join(__dirname, 'node_modules', 'phantomjs-prebuilt', 'lib', 'phantomjs.js')];
  // load phantomjs binary path
  const phantomPath = require(path.join(__dirname, 'node_modules', 'phantomjs-prebuilt', 'lib', 'phantomjs')).path;
  return phantomPath;
}

function installPhantomjsBinary() {
  // which npm
  const which = require('which');
  let npm = '';
  try {
    npm = which.sync('npm');
  } catch (e) {
    console.warn(e.message);
  }

  // which node
  let node = '';
  try {
    node = which.sync('node');
  } catch (e) {
    console.warn(e.message);
  }

  // npm rebuild phantomjs-prebuilt
  const execSync = require('child_process').execSync;
  if (isExistsFile(npm) && isExistsFile(node)) {
    try {
      let std = execSync('npm rebuild phantomjs-prebuilt', {
        cwd: __dirname
      });
      console.log(std.toString());
    } catch (e) {
      vscode.window.showErrorMessage('ERROR: "npm rebuild phantomjs-prebuilt"');
      vscode.window.showErrorMessage(e.message);
      vscode.window.setStatusBarMessage('');
    }
  } else {
    // node_modules/phantomjs-prebuilt/install.js
    let install =
      path.join(__dirname, 'node_modules', 'phantomjs-prebuilt', 'install.js')
      .replace(/\\/g, '/');
    try {
      if (isExistsFile(install)) {
        require(install);
      }
    } catch (e) {
      console.error(e.message);
    }
  }

  if (checkPhantomjs()) {
    return;
  }
}


exports.init = init
exports.checkPhantomjs = checkPhantomjs
exports.getPhantomjsPath = getPhantomjsPath
exports.installPhantomjsBinary = installPhantomjsBinary
exports.getOutputDir = getOutputDir
exports.isExistsFile = isExistsFile
exports.isExistsDir = isExistsDir
exports.readFile = readFile

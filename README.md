# vscode-markdown-handy README

[简体中文](README_CN.md)

## Reason

Recently, I could not bear the slowness of Atom and the crash when I start up, so I using vscode.

I did not find the extension about markdown that I like. I want to build it that I satisfied. However, I am not good at javascript and do not know much about the advanced skills or modules. Finally, I decided to combine the existing extension to customize a extension of my own.

## Features

1. Export to html or pdf.
1. Katex Support
1. copy as html.
1. preview with Katex.

## Usage

### Command Palette

1. Open the Markdown file
1. Press F1 or Ctrl+Shift+P
1. Type pdf and select Convert Markdown To Other

### Menu

1. Open the Markdown file
1. Right click and select Convert Markdown To Other

## Version

### 0.0.1 

Fork and change [markdown-pdf](https://github.com/yzane/vscode-markdown-pdf)
choose the format of output, not use setting.
change style, delete jpeg and png.

### 0.0.2

Fork and change [mdmath](https://github.com/goessner/mdmath)
provide katex support

### 0.0.4

Improve refresh when update document.


### 0.0.5

Add `markdown-it-named-headers`


### 0.0.7

use ts, fix bug
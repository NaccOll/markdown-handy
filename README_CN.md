# vscode-markdown-handy README

[English](README.md)

## 缘由

因为受不了Atom的卡顿，转到了vscode，但是在平台上找不到合适的markdown插件，便想着自己根据现有的markdown插件自定义一款自己喜欢的。于是便有了该产物。

当然，本人并不擅长js，对其中各种高级技巧或者模块也不甚了解，故而基本是基于别人的插件做一点小修改，使之满足自己的需求。

## 特性

1. 支持katex、emoji
1. 带有以上支持的预览
1. 支持复制出Markdown对应的HTML文本
1. 支持Markdown转HTML与Pdf


## 用法

### 命令面板

1. 打开Markdown文件
1. 按下 `F1` 或 `Ctrl+Shift+P`
1. 输入 `convert`并选择 `Convert Markdown To Other`


### 菜单

1. 打开Markdown文件
1. 右键并选择 `Convert Markdown To Other`

## 版本

### 0.0.1 

以[markdown-pdf](https://github.com/yzane/vscode-markdown-pdf)为蓝本，进行修改，更改为直接选择输出样式而不用配置，修改样式，取消jpeg与png输出格式

### 0.0.2

以[mdmath](https://github.com/goessner/mdmath)为蓝本，进行修改。支持Katex，提供预览功能，但禁止预览时选择其他样式。

### 0.0.4

修复预览刷新时的闪屏现象

### 0.0.5

增加`markdown-it-named-headers`

### 0.0.7

改用ts，修复bug
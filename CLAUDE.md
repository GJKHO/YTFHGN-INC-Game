# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 本地预览

无构建步骤。直接在浏览器双击 `index.html` 即可打开，或启动本地 HTTP 服务器：

```bash
cd game-portal
python -m http.server 8765
# 访问 http://localhost:8765
```

> `fetch()` 和跨文件资源在 `file://` 协议下受浏览器安全限制，建议用 HTTP 服务器开发。

## 项目结构与架构

纯静态 HTML/CSS/JS 网站，无框架、无构建工具。

```
index.html      主页（游戏列表、Hero、关于、联系）
play.html       游戏播放页（iframe 加载游戏）
style.css       全站样式（深色主题，CSS 变量）
main.js         分类筛选逻辑 + userData 注入
userData.js     公司信息数据源（全站引用）
userData.txt    原始数据文件（第1行公司名，第2行邮箱）
game/           游戏文件目录，每个游戏一个 HTML 文件
```

## 公司信息管理

公司名和邮箱统一在 `userData.js` 中维护：

```js
window.userData = {
  company: "ZENG BOSHENG LTD",
  email:   "zcw9678@outlook.com"
};
```

`main.js` 在页面加载时读取 `window.userData`，注入所有带以下 class 的元素：
- `.ud-company` — 公司名文本
- `.ud-email` — 邮箱文本
- `.ud-email-link` — 邮件链接的 `href`

修改公司信息只需编辑 `userData.js`，无需动 HTML。

## 添加新游戏

1. 将游戏文件放至 `game/<游戏ID>.html`
2. 在 `index.html` 的 `#games-grid` 中新增一个 `<article class="game-card" data-category="<类型>">`，链接指向 `game/<游戏ID>.html`
3. 如需在精选区展示，在 Hero 的 `.featured-grid` 中新增卡片

游戏分类值：`arcade` / `puzzle` / `action` / `casual`（对应筛选按钮的 `data-filter`）。

## 样式约定

所有颜色、间距、圆角通过 `style.css` 顶部的 CSS 变量控制（`--accent`、`--surface`、`--radius` 等），修改主题只需改变量值。卡片缩略图背景类：`.arcade-bg` / `.puzzle-bg` / `.action-bg` / `.casual-bg`。

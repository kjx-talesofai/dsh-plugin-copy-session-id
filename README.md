<p align="center">
  <img src="assets/icon.svg" alt="dsh-plugin-copy-session-id" height="112"/>
</p>

# dsh-plugin-copy-session-id

Copy a Session's ID from the **DeepSeek Harness** sidebar. A Session row's `⋯` menu gains one row — **Copy Session ID** — and one click puts the full id (`session-e7797998-430a-4d2c-aba6-6d7f441f4f70`) on your clipboard, with the host's own top-centre toast confirming it.

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kjx-talesofai/dsh-plugin-copy-session-id?label=license&style=flat-square&color=green" alt="license"></a>
  <a href="https://github.com/kjx-talesofai/dsh-plugin-copy-session-id/actions/workflows/ci.yml"><img src="https://github.com/kjx-talesofai/dsh-plugin-copy-session-id/actions/workflows/ci.yml/badge.svg?branch=main&event=push" alt="CI"></a>
  <img src="https://img.shields.io/badge/DSH-%E2%89%A5%200.2.0--rc.1-blueviolet?style=flat-square" alt="DSH >= 0.2.0-rc.1">
</p>

> 侧边栏会话菜单里一键复制会话 ID

<details>
<summary><b>中文说明（点开）</b></summary>

任意会话行点 `⋯`，菜单最后多出一行 **复制会话 ID**，点一下就把完整 ID 写进剪贴板。菜单行用宿主自己的 `MenuItemButton` 与 `Toast`，所以样式、悬停态、↑/↓/Tab/Esc 键盘行走和焦点归位都和内置行一致。

这是个**纯界面插件**：Host 半边是空的 `apply`，不写文件、不发请求——ID 本来就在浏览器侧，`sidebar.workspaces` 已经把每个会话行的 `sessionId` 交给了它的菜单条目。

复制的是**会话 ID**，不是标题。浏览器拒绝剪贴板写入时会显示「复制失败，请手动复制会话 ID」，而不是绿色成功提示。

安装：DSH「添加插件」里填 `github:kjx-talesofai/dsh-plugin-copy-session-id#v0.1.0`（本地目录要用**绝对路径**），装完**重启桌面端**。卸载就是反过来，在插件列表里移除再重启。

</details>

## Install

DSH → **Add plugin**:

```text
github:kjx-talesofai/dsh-plugin-copy-session-id#v0.1.0
```

```sh
dsh plugin --profile desktop add github:kjx-talesofai/dsh-plugin-copy-session-id#v0.1.0
```

Then **restart the desktop app**: the plugin row is what makes the harness serve the browser half into the page. A local checkout works too, with an absolute path. Upgrading is uninstall-then-install.

Requires **DSH Desktop ≥ 0.2.0-rc.1** (the `peerDependencies` range on `@deepseek-ai/dsh` that the harness enforces). Verified by hand on macOS (Apple Silicon) · DSH Desktop 0.2.0-rc.2.

## How it works

| | |
|---|---|
| Slot | `sidebar.workspaces.session.menu.item`, order `500` — after the shipped `archive` (400), with `separatorBefore` |
| Feedback | `shell.overlay`, rendered with the host's `Toast` (the menu row unmounts with the menu) |
| Host atoms | `@deepseek-ai/dsh-client-ui-primitives` — `MenuItemButton`, `Toast`, `writeClipboard`, the icons |
| Build | none — `client.js` is the shipped artifact, written in the loader's `window.__ModuleLoader__.load({ id, factory })` format |

## Development

```sh
npm test    # node:test — no install needed, and nothing to build
```

`tests/plugin.test.mjs` runs `client.js` through `node:vm` against a recording context: both rendering paths, every clipboard settle path (success, `false`, rejection, no Clipboard API), the locale seat and the effect disposers. It does **not** cover the rendered menu or the real clipboard write — those were confirmed by hand on the configuration above. `tools/asar.mjs` is a dev-only ASAR reader for inspecting the installed dsh packages, and is not part of the published tarball.

## License

[MIT](LICENSE) © 2026 Jiaxin Kou

<p align="center">
  <a href="https://hypersampling.com">
    <img src="https://assets.hypersampling.com/hyper-sampling-2.jpg" alt="hypersampling" height="38"/>
  </a>
</p>

Built by [Jiaxin Kou](https://hypersampling.com) · [GitHub](https://github.com/kjx-talesofai)

<p align="center">
  <img src="assets/icon.svg" alt="dsh-plugin-copy-session-id" height="112"/>
</p>

# dsh-plugin-copy-session-id

Copy a Session's ID in **DeepSeek Harness**, from either of two places: a Session row's `⋯` menu in the sidebar, or the copy button in the header of the Session you have open. One click puts the full id (`session-e7797998-430a-4d2c-aba6-6d7f441f4f70`) on your clipboard, with the host's own top-centre toast confirming it.

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kjx-talesofai/dsh-plugin-copy-session-id?label=license&style=flat-square&color=green" alt="license"></a>
  <a href="https://github.com/kjx-talesofai/dsh-plugin-copy-session-id/actions/workflows/ci.yml"><img src="https://github.com/kjx-talesofai/dsh-plugin-copy-session-id/actions/workflows/ci.yml/badge.svg?branch=main&event=push" alt="CI"></a>
  <img src="https://img.shields.io/badge/DSH-%E2%89%A5%200.2.0--rc.1-blueviolet?style=flat-square" alt="DSH >= 0.2.0-rc.1">
</p>

> 侧边栏会话菜单、以及当前会话标题栏，都能一键复制会话 ID

<details>
<summary><b>中文说明（点开）</b></summary>

两个入口，同一个动作：

- **侧边栏会话行的 `⋯` 菜单**最后多出一行 **复制会话 ID**（用宿主自己的 `MenuItemButton` 与 `Toast`，样式、悬停态、↑/↓/Tab/Esc 键盘行走和焦点归位都和内置行一致）；
- **会话标题栏右侧**（那排工具的 `⋯` 左边）多出一个复制图标，复制的是**当前打开的这个会话**。

第二个入口是为**子代理会话**准备的：它们的 ID 只能这样拿——`sidebar.workspaces` 会把带 `origin: 'subagent'` 的行整个隐藏，所以子代理会话在侧边栏里根本没有座位。标题栏的 `⋯` 下拉本身没有插槽（它的选项由 `session-log-export` 写死），因此插件只能作为它旁边的同级控件出现。

这是个**纯界面插件**：Host 半边是空的 `apply`，不写文件、不发请求——ID 本来就在浏览器侧，会话标题栏和会话行都拿得到 `sessionId`。

复制的是**会话 ID**，不是标题。浏览器拒绝剪贴板写入时会显示「复制失败，请手动复制会话 ID」，而不是绿色成功提示。

安装：DSH「添加插件」里填 `github:kjx-talesofai/dsh-plugin-copy-session-id#v0.2.0`（本地目录要用**绝对路径**），装完**重启桌面端**。卸载就是反过来，在插件列表里移除再重启。

</details>

## Install

DSH → **Add plugin**:

```text
github:kjx-talesofai/dsh-plugin-copy-session-id#v0.2.0
```

```sh
dsh plugin --profile desktop add github:kjx-talesofai/dsh-plugin-copy-session-id#v0.2.0
```

Then **restart the desktop app**: the plugin row is what makes the harness serve the browser half into the page. A local checkout works too, with an absolute path. Upgrading is uninstall-then-install.

Requires **DSH Desktop ≥ 0.2.0-rc.1** (the `peerDependencies` range on `@deepseek-ai/dsh` that the harness enforces). Verified by hand on macOS (Apple Silicon) · DSH Desktop 0.2.0-rc.2.

## How it works

| | |
|---|---|
| Slots | `sidebar.workspaces.session.menu.item`, order `500`, with `separatorBefore` — after the shipped `archive` (400); and `conversation.session.header.utilities`, order `-5` — between `open-in-app` (`-10`) and the header's own `⋯` menu (`0`) |
| Feedback | `shell.overlay`, rendered with the host's `Toast` — one shared toast for both surfaces (the menu row unmounts with the menu) |
| Host atoms | `@deepseek-ai/dsh-client-ui-primitives` — `MenuItemButton`, `Button`, `Toast`, `writeClipboard`, the icons |
| Build | none — `client.js` is the shipped artifact, written in the loader's `window.__ModuleLoader__.load({ id, factory })` format |

## Development

```sh
npm test    # node:test — no install needed, and nothing to build
```

`tests/plugin.test.mjs` runs `client.js` through `node:vm` against a recording context: both surfaces, both rendering paths, every clipboard settle path (success, `false`, rejection, no Clipboard API), the locale seat and the effect disposers. It does **not** cover the rendered menu or the real clipboard write — those were confirmed by hand on the configuration above. `tools/asar.mjs` is a dev-only ASAR reader for inspecting the installed dsh packages, and is not part of the published tarball.

## License

[MIT](LICENSE) © 2026 Jiaxin Kou

<p align="center">
  <a href="https://hypersampling.com">
    <img src="https://assets.hypersampling.com/hyper-sampling-2.jpg" alt="hypersampling" height="38"/>
  </a>
</p>

Built by [Jiaxin Kou](https://hypersampling.com) · [GitHub](https://github.com/kjx-talesofai)

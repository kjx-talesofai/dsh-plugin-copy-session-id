<p align="center">
  <img src="assets/icon.svg" alt="dsh-plugin-copy-session-id" height="112"/>
</p>

# dsh-plugin-copy-session-id

Copy a Session's ID straight from your **DeepSeek Harness** sidebar. The Session row's `⋯` menu grows one row — **Copy Session ID** — and one click puts the full id (`session-e7797998-430a-4d2c-aba6-6d7f441f4f70`) on your clipboard.

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kjx-talesofai/dsh-plugin-copy-session-id?label=license&style=flat-square&color=green" alt="license"></a>
  <a href="https://github.com/kjx-talesofai/dsh-plugin-copy-session-id/actions/workflows/ci.yml"><img src="https://github.com/kjx-talesofai/dsh-plugin-copy-session-id/actions/workflows/ci.yml/badge.svg?branch=main&event=push" alt="CI"></a>
  <img src="https://img.shields.io/badge/DSH-%E2%89%A5%200.2.0--rc.1-blueviolet?style=flat-square" alt="DSH >= 0.2.0-rc.1">
</p>

> dsh-plugin-copy-session-id — 在侧边栏会话菜单里一键复制会话 ID

<details>
<summary><b>中文说明（点开）</b> —— 从会话的「⋯」菜单里复制这个会话的 ID</summary>

**它是什么**：DSH 桌面端插件。任意会话行点 `⋯`，菜单最后多出一行 **复制会话 ID**，点一下就把该会话的完整 ID 写进剪贴板；顶部居中的提示（带绿色对勾）告诉你复制成功了。

**为什么做**：会话 ID 是引用一段对话时最准确的坐标——粘贴给同事、写进 issue、喂给脚本或另一个 agent。但 DSH 界面里没有地方能拿到它：标题只是标题，重命名也改不了它，日志文件更是刨不出来。这个插件补的就是这一格。

**和 Tailscale 那个插件的分工**：本插件是**纯界面插件**——Host 半边是空的、不写文件、不发网络请求。ID 本来就在浏览器侧：`sidebar.workspaces` 会把每个会话行的 `sessionId` 交给它自己的菜单条目，插件只是把它转交给剪贴板。

**怎么装**（在 DSH「添加插件」里填，**不需要 npm 账号、也无需发布**）：

| 填入 | 形式 |
|---|---|
| GitHub | `github:kjx-talesofai/dsh-plugin-copy-session-id#v0.1.0` |
| 本地目录 | **绝对路径**，例如 `/path/to/dsh-plugin-copy-session-id` |

装完**重启桌面端**：插件行由 Host 的 Loader 挂载，浏览器的半边（也就是那一行菜单）要靠它才会被送进页面。

**怎么用**：侧边栏任意会话 → `⋯` → **复制会话 ID** → 粘贴。

**注意事项**：

- 复制的是**会话 ID**，不是标题，也不是你刚看到的那段文字；
- 浏览器可能拒绝剪贴板写入（页面失去焦点、无痕窗口的权限设置等）；这时显示的是「复制失败，请手动复制会话 ID」，而**不是**绿色的成功提示；
- 提示条来自 DSH 自己的 `shell.overlay` 层；若某个组合没有加载声明它的 `dsh-client-ui-layout`，复制照常发生，只是没有任何提示。

**卸载**：DSH「插件」列表里卸载 `dsh-plugin-copy-session-id` → 重启。

**老实说（实测范围）**：只在 **macOS（Apple Silicon）+ DSH Desktop 0.2.0-rc.2** 上装过并确认这一行真的挂进了菜单。**菜单渲染出来的样子和真实剪贴板写入没有被自动测试覆盖**（见 Verification）；Windows / Linux 未测。

</details>

## Why

A Session id is the precise handle for a conversation. It is what you paste into an issue, a script, or another agent's context — and the UI gives you no way to reach it. The title is not the id, renaming does not change the id, and the id in the session log is not somewhere you want to be grepping.

This plugin adds exactly that one row, and nothing else:

- **No host-side behaviour.** `index.js` exports an empty `apply`; the row exists only so the harness serves the browser half. Nothing is written to disk, no route is registered, no network call is made.
- **No new state.** The id already travels in the props the workspace browser hands to every menu row; the copy is a pure browser action.
- **No build step and no dependencies.** The browser half is hand-written in the client loader's own format and ships as-is.

## Install

Use DSH's plugin install dialog (**Add plugin**) with either of these, then restart the desktop app:

```text
github:kjx-talesofai/dsh-plugin-copy-session-id#v0.1.0   # GitHub, pinned to a tag
/absolute/path/to/dsh-plugin-copy-session-id             # local checkout (dev) — must be absolute
```

> This plugin is **not published to the npm registry**, and does not need to be. `npm pack` in a checkout produces a `.tgz` you can hand to someone else, or install with `dsh plugin --profile desktop add ./dsh-plugin-copy-session-id-0.1.0.tgz`.

CLI equivalent:

```sh
dsh plugin --profile desktop add github:kjx-talesofai/dsh-plugin-copy-session-id#v0.1.0
```

The **restart** is not incidental: the plugin row is what makes the harness serve the browser half into the page, so until the app comes back the menu row does not exist.

> Upgrading an installed copy is uninstall-then-install: DSH's plugin manager does not update a plugin in place yet.

Requires **DSH Desktop ≥ 0.2.0-rc.1** (declared as a `peerDependencies` range on `@deepseek-ai/dsh`, which is the check the harness actually enforces — `dsh.engines` is declarative only).

## Usage

1. Sidebar → hover any Session row → click `⋯`.
2. The menu now ends with a hairline and **Copy Session ID**, after the shipped `Archive`.
3. Click it. The menu closes, the id goes to the clipboard, and a top-centre banner confirms it.

The row is a plain `role="menuitem"` button, so it joins the menu's existing keyboard walk: `↑`/`↓` and `Tab` reach it, `Enter` activates it, and `Escape` closes the menu and returns focus to the row's `⋯` trigger.

### How it works

| | |
|---|---|
| Slot | `sidebar.workspaces.session.menu.item` — a `list` slot declared by the `sidebar.workspaces` entry of `dsh-client-ui-workspace`; the shipped rows are `pin` (100), `rename` (200), `fork` (300), `archive` (400) |
| Row id / order | `dsh-plugin-copy-session-id` / `500` — last, with `separatorBefore` opening the plugin group |
| Feedback seat | `shell.overlay`, declared by `dsh-client-ui-layout`, rendered with the host's `Toast` |
| Client services | `slots`, `locale` |
| Host rows | one, with an empty `apply` — the browser half is discovered through the package's `dsh.client` declaration |
| Host atoms | `@deepseek-ai/dsh-client-ui-primitives` (`MenuItemButton`, `Toast`, `writeClipboard`, the icons), which the client loader lists as a platform seed module and answers through its own `require` |

Two details worth knowing:

- The menu row unmounts with the menu, so the outcome is reported from a seat that outlives it. Both entries share one tiny store created inside `apply`; a sequence number remounts the banner so a second copy restarts its hold instead of inheriting the first one's — and the failure message keeps the warning tint instead of borrowing the success checkmark.
- The row carries no shortcut column, so unlike the shipped `Rename`/`Fork` rows it has no `⌥⌘G`/`⌥⌘F` right-aligned hint. Everything else — host `MenuItemButton` styling, icon atom, hover state, keyboard walk, focus return — is the host's own.

## Verification

`npm test` covers the contract without a browser:

- the shipped `client.js` is executed as a plain script against a `window.__ModuleLoader__` facade, proving it really is a script-executable client bundle that registers the package's own id;
- it requires only `react` and the host primitives package — both platform seed modules — so materialization cannot miss the loader table;
- the factory materializes both with the host primitives and without them; the stand-in row renders real `role="menuitem"` markup with the group separator, and the stand-in banner renders with the atom's placement, hold and glyph tint;
- a clipboard that resolves `false`, rejects, or is missing entirely reports a failure rather than going silent, and never borrows the success checkmark;
- `apply` registers exactly two entries with the ids, order, locale seat and inject faces the slot contract requires, and every effect — the locale registration and both slot-injection callbacks — returns a real disposer;
- the menu row and the overlay entry are really wired together: invoking the row writes the clipboard, closes the menu, and publishes a banner whose tone distinguishes success from failure;
- the toast store notifies its subscribers and keeps its snapshot identity-stable, and the entry subscribes with a stable identity.

Not covered, and therefore **unverified in CI**: anything the real harness owns — `ui-slots`/`ui-renderer` prop composition, the `Menu`'s keyboard walk and focus return, `dsh-client-locale`'s live resolution, React, and the host `MenuItemButton`/`Toast` rendering — plus the rendered menu itself and the real clipboard write. Those were confirmed by hand, once, on the configuration below.

## Compatibility

Verified by hand on **macOS (Apple Silicon) · DSH Desktop 0.2.0-rc.2**. Platform modules in the app bundle: `dsh-client-ui-workspace`, `dsh-client-ui-layout`, `dsh-client-ui-primitives`, `dsh-client-ui-slots`, `dsh-client-locale`, all at `0.2.0-rc.2`.

Not tested: Windows, Linux, and DSH versions other than 0.2.0-rc.2. The plugin leans on upstream behaviour — the `sidebar.workspaces.session.menu.item` owner share and its `useMenuOpenState` hook, the `MenuItemButton`/`Toast`/`writeClipboard` atoms, and the client loader's module wrapper and platform seed table. The test suite pins what it depends on, so run `npm test` first after a DSH upgrade.

## Development

> The `npm` below is just the CLI bundled with Node — no account, nothing published, and nothing to install.

```sh
npm test                            # the contract suite (node:test) — runs on a bare checkout
node --test tests/plugin.test.mjs   # same thing, spelled out
```

Repo layout — **sources are the artifacts**:

| Path | What it is | Ships to users |
|---|---|---|
| `index.js` | host half (an empty `apply`; the row is what mounts the browser half) | ✓ |
| `client.js` | browser half — hand-written in the client loader's `window.__ModuleLoader__.load({ id, factory })` format, so there is deliberately nothing to build | ✓ |
| `cordis.patch.yml` | bundle layer: inserts this plugin's row | ✓ |
| `assets/icon.svg` | plugin card icon (523 B) | ✓ |
| `locale/{en,zh}.json` | the plugin card's title and description | ✓ |
| `tests/plugin.test.mjs` | the contract suite | ✗ |
| `tools/asar.mjs` | dev-only helper: a read-only ASAR reader, so `cat`/`rg` can reach the packages inside a shipped `app.asar` | ✗ |

The suite drives the plugin's own boundaries and is explicit about the ones it stubs; the file header lists both.

`tools/asar.mjs` is not part of the published tarball. It exists because in DSH Desktop the dsh packages live inside `app.asar`, where ordinary shell tools cannot read them:

```sh
node tools/asar.mjs list "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar" "dsh-client-ui-workspace/"
node tools/asar.mjs grep "/Applications/DeepSeek Harness.app/Contents/Resources/app.asar" "staticModules"
```

## Uninstall

Remove `dsh-plugin-copy-session-id` in DSH's plugin list and restart. Nothing else to clean up: the plugin holds no state, no files, and no host-side resources.

## License

[MIT](LICENSE) © 2026 Jiaxin Kou

<p align="center">
  <a href="https://hypersampling.com">
    <img src="https://assets.hypersampling.com/hyper-sampling-2.jpg" alt="hypersampling" height="38"/>
  </a>
</p>

Built by [Jiaxin Kou](https://hypersampling.com) · [GitHub](https://github.com/kjx-talesofai)

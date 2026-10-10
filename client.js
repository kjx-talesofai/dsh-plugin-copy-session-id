/**
 * Copy Session ID — browser half.
 *
 * Two slot contributions, both under the harness's own module-loader wrapper
 * (`window.__ModuleLoader__.load({ id, factory })`) so the package needs no build
 * step: this file IS the shipped client bundle.
 *
 *   `sidebar.workspaces.session.menu.item` — one extra row in a Session's "..."
 *   menu, ordered after the shipped Archive (400). It reads the `sessionId` the
 *   workspace browser already passes to every row, closes the menu through the
 *   slot's own `useMenuOpenState` hook, and writes the id to the clipboard.
 *
 *   `shell.overlay` — the frame-wide floating layer, where the copy outcome is
 *   reported with the host's own Toast. The menu row unmounts with the menu, so
 *   the feedback needs a seat that outlives it. That seat is declared by
 *   `dsh-client-ui-layout`; where it is absent the copy still happens and only
 *   the feedback is missing.
 *
 * The two entries share one small store created inside `apply`, so nothing
 * outlives the plugin's own context.
 *
 * `@deepseek-ai/dsh-client-ui-primitives` is a platform seed module of the
 * client loader (the shell lists it in `staticModules`), which is why the row can
 * use the host's own `MenuItemButton` and Toast instead of a lookalike. The
 * require is still guarded: every rendering atom has a stand-in, because a harness
 * that stopped shipping the seed should cost this row its styling rather than
 * blank the Session menu. The clipboard stand-in is deliberately narrower than the
 * atom it replaces — see `fallbackWriteClipboard`. Those stand-ins are unreachable
 * on 0.2.0-rc.2; the test suite drives them deliberately.
 *
 * @module dsh-plugin-copy-session-id/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-plugin-copy-session-id',
  factory(require) {
    const React = require('react')

    /** Host primitives are optional at runtime; see the module doc. */
    let primitives = {}
    try {
      primitives = require('@deepseek-ai/dsh-client-ui-primitives') ?? {}
    } catch {
      primitives = {}
    }

    const h = React.createElement

    /** Locale namespace for every user-visible string this plugin adds. */
    const NS = 'dsh-plugin-copy-session-id'

    const DICTS = {
      en: {
        'menu.copyId': 'Copy Session ID',
        'toast.copied': 'Session ID copied',
        'toast.failed': 'Copy failed — copy the Session ID manually',
      },
      zh: {
        'menu.copyId': '复制会话 ID',
        'toast.copied': '已复制会话 ID',
        'toast.failed': '复制失败，请手动复制会话 ID',
      },
    }

    //#region degraded stand-ins

    /**
     * Plain `role="menuitem"` row, used only when `MenuItemButton` is missing.
     * Mirrors the atom's markup closely enough to stay usable: a leading icon seat
     * and the group hairline, so the degraded menu still reads as the host's.
     * It does not reproduce the atom's shortcut column or `dense`/`danger` modes,
     * which this row does not use.
     */
    function FallbackMenuItem({ children, icon, separatorBefore = false, onSelect }) {
      return h(
        'div',
        null,
        separatorBefore
          ? h('div', {
              role: 'separator',
              style: { height: 1, margin: '4px 8px', background: 'var(--dsw-alias-border-l1)' },
            })
          : null,
        h(
          'button',
          {
            type: 'button',
            role: 'menuitem',
            onClick: onSelect,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 12px',
              border: 0,
              background: 'transparent',
              color: 'var(--dsw-alias-label-primary)',
              font: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
            },
          },
          icon === undefined ? null : h('span', { 'aria-hidden': 'true' }, icon),
          h('span', null, children),
        ),
      )
    }

    /** The host Toast's own timings and placement (`Toast.module.css`, `Toast.tsx`). */
    const TOAST_HOLD_MS = 3000
    const TOAST_FADE_MS = 1000
    const TOAST_Z_INDEX = 1100

    /**
     * Banner used only when the host Toast is missing. Placement, stacking, hold
     * and glyph colour follow the atom, so the same event reads in the same place.
     * It is an approximation, not a port, and says so rather than implying
     * parity: the surface colours and metrics are its own, it does not animate its
     * fade, and its glyphs are text characters instead of the host's
     * `IconCheckCircleOutlineRegular` / `IconWarningOutlineRegular` — which is also
     * why a failure cannot fall back to the host's warning icon here: in this
     * composition the icons belong to the very package that is missing.
     */
    function FallbackToast({ text, tone, icon, onDone }) {
      const latest = React.useRef(onDone)
      React.useLayoutEffect(() => {
        latest.current = onDone
      }, [onDone])
      React.useEffect(() => {
        const timer = setTimeout(() => latest.current(), TOAST_HOLD_MS + TOAST_FADE_MS)
        return () => clearTimeout(timer)
      }, [])
      const success = tone === 'success'
      const glyph = icon ?? (success ? '✓' : '!')
      return h(
        'div',
        {
          role: 'alert',
          style: {
            position: 'fixed',
            top: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: TOAST_Z_INDEX,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid var(--dsw-alias-border-l1)',
            background: 'var(--dsw-alias-bg-overlay)',
            color: 'var(--dsw-alias-label-primary)',
            boxShadow: '0 8px 24px rgb(0 0 0 / 18%)',
            fontSize: 14,
            pointerEvents: 'none',
          },
        },
        // `glyph` is always defined: `icon ?? …` covers the absent-icon case.
        h(
          'span',
          {
            'aria-hidden': 'true',
            style: {
              // The atom's own seat colours (`.icon` / `.icon.success`): green for
              // success, the warning label colour otherwise.
              color: success ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-warn-label)',
            },
          },
          glyph,
        ),
        h('span', null, text),
      )
    }

    /**
     * Last-resort clipboard write, used only when the host primitive is missing.
     * Deliberately narrow: the async Clipboard API alone. The host's own helper
     * also falls back to `execCommand` over a temporary textarea; reproducing that
     * tail here would only be a copy that can drift from the real one.
     * @param text - the exact text to place on the clipboard.
     * @returns true only when the browser accepted the write.
     */
    async function fallbackWriteClipboard(text) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        return false
      }
    }

    const MenuItemButton = primitives.MenuItemButton ?? FallbackMenuItem
    const Toast = primitives.Toast ?? FallbackToast
    // Kept as `undefined` when absent: `MenuItemButton` renders its icon seat for
    // any non-undefined value, so a null-rendering component would indent the row.
    const CopyIcon = primitives.IconCopyOutlineRegular
    const WarningIcon = primitives.IconWarningOutlineRegular
    const writeClipboard =
      typeof primitives.writeClipboard === 'function' ? primitives.writeClipboard : fallbackWriteClipboard

    //#endregion

    /**
     * One-slot toast queue shared by the menu row and the overlay entry.
     *
     * `getSnapshot` returns the same object until the shown message changes, which
     * is what `useSyncExternalStore` requires; `seq` lets the overlay remount the
     * banner (and so restart its hold) when the same text is shown twice. `failed`
     * rides along so the renderer can pick the tone — a failure must never borrow
     * the success checkmark.
     */
    function createToastStore() {
      let current = null
      const listeners = new Set()
      const publish = () => {
        for (const listener of [...listeners]) listener()
      }
      return {
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        getSnapshot() {
          return current
        },
        show(text, failed) {
          current = { seq: current === null ? 1 : current.seq + 1, text, failed: failed === true }
          publish()
        },
        dismiss(seq) {
          if (current === null || current.seq !== seq) return
          current = null
          publish()
        },
      }
    }

    /**
     * The Session menu row (order 500, after the shipped Archive at 400).
     * @param props.sessionId - the Session the row belongs to (owner share).
     * @param props.useMenuOpenState - the slot's menu-open hook (bound by the owner).
     * @param props.copySessionId - the row's action (registration inject face).
     * @param props.t - the locale seat bound from this registration's namespace.
     * @returns the row, or null when there is no id to offer.
     */
    function CopySessionIdMenuItem({ sessionId, useMenuOpenState, copySessionId, t }) {
      // Hooks run before the early return, as React requires.
      const [, setMenuOpen] = useMenuOpenState()
      // The owner always supplies an id; should it ever not, the row must not be
      // offered at all rather than act as a menu item that does nothing.
      if (typeof sessionId !== 'string' || sessionId.length === 0) return null
      // The `locale` seat below guarantees `t`, but a row that throws blanks the
      // whole Session menu — so the label degrades instead.
      const label = typeof t === 'function' ? t('menu.copyId') : DICTS.en['menu.copyId']
      return h(
        MenuItemButton,
        {
          // Our row opens the plugin group below the shipped actions.
          separatorBefore: true,
          icon: CopyIcon === undefined ? undefined : h(CopyIcon, {}),
          onSelect: () => {
            // The menu unmounts with the list; close it before the async write so
            // focus returns to the row's trigger immediately.
            setMenuOpen(false)
            copySessionId(sessionId)
          },
        },
        label,
      )
    }

    /**
     * The overlay seat that reports the copy outcome. It renders no copy of its
     * own — the menu row already resolved the message — so it declares no locale
     * seat.
     * @param props.toast - the shared store (registration inject face).
     * @returns the banner, or null while nothing was copied.
     */
    function CopySessionIdToast({ toast }) {
      const current = React.useSyncExternalStore(toast.subscribe, toast.getSnapshot, toast.getSnapshot)
      if (current === null) return null
      return h(Toast, {
        // Remount per message: the banner restarts its hold instead of inheriting
        // the previous one.
        key: current.seq,
        text: current.text,
        // 'success' brings the host's green circled check; a failure keeps the
        // default tint and states itself with the warning glyph.
        tone: current.failed ? undefined : 'success',
        // The host seat forwards any node, so a text glyph also covers the mixed
        // composition where the Toast exists but the icon atom does not.
        icon: current.failed ? (WarningIcon === undefined ? '!' : h(WarningIcon, {})) : undefined,
        onDone: () => {
          toast.dismiss(current.seq)
        },
      })
    }

    /** Client services this plugin needs before it can register anything. */
    const inject = ['slots', 'locale']

    /**
     * Register the dictionaries, the menu row, and the toast seat.
     * @param ctx - client root context.
     */
    function apply(ctx) {
      // Bound once: `translate` reads the active locale at call time, so the toast
      // text follows a language switch without re-registering anything.
      const t = ctx.locale.bind(NS)
      const toast = createToastStore()
      const report = (failed) => {
        toast.show(t(failed ? 'toast.failed' : 'toast.copied'), failed)
      }

      ctx.effect(
        () => ctx.locale.register(NS, { en: DICTS.en, zh: DICTS.zh }),
        'dsh-plugin-copy-session-id: dictionaries',
      )

      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'dsh-plugin-copy-session-id.toast',
            inject: () => ({ toast }),
          },
          CopySessionIdToast,
        ),
      )

      ctx.slots.inject('sidebar.workspaces.session.menu.item', () =>
        ctx.slots.register(
          {
            name: 'sidebar.workspaces.session.menu.item',
            // The package's own name: an id no shipped row and no other plugin can
            // collide with (the shipped rows are bare words: pin/rename/fork/archive).
            id: 'dsh-plugin-copy-session-id',
            order: 500,
            locale: NS,
            inject: () => ({
              copySessionId: (sessionId) => {
                const text = String(sessionId ?? '')
                if (text.length === 0) return
                // The primitive can reject as well as resolve false — its textarea
                // tail sits outside its own try — and a silently dead row is the
                // one outcome this action must never produce.
                void writeClipboard(text).then(
                  (ok) => {
                    report(ok !== true)
                  },
                  () => {
                    report(true)
                  },
                )
              },
            }),
          },
          CopySessionIdMenuItem,
        ),
      )
    }

    return { inject, apply }
  },
})

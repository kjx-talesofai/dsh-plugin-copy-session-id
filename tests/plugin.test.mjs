/**
 * Contract test for dsh-plugin-copy-session-id.
 *
 * There is no browser here, so the suite drives the plugin through the boundaries
 * it owns, and is explicit about the ones it does not:
 *
 *   Proven here
 *   - `client.js` runs as a plain script (`node:vm`) against a
 *     `window.__ModuleLoader__` facade and registers the package's own id, i.e.
 *     the shipped artifact is really a script-executable client bundle.
 *   - it requires only `react` and the host primitives package, so materialization
 *     cannot miss the loader table.
 *   - the factory materializes both with the host primitives and without them; the
 *     stand-in row renders real `role="menuitem"` markup with the group separator,
 *     and the stand-in banner renders with the atom's placement, hold and tint.
 *   - `apply` registers exactly two entries, with the ids, order, locale seat and
 *     inject faces the slot contract requires, and every effect — the locale
 *     registration and both slot-injection callbacks — hands back a real disposer
 *     (a missing one would break the next hot re-apply).
 *   - the menu row and the overlay entry are really wired to each other through
 *     one shared store: invoking the row writes the clipboard (success, `false`,
 *     and rejection), closes the menu, and publishes a banner whose tone
 *     distinguishes success from failure.
 *   - the toast store notifies its subscribers and keeps `getSnapshot`
 *     identity-stable, and the entry subscribes with a stable identity.
 *
 *   NOT proven here
 *   - anything the real harness owns: `ui-slots`/`ui-renderer` prop composition,
 *     the `Menu`'s keyboard walk and focus return, `dsh-client-locale`'s live
 *     resolution, React's real effect scheduling, and the host
 *     `MenuItemButton`/`Toast` rendering. Those are stubbed. The rendered menu and
 *     the real clipboard write remain unverified in this environment.
 *
 * Run with `npm test`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const clientSource = readFileSync(join(root, 'client.js'), 'utf8')

const NS = pkg.name
const MENU_SLOT = 'sidebar.workspaces.session.menu.item'
const OVERLAY_SLOT = 'shell.overlay'
const HEADER_SLOT = 'conversation.session.header.utilities'
const PRIMITIVES = '@deepseek-ai/dsh-client-ui-primitives'
const SESSION_ID = 'session-e7797998-430a-4d2c-aba6-6d7f441f4f70'

const tick = () => new Promise((resolveTick) => setTimeout(resolveTick, 0))

/**
 * A minimal React stand-in that keeps the conventions these components rely on:
 * children live in `props.children`, an element for a function component is only
 * markup once that function is called, and an effect body runs on every call (the
 * plugin's only effect is the banner's timer, and the assertions below pin its
 * value rather than how many times it was scheduled).
 */
function fakeReact() {
  return {
    createElement: (type, props, ...children) => {
      const { key, ...rest } = props ?? {}
      const nested = children.length === 0 ? undefined : children.length === 1 ? children[0] : children
      return { type, props: { ...rest, children: nested }, key: key ?? null }
    },
    useRef: (value) => ({ current: value }),
    useEffect: (effect) => {
      effect()
    },
    useLayoutEffect: (effect) => {
      effect()
    },
    /** The `subscribe` identities the components installed, in render order. */
    subscribes: [],
    useSyncExternalStore(subscribe, getSnapshot) {
      this.subscribes.push(subscribe)
      return getSnapshot()
    },
  }
}

/**
 * The host primitives, reduced to the atoms this plugin reads.
 * @param options.onCopy - receives the text the primitive was asked to write.
 * @param options.result - what `writeClipboard` settles with: true, false, or a
 *   thrown Error, because the real primitive rejects as well as resolving false.
 */
function fakePrimitives({ onCopy = () => {}, result = true } = {}) {
  return {
    Button: () => null,
    IconCopyOutlineRegular: () => null,
    IconWarningOutlineRegular: () => null,
    MenuItemButton: () => null,
    Toast: () => null,
    writeClipboard: async (text) => {
      onCopy(text)
      if (result instanceof Error) throw result
      return result
    },
  }
}

/** Render one function component the way React would. */
function render(element) {
  return element.type(element.props)
}

/** Concatenate the text of a rendered element tree. */
function textOf(element) {
  if (element === null || element === undefined || typeof element === 'boolean') return ''
  if (typeof element === 'string' || typeof element === 'number') return String(element)
  if (Array.isArray(element)) return element.map(textOf).join('')
  return textOf(element.props.children)
}

/**
 * A recording client context: the smallest thing `apply` legitimately uses,
 * modelled on the real services' contracts rather than on convenience.
 * @param active - the active locale, resolved the way the real service does.
 */
function createContext(active = 'zh') {
  const dictionaries = new Map()
  const effects = []
  const registrations = []
  return {
    dictionaries,
    effects,
    registrations,
    ctx: {
      effect(factory) {
        const dispose = factory()
        // The real reason this matters: the locale service throws
        // `locale namespace "<ns>" already has locale "<locale>"` if a namespace is
        // registered twice, so an effect that forgets its disposer turns the next
        // hot re-apply into a crash.
        assert.equal(typeof dispose, 'function', 'every ctx.effect callback must return a disposer')
        effects.push(dispose)
        return dispose
      },
      locale: {
        register(namespace, dicts) {
          const existing = dictionaries.get(namespace) ?? {}
          for (const locale of Object.keys(dicts)) {
            if (existing[locale] !== undefined) {
              throw new Error(`locale namespace "${namespace}" already has locale "${locale}"`)
            }
          }
          dictionaries.set(namespace, { ...existing, ...dicts })
          return () => {
            const current = dictionaries.get(namespace)
            if (current === undefined) return
            for (const locale of Object.keys(dicts)) if (current[locale] === dicts[locale]) delete current[locale]
          }
        },
        // Mirrors the real chain: active locale, then English, then the key.
        bind(namespace) {
          return (key) => {
            const dicts = dictionaries.get(namespace) ?? {}
            return dicts[active]?.[key] ?? dicts.en?.[key] ?? key
          }
        },
      },
      slots: {
        register(options, component) {
          registrations.push({ options, component })
          // The real registry returns a disposer function, which `inject` collects.
          return () => {}
        },
        // `ui-renderer` wraps the callback in `ctx.effect(callback)`, and cordis
        // collects whatever function it returns — so the disposer contract is the
        // same one `ctx.effect` enforces above.
        inject(key, callback) {
          const dispose = callback()
          assert.equal(typeof dispose, 'function', `slots.inject("${key}") must return a disposer`)
          effects.push(dispose)
          return () => {}
        },
      },
    },
  }
}

/**
 * Boot one rendering path end to end.
 * @param primitives - what the `require` stub answers for the primitives package.
 * @param onCopy - receives the text either clipboard implementation writes.
 * @param options.activeLocale - the locale the context reports as active.
 * @param options.clipboard - whether `navigator.clipboard` exists in the sandbox.
 */
function boot(primitives, onCopy, { activeLocale = 'zh', clipboard = true } = {}) {
  const loaded = []
  const timeouts = []
  const sandbox = {
    console,
    // Recorded, never scheduled: the only sandbox timer is the stand-in banner's
    // hold, and a pending real timer would outlive the assertion.
    setTimeout: (_fn, delay) => {
      timeouts.push(delay)
      return 0
    },
    clearTimeout: () => {},
    navigator: clipboard ? { clipboard: { writeText: async (text) => { onCopy(text) } } } : {},
    window: { __ModuleLoader__: { load: (entry) => loaded.push(entry) } },
  }
  vm.runInNewContext(clientSource, sandbox, { filename: 'client.js' })

  assert.equal(loaded.length, 1, 'client.js must register exactly one module')
  const [entry] = loaded
  assert.equal(entry.id, NS, 'the registered module id must be the package name')
  assert.equal(typeof entry.factory, 'function')

  const react = fakeReact()
  const module = entry.factory((specifier) => {
    if (specifier === 'react') return react
    if (specifier === PRIMITIVES) return primitives
    throw new Error(`client.js required an unexpected module: ${specifier}`)
  })

  const context = createContext(activeLocale)
  module.apply(context.ctx)
  return { module, react, primitives, timeouts, ...context }
}

/** The two entries, named, so each test reads as the contract it checks. */
function entries(state) {
  const menu = state.registrations.find((entry) => entry.options.name === MENU_SLOT)
  const overlay = state.registrations.find((entry) => entry.options.name === OVERLAY_SLOT)
  const header = state.registrations.find((entry) => entry.options.name === HEADER_SLOT)
  assert.ok(menu, `a ${MENU_SLOT} registration exists`)
  assert.ok(overlay, `a ${OVERLAY_SLOT} registration exists`)
  assert.ok(header, `a ${HEADER_SLOT} registration exists`)
  return { menu, overlay, header }
}

/**
 * The props the real renderer would compose for one occurrence: the registration's
 * inject face, plus `t` — but only from the namespace the registration declares.
 */
function entryProps(state, registration, extra = {}) {
  const locale = registration.options.locale
  return {
    ...registration.options.inject(),
    ...(locale === undefined ? {} : { t: state.ctx.locale.bind(locale) }),
    ...extra,
  }
}

/** The element the workspace browser would render for one Session row. */
function rowElement(state, { menu }, sessionId) {
  let menuOpen = true
  const row = menu.component(
    entryProps(state, menu, {
      // Owner props are composed last, as the renderer does.
      sessionId,
      useMenuOpenState: () => [true, (next) => { menuOpen = next }],
    }),
  )
  return { row, isMenuOpen: () => menuOpen }
}

test('the host half exports an apply function', async () => {
  const host = await import(join(root, 'index.js'))
  assert.equal(typeof host.apply, 'function')
})

test('client.js requires nothing that could miss the loader table', () => {
  const requires = [...clientSource.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1])
  assert.deepEqual(
    [...new Set(requires)].sort(),
    [PRIMITIVES, 'react'],
    'both are platform seed modules; any other bare require would throw at materialization',
  )
  assert.match(clientSource, /window\.__ModuleLoader__\.load\(/)
})

for (const hostPrimitives of [true, false]) {
  const label = hostPrimitives ? 'with host primitives' : 'with stand-ins only'

  test(`${label}: registers both entries and copies the Session id`, async () => {
    const copied = []
    const state = boot(
      hostPrimitives ? fakePrimitives({ onCopy: (text) => copied.push(text) }) : {},
      (text) => copied.push(text),
    )
    const { menu, overlay, header } = entries(state)

    // Spread into this realm: arrays built inside the vm have a foreign prototype.
    assert.deepEqual([...state.module.inject], ['slots', 'locale'])
    assert.equal(state.registrations.length, 3, 'the menu row, the header control, and the toast seat')
    assert.equal(menu.options.id, 'dsh-plugin-copy-session-id')
    assert.equal(overlay.options.id, 'dsh-plugin-copy-session-id.toast')
    assert.equal(menu.options.order, 500, 'the row sits after the shipped Archive (400)')
    assert.equal(header.options.id, 'dsh-plugin-copy-session-id.header')
    assert.equal(header.options.order, -5, 'between open-in-app (-10) and the header menu (0)')
    assert.equal(header.options.locale, NS)
    assert.equal(menu.options.locale, NS, 'the row needs the renderer to bind `t`')
    assert.equal(overlay.options.locale, undefined, 'the toast resolves no copy of its own')

    const zh = state.dictionaries.get(NS).zh
    assert.deepEqual(Object.keys(zh).sort(), Object.keys(state.dictionaries.get(NS).en).sort())

    const renderBanner = () => overlay.component(entryProps(state, overlay))
    assert.equal(renderBanner(), null, 'no banner before anything is copied')

    const { row, isMenuOpen } = rowElement(state, { menu }, SESSION_ID)
    assert.equal(textOf(row), zh['menu.copyId'])
    assert.equal(row.props.separatorBefore, true)

    if (hostPrimitives) {
      assert.equal(row.type, state.primitives.MenuItemButton, 'the host atom carries the row')
      assert.notEqual(row.props.icon, undefined, 'the icon seat is filled')
    } else {
      // The regression this guards: a stand-in that silently drops the group
      // hairline or the menuitem role.
      assert.notEqual(row.type, state.primitives.MenuItemButton)
      assert.equal(row.props.icon, undefined, 'no empty icon seat when the atom is missing')
      const skin = render(row)
      const [separator, button] = skin.props.children
      assert.equal(separator.props.role, 'separator', 'separatorBefore is honoured')
      assert.equal(button.type, 'button')
      assert.equal(button.props.role, 'menuitem')
      assert.equal(button.props.children[0], null, 'no empty icon seat in the markup either')
      assert.equal(textOf(button), zh['menu.copyId'])
    }

    row.props.onSelect()
    assert.equal(isMenuOpen(), false, 'the row dismisses the menu before copying')
    await tick()
    assert.deepEqual(copied, [SESSION_ID], 'the clipboard receives the Session id verbatim')

    const banner = renderBanner()
    assert.ok(banner, 'the overlay reports the outcome')
    assert.equal(banner.props.text, zh['toast.copied'])
    assert.equal(banner.props.tone, 'success')
    assert.equal(banner.props.icon, undefined, "success brings the atom's own checkmark")
    assert.equal(banner.key, 1)

    if (!hostPrimitives) {
      // The stand-in banner's own body: placement, the success glyph and its tint,
      // and the atom's hold + fade before it calls `onDone`.
      const skin = render(banner)
      assert.equal(skin.props.role, 'alert')
      assert.equal(skin.props.style.top, 40)
      assert.equal(skin.props.style.zIndex, 1100)
      assert.equal(skin.props.children[0].props.children, '✓')
      assert.match(skin.props.children[0].props.style.color, /state-success-primary/)
      assert.equal(textOf(skin.props.children[1]), zh['toast.copied'])
      assert.ok(state.timeouts.length > 0, 'the banner scheduled its hold')
      assert.ok(state.timeouts.every((delay) => delay === 4000), 'hold 3000 + fade 1000')
    }

    // Copying again restarts the banner instead of inheriting the first hold:
    // the snapshot sequence changes, so the overlay remounts it.
    row.props.onSelect()
    await tick()
    const restarted = renderBanner()
    assert.equal(restarted.key, 2)
    assert.deepEqual(copied, [SESSION_ID, SESSION_ID])

    restarted.props.onDone()
    assert.equal(renderBanner(), null, 'the banner clears itself when it finishes')
  })
}

for (const [description, result] of [
  ['resolves false', false],
  ['rejects', new Error('clipboard denied')],
]) {
  test(`a clipboard that ${description} reports a failure, not a success`, async () => {
    const state = boot(fakePrimitives({ result }), () => {})
    const { menu, overlay } = entries(state)
    const zh = state.dictionaries.get(NS).zh
    const { row } = rowElement(state, { menu }, SESSION_ID)

    row.props.onSelect()
    await tick()

    const banner = overlay.component(entryProps(state, overlay))
    assert.ok(banner, 'a failure must still say something — a silent row is the one bad outcome')
    assert.equal(banner.props.text, zh['toast.failed'])
    assert.equal(banner.props.tone, undefined, 'a failure must not borrow the success checkmark')
    assert.notEqual(banner.props.icon, undefined, 'a failure states itself with the warning glyph')
  })
}

test('the stand-in clipboard reports failure when the Clipboard API is absent', async () => {
  // The stand-in is deliberately narrower than the host helper — no execCommand
  // tail — so this pins what the plugin does in the composition that narrowing
  // exists for: it must still say so, not go silent.
  const state = boot({}, () => {}, { clipboard: false })
  const { menu, overlay } = entries(state)
  const zh = state.dictionaries.get(NS).zh
  const { row } = rowElement(state, { menu }, SESSION_ID)

  row.props.onSelect()
  await tick()

  const banner = overlay.component(entryProps(state, overlay))
  assert.ok(banner, 'a dead clipboard must still report itself')
  assert.equal(banner.props.text, zh['toast.failed'])

  const skin = render(banner)
  assert.equal(skin.props.role, 'alert')
  const seat = skin.props.children[0]
  assert.equal(seat.props.children, '!', 'a failure keeps a glyph of its own in this composition')
  assert.match(seat.props.style.color, /state-warn-label/, 'and the atom\'s own warning tint')
  assert.equal(textOf(skin.props.children[1]), zh['toast.failed'])
})

test('a row still labels itself when the renderer binds no `t`', () => {
  const state = boot(fakePrimitives(), () => {})
  const { menu } = entries(state)
  const row = menu.component({ ...menu.options.inject(), sessionId: SESSION_ID, useMenuOpenState: () => [true, () => {}] })
  assert.equal(textOf(row), 'Copy Session ID', 'the label degrades instead of rendering a raw key')
})

test('the header control copies the opened Session, subagent or not', async () => {
  const copied = []
  const state = boot(fakePrimitives({ onCopy: (text) => copied.push(text) }), (text) => copied.push(text))
  const { header, overlay } = entries(state)

  // Whatever `conversation.session.header` is showing — including a subagent
  // Session, whose sidebar row the host hides — this receives that Session id.
  const subagentSessionId = '4c41ad37-6840-4e4d-a0dc-f8ad13cdbdc5'
  const control = header.component({ ...entryProps(state, header), sessionId: subagentSessionId })

  assert.equal(control.type, state.primitives.Button, 'the host atom carries the control')
  assert.equal(control.props['aria-label'], state.dictionaries.get(NS).zh['header.copyId'])
  assert.equal(control.props.title, state.dictionaries.get(NS).zh['header.copyId'])
  assert.equal(control.props.size, 'sm')

  control.props.onClick()
  await tick()
  assert.deepEqual(copied, [subagentSessionId])
  assert.equal(overlay.component(entryProps(state, overlay)).props.text, state.dictionaries.get(NS).zh['toast.copied'])
})

test('the header control degrades instead of throwing without the host atoms', () => {
  const state = boot({}, () => {})
  const { header } = entries(state)
  const control = header.component({ ...entryProps(state, header), sessionId: SESSION_ID })

  // The stand-in is a component, so it is markup only once rendered.
  assert.notEqual(control.type, state.primitives.Button)
  const rendered = render(control)
  assert.equal(rendered.type, 'button')
  assert.equal(rendered.props.children, '⧉', 'a text glyph stands in for the icon')
  assert.equal(rendered.props.size, undefined, 'the host atom prop is not spread onto the DOM')
  assert.match(rendered.props.style.color, /label-tertiary/)
})

test('a row with no Session id is not offered at all', () => {
  const state = boot(fakePrimitives(), () => {})
  const { menu } = entries(state)
  for (const sessionId of [undefined, '', null, 42]) {
    const { row } = rowElement(state, { menu }, sessionId)
    assert.equal(row, null, `sessionId ${JSON.stringify(sessionId)} renders no row`)
  }
})

test('the toast store notifies its subscribers and keeps its snapshot stable', async () => {
  const state = boot(fakePrimitives(), () => {})
  const { menu, overlay } = entries(state)
  const store = overlay.options.inject().toast

  const seen = []
  const unsubscribe = store.subscribe(() => seen.push(store.getSnapshot()))
  const initial = store.getSnapshot()
  assert.equal(initial, null)
  assert.equal(store.getSnapshot(), initial, 'getSnapshot must not allocate between changes')

  const { row } = rowElement(state, { menu }, SESSION_ID)
  row.props.onSelect()
  await tick()

  assert.equal(seen.length, 1, 'show() must publish to subscribers')
  assert.equal(seen[0].text, state.dictionaries.get(NS).zh['toast.copied'])
  assert.equal(store.getSnapshot(), seen[0], 'getSnapshot stays identity-stable while the message stands')
  assert.notEqual(store.getSnapshot(), initial)

  unsubscribe()
  store.dismiss(seen[0].seq)
  assert.equal(store.getSnapshot(), null)
  assert.equal(seen.length, 1, 'an unsubscribed listener is not notified')
})

test('the overlay entry subscribes with a stable identity across renders', () => {
  const state = boot(fakePrimitives(), () => {})
  const { overlay } = entries(state)
  const store = overlay.options.inject().toast

  overlay.component({ toast: store })
  overlay.component({ toast: store })

  // The count also keeps the identity check below from passing vacuously.
  assert.equal(state.react.subscribes.length, 2, 'the entry reads the store on every render')
  // React requires this: a new subscribe identity each render tears down and
  // rebuilds the subscription, which is the classic resubscribe storm.
  assert.ok(state.react.subscribes.every((subscribe) => subscribe === store.subscribe))
})

test('a hot re-apply does not trip the locale duplicate guard', () => {
  const state = boot(fakePrimitives(), () => {})
  assert.equal(state.effects.length, 4, 'the locale registration plus all three slot injections')
  // Tear the plugin down the way the loader does before re-applying it...
  for (const dispose of state.effects) dispose()
  // ...then apply again, as a hot reload would. Without the locale disposer the
  // real service throws `locale namespace ... already has locale ...` here.
  state.module.apply(state.ctx)
  assert.deepEqual(Object.keys(state.dictionaries.get(NS)).sort(), ['en', 'zh'])
})

test('the dictionaries follow the active locale', () => {
  const state = boot(fakePrimitives(), () => {}, { activeLocale: 'en' })
  const en = state.dictionaries.get(NS).en
  const { row } = rowElement(state, entries(state), SESSION_ID)
  assert.equal(textOf(row), en['menu.copyId'])
})

test('the manifest declares the bundle patch, the client half, and an icon', () => {
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.exports['.'].default, './index.js')
  assert.equal(pkg.exports['./client'].default, './client.js')

  // The enforced compatibility gate reads peerDependencies, not dsh.engines.
  assert.match(pkg.peerDependencies['@deepseek-ai/dsh'], /^>=0\.2\.0-rc\.1 <0\.3\.0-0$/)
  assert.equal(pkg.private, undefined, 'a publishable package must not be private')

  for (const relative of ['cordis.patch.yml', 'assets/icon.svg', 'index.js', 'client.js']) {
    readFileSync(join(root, relative))
  }
  for (const language of ['en', 'zh']) {
    const meta = JSON.parse(readFileSync(join(root, 'locale', `${language}.json`), 'utf8'))
    assert.equal(typeof meta.meta.title, 'string')
    assert.equal(typeof meta.meta.description, 'string')
  }

  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /^-\s+insert:/m, 'the patch inserts at least one row')
  assert.match(patch, new RegExp(`name:\\s*'?${pkg.name}'?`), 'the row mounts this package')
  assert.match(patch, /^\s*-\s*id:\s*copy-session-id\s*$/m, 'the row id is exact')
})

/**
 * Copy Session ID — host half.
 *
 * Pure UI plugin: the empty `apply` exists so the plugin has a real Host row in
 * the composed cordis.yml / Loader; the browser half ships via `exports["./client"]`
 * and is discovered through the package's `dsh.client` declaration. Nothing is
 * ever sent back to the Host — the Session id is already in the DOM-side props the
 * workspace browser passes to the menu row, so the copy is a pure browser action.
 *
 * @module dsh-plugin-copy-session-id
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply() {}

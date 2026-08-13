/**
 * Minimal in-page stand-in for the Tauri IPC layer.
 *
 * The shapes below must match what @tauri-apps/plugin-store expects:
 * `load` returns a resource id, and `get` returns a `[value, exists]` tuple.
 */
export const TAURI_MOCK_SCRIPT = `
  const tauriStore = {};
  const STORE_RID = 1;

  window.__TAURI_INTERNALS__ = {
    invoke: async function(cmd, args) {
      switch (cmd) {
        case 'plugin:store|load':
        case 'plugin:store|get_store':
          return STORE_RID;
        case 'plugin:store|get': {
          const key = args?.key;
          return [tauriStore[key] ?? null, Object.prototype.hasOwnProperty.call(tauriStore, key)];
        }
        case 'plugin:store|set':
          tauriStore[args?.key] = args?.value;
          return null;
        case 'plugin:store|has':
          return Object.prototype.hasOwnProperty.call(tauriStore, args?.key);
        case 'plugin:store|delete': {
          const existed = Object.prototype.hasOwnProperty.call(tauriStore, args?.key);
          delete tauriStore[args?.key];
          return existed;
        }
        case 'plugin:store|clear':
        case 'plugin:store|reset':
          for (const key of Object.keys(tauriStore)) delete tauriStore[key];
          return null;
        case 'plugin:store|keys':
          return Object.keys(tauriStore);
        case 'plugin:store|values':
          return Object.values(tauriStore);
        case 'plugin:store|entries':
          return Object.entries(tauriStore);
        case 'plugin:store|length':
          return Object.keys(tauriStore).length;
        case 'plugin:store|save':
        case 'plugin:store|reload':
        case 'plugin:resources|close':
        case 'plugin:shell|open':
          return null;
        default:
          return null;
      }
    },
    transformCallback: function(_callback, _once) {
      return Math.floor(Math.random() * 2147483647);
    },
    metadata: {
      currentWindow: { label: 'main' },
      windows: [{ label: 'main' }],
    },
  };
`

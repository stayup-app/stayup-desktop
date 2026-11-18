/**
 * True on Linux desktops (WebKitGTK reports "X11; Linux ..." / "Wayland; Linux ...").
 * There the native GTK menu is drawn by the system theme (rounded corners, border) and
 * cannot be styled, so the app renders its own menu bar instead.
 */
export function usesCustomMenuBar(): boolean {
  return /\bLinux\b/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent)
}

// The admin shell's scrollable content pane. The window itself never scrolls
// inside the shell (h-screen, with overflow-y-auto on <main>), so anything
// that needs to scroll or mark the content — the drawer's inert toggle,
// pagination's return-to-top — must reach this pane. Everyone goes through
// this module so the id can't silently drift out from under a caller: a
// rename here renames it everywhere, including the element itself.
export const ADMIN_MAIN_ID = "admin-main";

export function adminMain(): HTMLElement | null {
  return document.getElementById(ADMIN_MAIN_ID);
}

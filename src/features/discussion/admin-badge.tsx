// The "Admin" mark beside a badged posting name (issues #299, #301) — shown
// only while the name's account is still an admin, which the server decides.
export function AdminBadge() {
  return (
    <span className="bg-accent text-paper rounded-full px-2 py-px font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">
      Admin
    </span>
  );
}

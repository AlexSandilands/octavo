# Digital Magazine — Rough Spec

A simple, members-only digital magazine for a nationwide club (~1,000 members, growing).
The club admin publishes regular issues — mostly text and images — that read like a
magazine. Built to later support sponsors and advertising.

Audience skews older, reads heavily on phones. Simplicity and readability beat features.

---

## 1. Goals & principles

- **Stupid simple to author.** A non-technical admin adds text and photos and it looks good with zero fiddling.
- **Reads like a magazine.** Page-flip experience on desktop; clean vertical scroll on phones.
- **Members-only, but frictionless.** No passwords, no Google login. Email a link, click, you're in.
- **Sleek and modern, not generic.** Considered typography and spacing; not "AI slop" template look.
- **Fully self-service operations.** The admin runs the entire magazine — publishing, members,
  sponsors, themes — without ever touching code or contacting the developer. Hard requirement.
- **Minimal landlord burden.** The developer owns only the infrastructure (see §13) and should
  rarely need to touch it. Favour boring, managed, low-maintenance choices over clever ones.

---

## 2. Users & access

Two roles, one auth system:

- **Member** — can read issues. Identified by email on a club member list.
- **Admin** — same login, plus an `isAdmin` flag that reveals the editor. (Admin is just a flagged member.)

**Authentication: per-member magic link.**

- Member enters their email → receives a one-click sign-in link → clicking it signs them in.
- **The new-issue email IS the magic link.** When an issue is published, every member gets an email
  containing their personal sign-in link straight to the new issue. No separate "log in" step.
- Expired links don't error out — clicking one silently emails a fresh link.
- Admin maintains the member list: paste/CSV import, add/remove individually.
- Unsubscribe link + bounce handling required (legal + hygiene at ~1,000 emails/issue).

Members-only and sponsors coexist fine — it's the print-newsletter model: sponsors pay for
guaranteed reach to a defined club audience, not open-web visibility.

---

## 3. Core concepts

- **Issue** — one edition of the magazine (e.g. "Summer Newsletter, issue #14"). Has a status: draft → published.
- **Page** — issues are an ordered stack of fixed-aspect pages. The admin decides page splits while editing.
- **Block** — the unit of content on a page. Ordered list. Types:
  - `heading`
  - `text`
  - `image` (with optional caption)
  - `sponsor` (image + link, optional "active until" date)
  - _(future: quote, divider, gallery, video)_

**Source of truth = blocks JSON.** An issue is stored as structured data (pages → blocks).
Everything else (HTML view, PDF) is _derived_ from it. This keeps issues editable forever,
enables mobile reflow, and lets us auto-insert sponsors later.

---

## 4. Admin experience (the editor)

Page-based, block-based, deliberately minimal.

- **Left rail:** the stack of pages as thumbnails. Click to edit. "Add page" button.
- **Insert toolbar:** add Heading / Text / Image / Sponsor block.
- **Page canvas:** fixed-aspect page showing the blocks in order.
  - Each block has a drag handle to reorder, and up / down / delete controls when selected.
  - The theme controls how blocks _look_ — no manual fonts, colours, or positioning in v1.
- **Top bar:** issue title, theme dropdown, Preview, Publish.
- **Image blocks** run uploads through the WebP pipeline silently — admin just sees the photo.
- **Publish** freezes the issue and triggers the member email blast.

Guardrail: auto-arranged single column only in v1. Free positioning / multi-column / custom
styling are deferred — that's where "made it look messy" risk lives.

---

## 5. Member experience (viewing)

Same blocks JSON, two presentations.

**Desktop / tablet — flipbook.**

- Real HTML pages flipped with a page-flip library (StPageFlip HTML mode). Crisp, selectable,
  accessible text; clickable sponsor links. No PDF, no rasterizing in the viewing path.
- **Left sidebar: heading navigation.** Auto-built from the issue's `heading` blocks (like a table
  of contents). Click a heading → jump/flip to that page. Makes a long issue easy to navigate.
- **Hover control bar.** A slim control bar that fades in on hover (and on tap on touch devices),
  then fades away to keep the reading view clean. Controls: prev/next page, page indicator
  (e.g. "4 / 12"), zoom/fit, contents toggle, download, reader-mode toggle.
- First spread paints fast; neighbouring pages prefetch so flips feel instant.

**Mobile — reader mode.**

- The same blocks rendered as one flowing vertical column. No page-flip (bad on small screens).
- Large default type, high contrast, generous spacing, big tap targets — built for older eyes.
- This is also the accessibility fallback on any device (reader-mode toggle in the control bar).

**Visual direction:** sleek, modern, editorial. Restrained palette, real typographic hierarchy,
generous whitespace. Avoid the generic dashboard/"AI template" look.

---

## 6. Media pipeline

- On image upload: server converts to **WebP**, compressed, at a couple of sizes, stored on object storage.
- Blocks reference the stored image (not the bytes).
- Keeps issues small (a typical issue ≈ 2–4 MB of images) and pages fast.

---

## 7. Publishing, archive & export

- **Publish** marks the issue live and sends the email blast.
- **PDF is generated on demand only** — when a member or admin clicks "Download," the same HTML
  is rendered to PDF (Playwright) and can be cached for repeat downloads.
- **Archive:** keep all issues (storage is negligible). Show the latest few prominently with an
  "Archive" section for older ones. The download-PDF doubles as backup / re-upload artifact.

---

## 8. Sponsors & advertising (future, designed-for now)

- `sponsor` is a first-class block type from day one, so ads are just content the admin places.
- Later: sponsor management (logos, links, active dates), auto-insertion into issues, and basic
  view/click stats.

---

## 9. Tech & hosting

- **Framework:** Next.js (App Router) — UI + API in one deploy.
- **Hosting:** Railway (app + Postgres).
- **Database:** Postgres — members, issues, pages, blocks.
- **Object storage:** Cloudflare R2 (images + on-demand PDFs) — zero egress fees, CDN-friendly.
  Keeps reader traffic off Railway's metered bandwidth.
- **Auth:** magic links (Auth.js email provider or equivalent).
- **Email:** Resend / Postmark (~1,000 emails per issue — budget a small monthly cost).
- **Images:** `sharp` (→ WebP).
- **Flipbook:** StPageFlip (HTML mode).
- **PDF export:** Playwright (HTML → PDF), on demand.
- **Editor:** Tiptap / Editor.js for block editing.

---

## 10. Data model (sketch)

- `members` — id, email, name, is_admin, subscribed, created_at
- `issues` — id, number, title, theme, status (draft/published), published_at
- `pages` — id, issue_id, order
- `blocks` — id, page_id, order, type, payload (JSONB)
  - (alternatively: store an issue's full pages→blocks tree as one JSONB column for simplicity)
- `images` — id, key (R2), width/height, issue_id

---

## 11. Roadmap

- **Phase 1 (walking skeleton):** magic-link sign-in; one issue with text + image blocks;
  WebP upload; page-based editor; desktop flipbook + mobile reader; "email this issue" button.
- **Phase 2:** themes; heading sidebar + hover control bar polish; archive section; PDF download.
- **Phase 3:** sponsor management + auto-insertion; basic analytics.
- **Phase 4 (only if asked):** free positioning / multi-column / custom styling.

---

## 13. Operations & ownership

Split into two roles so the developer can step back after launch:

- **Club (self-service, no developer needed):** publishing issues, managing the member list,
  managing sponsors, choosing themes. All in the admin UI.
- **Developer = minimal "landlord" (infrastructure only):** owns the Railway, domain, and email
  provider accounts; handles the rare breakage and dependency/security update. Not involved in
  day-to-day content.

To keep the landlord role genuinely small:

- **Managed everything.** Railway-managed Postgres, R2 (no servers), a reputable email provider
  (Resend/Postmark) — minimise things that can rot.
- **Email deliverability set up once, properly.** SPF, DKIM, DMARC on the sending domain so
  1,000-recipient blasts don't land in spam (the most likely real-world headache).
- **Uptime + error monitoring** with alerts to the developer, so problems are caught before the
  club calls. Auto-renew the domain; put billing on a card that won't lapse.
- **Robust, forgiving admin UI** — clear empty states, confirmations, and "undo", so the
  non-technical admin can't easily break things or get stuck.
- Consider a small annual arrangement with the club to cover hosting/email costs + the
  developer's occasional time.

---

## 14. Open questions

- Who actually edits — the club's older admin, or you/your partner? (Affects how much hand-holding the editor needs.)
- Public landing page at all (for sponsor visibility / recruiting members), or fully gated?
- How are members onboarded initially — does the admin have the email list already?
- Branding: club name, logo, colours, any existing print style to match?

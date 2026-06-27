# Design handover — digital club magazine

## What this is
A members-only digital magazine for a nationwide social club (~1,000 members, growing). A club
admin publishes regular issues — mostly text and photos — that read like a real magazine. The
product will later carry sponsors/advertising. Please design a coherent, high-fidelity UI system
covering the surfaces below.

## Who uses it
- **Readers (members):** audience skews **older** and reads heavily on **phones**. Legibility,
  large tap targets, obvious primary actions, and zero jargon are essential. Assume some users are
  not confident with technology.
- **Admin:** one non-technical person who runs the whole magazine self-service (publishing,
  members, sponsors). The admin UI must feel calm and forgiving, not like a developer tool.

## Visual direction (important — read carefully)
Aim for **sleek, modern, editorial** — the feel of a well-designed print magazine, not a SaaS
dashboard. Specifically:
- Strong **typographic hierarchy**: consider an elegant serif/display face for magazine mastheads
  and covers, paired with a clean, highly legible sans for UI and body. Real scale contrast.
- **Restrained palette**: mostly neutral/paper tones with a single confident accent. Design a
  sophisticated neutral base that a club's **brand colour can slot into** (see Theming).
- **Generous whitespace**, a real grid, subtle hairline borders. Depth via spacing and type, not
  heavy drop shadows.
- Confident, minimal chrome. Editorial references to aim for: Monocle, Kinfolk, NYT, Are.na.

**Avoid the generic "AI-generated" look:** no purple/indigo gradient heroes, no glassmorphism, no
emoji as icons, no sparkle motifs, no centred-blob landing pages, no uniform shadowed card grids,
no decorative gradients. Every element should look intentional and earned.

Light mode only. Use crisp, consistent line icons.

---

## Surfaces to design

### A. Reader / member-facing

1. **Sign-in (magic link).** Three states:
   - Enter your email.
   - "Check your inbox" confirmation.
   - "That link expired — we've sent you a fresh one."
   Warm, reassuring, dead simple. This is the first impression for non-technical users.

2. **New-issue notification email.** The real front door — most members see this most often. Club
   branding, the issue title + cover thumbnail, a short intro line, and one big obvious
   "Read this issue" button (which is the personal sign-in link). Must read well at a glance and on
   a phone.

3. **Issue library / archive.** Where a member lands after signing in. The latest issue featured
   prominently; older issues in a clean archive shelf below. Each issue shows cover, title, issue
   number, date.

4. **Issue cover page.** The front page of an issue — title, issue number, date, hero image, club
   masthead. Sets the "this is a real magazine" tone before the first page turn.

5. **Reading view — desktop/tablet (flipbook).** Pages presented as a magazine spread with a
   page-turn feel. Includes:
   - **Heading sidebar (left):** an auto-generated table of contents built from the issue's
     headings; click a heading to jump to that page. Show collapsed and expanded states.
   - **Hover control bar:** a slim bar that fades in on hover and fades away to keep the reading
     view clean. Controls: previous/next page, page indicator (e.g. "4 / 12"), zoom/fit, contents
     toggle, **text-size (A− / A+)**, download, and a reader-mode toggle. Design its idle (hidden)
     and active states, **and the tap-to-reveal equivalent for touch devices** (hover doesn't exist
     on phones).

6. **Reading view — mobile (reader mode).** The same content as one **flowing vertical column** —
   no page-flip. Large default type, high contrast, generous spacing, big tap targets. Heading
   navigation as a slide-in drawer. A visible text-size control. This is also the accessibility
   fallback on any device.

7. **System states:** flipbook loading skeleton; "preparing your PDF…"; a friendly 404 / "you're
   not a member yet" page.

### B. Admin-facing

8. **Admin home / dashboard.** A list of issues with draft/published status, a prominent "create
   new issue", and navigation to Members and Sponsors. Calm and uncluttered.

9. **Page-based editor.** The core authoring screen:
   - **Left rail:** the issue's pages as thumbnails; click to edit; "add page".
   - **Insert toolbar:** add Heading / Text / Image / Sponsor block.
   - **Page canvas:** a fixed-aspect page showing blocks in order. Each block has a drag handle to
     reorder and select/move-up/move-down/delete controls. The theme controls appearance — no
     manual fonts/colours/positioning. Single auto-arranged column only.
   - **Top bar:** issue title, theme dropdown, Preview, Publish.
   - **Image block:** drag-and-drop upload zone with upload progress.

10. **Members management.** The member list with search; CSV import; add/remove individual members;
    and visible per-member status (subscribed / unsubscribed / bounced). This is what lets the admin
    run things without a developer.

11. **Publish confirmation flow.** A clear modal before sending: "You're about to publish issue #N
    and email it to ~1,000 members." Include a preview/summary and an unmistakable confirm. This
    action is scary and near-irreversible — make it reassuring.

12. **Sponsor management (placeholder).** A simple stubbed screen showing where sponsors (logo,
    link, active dates) will be managed later — enough that the layout anticipates it. Low fidelity
    is fine.

13. **Empty / first-run states.** No issues yet; no members yet; an empty page in the editor. These
    are literally the first things the admin sees on day one — they must look intentional and
    guide the next action, never look broken.

---

## Components & systems to define

- **Block treatments across 2 themes** ("Classic" and "Modern"): show how Heading, Text,
  Image + caption, and Sponsor blocks each render in both themes, so the theming system is visible.
- **Heading sidebar / TOC:** desktop expanded + collapsed, mobile drawer.
- **Hover control bar:** idle vs active; touch (tap-to-reveal) variant.
- **Accessibility controls:** text-size (A− / A+) and high-contrast-friendly defaults in the reader.
- **Image upload affordance:** drop zone + progress.
- **Branding slots:** where the club logo and a brand accent colour live, so the magazine reads as
  *theirs*, not generic.

## Responsive
Design three explicit modes, not one view shrunk down:
- **Desktop:** flipbook with heading sidebar + hover control bar.
- **Tablet:** flipbook, adapted controls.
- **Mobile:** vertical reader with drawer TOC.

## Explicitly out of scope (do not design)
Free drag-anywhere positioning, multi-column layouts, dark mode, and search. Keep these out so the
v1 stays simple.

## Deliverable
High-fidelity mockups of each surface above, unified by a single design system (type scale,
colour, spacing, icon set, component library). Show the magazine reading view in **both themes**.
Prioritise, in order: the reading view (desktop + mobile), the editor, the new-issue email, and the
sign-in flow.

# Design principles & engineering best practices

The standards every change in this project follows. Optimised for a small, maintainable
Next.js app that one developer can keep alive long-term (see the "landlord" model in
`INFRASTRUCTURE.md`). Bias toward boring, obvious, and simple over clever.

---

## 1. File & code size

- **Keep files under 500 lines.** If a file approaches it, split by responsibility.
- **Components under ~150 lines.** A component that does too much is two components.
- **Functions short and single-purpose.** If you need "and" to describe it, split it.
- One primary export per file. Colocate small helpers; promote shared ones to `lib/`.
- Prefer many small, named modules over a few large grab-bags.

## 2. Project structure

```
src/
  app/          route segments, layouts, pages (App Router)
  components/   reusable UI (presentational, mostly client)
  features/     feature-scoped modules (editor, reader, members, ...)
  db/           drizzle schema + client
  lib/          framework-agnostic helpers (env, ids, r2, email, pdf)
  server/       server-only logic: data access, actions, auth
```

- **Colocate** by feature, not by type, once a feature grows. Keep route files thin —
  they wire together logic that lives in `features/` and `server/`.
- Use the `@/*` path alias; no deep `../../../` imports.
- Never import server-only modules (`db`, `env`, secrets) into client components.

## 3. Server vs client components

- **Server Components are the default.** Add `"use client"` only for interactivity
  (state, effects, event handlers, browser APIs).
- Push `"use client"` to the leaves — keep pages/layouts as server components and make
  small interactive islands client.
- Fetch data in server components or server actions, close to where it's used. Do not
  build client-side fetching waterfalls for data the server can render.
- Use **Server Actions** for mutations; validate input with zod inside the action.

## 4. Data & database

- All DB access goes through `server/` data-access functions — **never query from a
  component or a client.** Components call typed functions, not Drizzle directly.
- Validate every external input (form data, route params, JSON bodies) with **zod** at
  the boundary. Trust nothing from the client.
- The blocks JSON is the source of truth; treat derived artifacts (HTML, PDF) as
  disposable. Keep block `payload` shapes defined as zod schemas in one place.
- Use transactions for multi-row writes (e.g. reordering pages/blocks).

## 5. TypeScript

- `strict` is on, plus `noUncheckedIndexedAccess`. Respect it — fix types, don't `any`.
- No `any`. Use `unknown` + a zod parse at boundaries, or precise types.
- Derive types from the source of truth (Drizzle inferred types, zod `infer`) rather
  than hand-writing duplicates.

## 6. Styling

- Tailwind v4. Use the design tokens in `globals.css` (`--color-*`, `--font-*`) — no
  hardcoded hex or magic numbers scattered through components.
- Respect the editorial visual direction in `DESIGN_HANDOVER.md`: restrained palette,
  strong type hierarchy, generous whitespace, hairline borders, no gradient/glass slop.
- Extract repeated class strings into small components, not copy-paste.

## 7. Accessibility (first-class — the audience is older and phone-heavy)

- Semantic HTML first (`<button>`, `<nav>`, `<main>`, headings in order). ARIA only to
  fill gaps.
- Visible focus states; full keyboard operability for every interactive control.
- Large tap targets (min ~44px), generous default font size, high contrast (WCAG AA).
- Provide the reader-mode/text-size affordances specced for the magazine view.
- Test the core flows with keyboard and a screen reader before calling them done.

## 8. Performance

- Use `next/image` for all images; serve compressed WebP from R2; lazy-load offscreen
  pages and prefetch neighbours in the flipbook.
- Keep client bundles small — heavy libs (flipbook, editor, Playwright) stay out of
  shared/client paths where possible. PDF generation is server-only.
- Cache derived artifacts (the generated PDF) rather than regenerating per request.

## 9. Security & config

- Secrets only on the server. Access env through `lib/env.ts` (validated once); never
  reference `process.env` ad hoc, and never in client code.
- Enforce auth on every admin route and mutation server-side — never rely on hidden UI.
- Scope R2 access with least privilege; serve uploads through a controlled pipeline.

## 10. Errors, loading & resilience

- Use route-level `loading.tsx` and `error.tsx`; design real empty/first-run states
  (the admin sees these on day one).
- Fail gracefully and legibly — never a raw stack trace to a member. Log to monitoring.
- Make destructive/irreversible actions (publish, delete, email blast) explicit and
  confirmable.

## 11. Consistency & hygiene

- Run `lint` and `format` before considering work done; keep the tree clean.
- Match surrounding style; don't introduce a second way to do something already solved.
- Small, focused commits. Update the relevant doc when behaviour or setup changes.
- Write code that reads like the rest of the codebase — naming, structure, idioms.

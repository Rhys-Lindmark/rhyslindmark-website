# Working in this repo alongside another agent

More than one coding agent works on this repo, often at the same time, and both
push to `main`. Claude Code and Codex have each been given work here. Treat every
file as something another agent may have edited since you last looked.

## The rule that matters most

**Never write a file from a copy you are holding in memory. Re-read it from disk
immediately before you edit, and change only the lines you mean to change.**

This is not a style preference. On 2026-09-16 a run of work was lost this way:
two commits rewrote `public/posts/ai2026-pt1/index.html`, `style.css` and
`lede.js` wholesale from an older copy of those files. The files were valid and
the commits looked clean, but they silently reverted a slide renumbering, a lede
rewrite, a chapter-card rename and about eight separate copy edits that were
already live. Nothing conflicted, because a full-file overwrite never conflicts.
It took a file-by-file audit to find and restore the lost work.

If you are about to emit the entire contents of an existing file, stop. Use a
targeted edit instead. Full-file writes are for files you are creating.

## Before you start

```bash
git fetch origin && git log --oneline HEAD..origin/main
```

If anything comes back, rebase or merge before you touch a file. Do not begin
editing on top of a stale tree.

## Before you commit

```bash
git fetch origin && git log --oneline HEAD..origin/main
```

If the other agent pushed while you were working, **read their diff before you
resolve anything**:

```bash
git diff HEAD...origin/main -- <files you touched>
```

Keep their work. If a merge auto-resolves in your favour, that is not proof you
were right; check that their changes are still present afterwards. Re-apply
anything of theirs the merge dropped, and say so in the commit message.

## Push discipline

- Small, single-purpose commits. They survive a collision; large ones do not.
- Push promptly. Unpushed work is invisible to the other agent.
- Never `push --force` to `main`.
- If a push is rejected, `fetch` and look at what landed before rebasing. Do not
  reflexively rebase and re-push.

## This article

The AI 2026 piece is three scrollytelling pages — `public/posts/ai2026-pt1/`,
`-pt2/` and `-pt3/` — with tight coupling that is easy to break from one side.

### Shared across all three parts

- **`ai2026-pt1/intro/building-intro.js` is loaded by all three pages.** It lives
  under part 1's directory, but part 2 and part 3 link to it too. A change there
  ships to every part at once. Check all three before you call it done.
- **That component has two modes.** Without `preview` it is the page-top intro:
  ordinary scroll, building at natural size, two chapter-title cards below it.
  With `preview` (plus `external-camera`) it is an inert canvas whose camera
  `chart.js` drives itself — that is part 1's closing building-return scene at
  slides 51–52. Scope new intro CSS with `:host(:not([preview]))` or you will
  break the closing scene, which shares the same shadow tree.
- **Per-part copy goes in attributes, not the component.** `title-one` /
  `title-two` set the two title cards; the defaults are part 1's wording. Before
  those attributes existed, all three parts rendered "Part I: Chips in a data
  center". `image-src` picks the building; all three use
  `intro/building-clean-roof.webp`.
- **Scripts and stylesheets are cache-busted by hand** with `?v=…` in each
  page's `<head>`. The three pages drift apart easily — they were on
  `?v=external-camera-1`, `?v=country-focus` and `?v=agents-floor` at once. When
  you change a shared file, bump the query on *every* page that links it, or
  some parts ship the change and others do not.
- **`?slide=…` links are public on all three parts.** Renumbering or renaming
  breaks any that have been shared.
- The apex domain strips the query string on its redirect to `www`, so
  `rhyslindmark.com/...?slide=12` loses the slide. That is a Cloudflare dashboard
  rule, not something in this repo.

### Each part has its own scroll driver

They do not share one. Part 1 uses `ai2026-pt1/chart.js`, part 2
`ai2026-pt2/chart.js`, part 3 `ai2026-pt3/scroll.js`. A fix in one is not a fix
in the others.

### Slide addressing differs per part

- **Part 1 — numeric.** Slides are addressed by `data-passage`, not DOM
  position. They run `1`–`52` in reading order, with the lede at `0`. If you
  insert a slide, renumber so the sequence stays in order, and move
  `data-passage`, `data-step`, `data-steps` and the section `id` together.
- **Part 2 — mixed.** Numeric ids `1`–`18` for the opening scenes, then semantic
  ones (`noam-brown`, `spiky-intelligence`, `longer-tasks`, `china-frontier`,
  `token-share`). `data-steps` carries both kinds.
- **Part 3 — semantic only.** Ids like `coding`, `robotics`, `white-collar`, and
  slides marked with `data-slide` rather than the numeric scheme.

### Both chart.js files hardcode slide ids

Part 1's revenue scene looks up `[data-passage="6"]` and `[data-passage="7"]` by
hand and special-cases `id==='7'` in two places; part 2 special-cases `id==='18'`
and `id==='sources'`. Renaming or renumbering the HTML without updating these
throws `Cannot set properties of null (setting 'hidden')` on every frame.

## Images

Neither agent should hand-author illustration as SVG path data. It does not come
out well. The artwork here came from an image model — see
`public/posts/ai2026-pt1/intro/building-mobile-prompt.txt` for the prompt that
produced the building. If a drawing is needed and you cannot generate images, ask
rather than drawing it by hand.

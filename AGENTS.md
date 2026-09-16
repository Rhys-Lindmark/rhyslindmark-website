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

`public/posts/ai2026-pt1/` is a scrollytelling piece with tight coupling that is
easy to break from one side:

- **Slides are addressed by `data-passage`, not DOM position.** They currently
  run `1`–`50` in reading order, with the lede at `0`. If you insert a slide,
  renumber so the sequence stays in order, and move `data-passage`, `data-step`,
  `data-steps` and the section `id` together.
- **`chart.js` hardcodes some slide ids.** The revenue scene looks up
  `[data-passage="6"]` and `[data-passage="7"]` by hand, and special-cases
  `id==='7'` in two places. Renumbering the HTML without updating these throws
  `Cannot set properties of null (setting 'hidden')` on every frame.
- **`?slide=N` links are public.** Renumbering breaks any that have been shared.
- The apex domain strips the query string on its redirect to `www`, so
  `rhyslindmark.com/...?slide=12` loses the slide. That is a Cloudflare dashboard
  rule, not something in this repo.

## Images

Neither agent should hand-author illustration as SVG path data. It does not come
out well. The artwork here came from an image model — see
`public/posts/ai2026-pt1/intro/building-mobile-prompt.txt` for the prompt that
produced the building. If a drawing is needed and you cannot generate images, ask
rather than drawing it by hand.

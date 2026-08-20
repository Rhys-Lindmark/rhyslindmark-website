# rhyslindmark.com

Source for [rhyslindmark.com](https://rhyslindmark.com), built with [Astro](https://astro.build) and deployed on Cloudflare Pages.

## Structure

```
src/
├── pages/            # routes (index, date-me, us, work-with-me, music-for-18-pianos, marriage-counseling-with-capitalism)
├── layouts/           # shared page layout
├── assets/images/     # page imagery
└── styles/            # global styles
functions/
└── _middleware.js     # Cloudflare Pages function: 404s fall back to Substack
public/                # static assets served as-is (e.g. resume.pdf)
*.md                   # long-form source content pulled into pages (about-me, date-me, us, work-with-me, etc.)
```

Several top-level `*.md` files (`about-me-source.md`, `date-me-source.md`, `us-book-source.md`, `work-with-me.md`, `music-for-18-pianos-source.md`) hold the long-form writing rendered on their respective pages via `marked`.

## Development

```sh
npm install
npm run dev       # localhost:4321
```

| Command           | Action                                      |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Start local dev server                       |
| `npm run build`   | Build production site to `./dist/`           |
| `npm run preview` | Preview the production build locally         |
| `npm run astro`   | Run any Astro CLI command                    |

## Deployment

Deployed via Cloudflare Pages (`wrangler.toml`). The `functions/_middleware.js` function redirects any unmatched route to the corresponding post on [rhyslindmark.substack.com](https://rhyslindmark.substack.com), as a fallback for content migrated from Ghost.

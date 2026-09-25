# HMGF UGM Astro

Astro Static/Hybrid zero-browser-JavaScript migration for Cloudflare Pages.

## Struktur

```text
astro-app/
  src/layouts/Base.astro
  src/lib/data.ts                 # server-only-style data loader and Published filter
  src/middleware.ts               # strict CSP/security headers
  src/pages/index.astro           # GET search, source filter, pagination
  src/pages/news/[slug].astro      # dynamic news routing and server KaTeX
  src/pages/api/chat.ts            # POST proxy to n8n
  src/pages/api/comments.ts        # POST Turnstile + SteinHQ proxy
  public/styles.css                # static CSS only
  wrangler.toml
  .env.example
```

## Environment

Set `GOOGLE_SHEET_ID`, `BASE_STEIN_URL`, `N8N_WEBHOOK_URL`, `TURNSTILE_SITE_KEY`, and `TURNSTILE_SECRET_KEY` in Cloudflare. The SteinHQ and n8n values must be Worker secrets:

```bash
wrangler pages secret put BASE_STEIN_URL
wrangler pages secret put N8N_WEBHOOK_URL
wrangler pages secret put TURNSTILE_SECRET_KEY
```

Build command: `npm run pages:build`; output directory: `dist`.

## Zero-JS constraint

No `<script>` tags, client hydration, or JavaScript bundles are emitted by this project. Search, source filtering, pagination, article routing, chat, and comments use ordinary HTTP forms and server endpoints. KaTeX renders math into HTML on the server.

The official Cloudflare Turnstile browser widget requires JavaScript to create its token. Therefore a truly zero-JS browser cannot display the widget. The comment endpoint is implemented and verifies `cf-turnstile-response`; connect a token-producing upstream/form gateway or relax the CSP/zero-JS requirement to embed the official Turnstile widget.

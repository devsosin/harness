# SEO and AEO (answer-engine optimization)

Applies to public pages only. Login-only apps: `noindex` on app routes, `Disallow` the app/admin/API paths in `robots.txt`, and nothing else here.

Based on official docs (Google Search Central, Bing, OpenAI, Perplexity, Anthropic, IndexNow) as of 2026-11. Marked *(unconfirmed)* where no official source was found — recheck those before relying on them.

## 1. Rendering — the deciding rule

- Public pages must have their content **in the initial HTML response**: body text, `<title>`, description, canonical, Open Graph, JSON-LD. Google renders JavaScript (with delay), but OAI-SearchBot, PerplexityBot, Claude-SearchBot and Naver's Yeti are not documented to run it *(unconfirmed — assume they don't)*.
- So: public pages → Next.js static (`output: 'export'`) or SSR/ISR; login-only screens → Vite SPA. A few fixed public pages in a SPA → build-time pre-rendering with per-route meta. Google calls dynamic rendering (serving bots different HTML) a workaround, not a solution.
- Don't fill core content (prices, descriptions) only by client-side fetch; whatever is fetched later is invisible to these crawlers.

## 2. Crawlers — `robots.txt`

Search/citation bots and training bots are different user agents. Blocking training bots does not affect citations.

| Company | Search / citation (keep allowed) | User-triggered fetch | Training (may block) |
|---|---|---|---|
| Google | `Googlebot` (also AI Overviews / AI Mode) | — | `Google-Extended` (control token; no effect on Search) |
| Microsoft | `Bingbot` (also Copilot) | — | — |
| OpenAI | `OAI-SearchBot` (blocked → not shown in ChatGPT search answers) | `ChatGPT-User` | `GPTBot` |
| Perplexity | `PerplexityBot` | `Perplexity-User` | — (no training crawler, per their docs) |
| Anthropic | `Claude-SearchBot` | `Claude-User` | `ClaudeBot` |
| Naver | `Yeti` | — | *(unconfirmed)* |

```txt
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://example.com/sitemap.xml
```

- Drop the training blocks if training use is fine. Decide this per project and record it.
- Check the CDN/WAF "block AI bots" setting before launch — it can block the search bots too.
- To keep a page out of results use `noindex` (the page must stay crawlable so the tag is read), not `Disallow`. Google AI features also respect `nosnippet`, `data-nosnippet`, `max-snippet`.

## 3. Registration and sitemaps

- Generate `sitemap.xml` (public canonical URLs only, accurate `lastmod`) and put an absolute `Sitemap:` line in `robots.txt`. Every engine finds it that way.
- At launch, verify ownership and submit the sitemap (all free):
  - **Google Search Console** — not required for indexing, but it is where errors and the generative-AI performance report show up. Verification by DNS TXT, HTML file, or `<meta name="google-site-verification">` in the root layout.
  - **Bing Webmaster Tools** — the Bing index feeds Copilot and is one of ChatGPT search's sources (OpenAI also has its own crawler). Has an "AI Performance" (citations) report.
  - **Naver Search Advisor** — for a Korean audience: verify (HTML file or meta tag), submit sitemap/RSS *(steps from secondary sources)*.
- There is no "submit to ChatGPT/Perplexity/Claude" step: not blocking their search bots is all there is.
- **IndexNow** (Bing, Naver, Yandex, Seznam; not Google): host a key file `/{key}.txt`, and after deploy POST changed URLs to `https://api.indexnow.org/indexnow`. Worth it only for pages that change often. Google relies on sitemap `lastmod`.

## 4. Page content

- Unique `<title>` (~60 chars) and meta description per page; absolute canonical URL; `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card`. Collapse duplicate URLs (query strings, trailing slash, case) into one canonical.
- `<html lang="ko">`, one `h1`, main content in `<main>`/`<article>`, separate from navigation and ads.
- JSON-LD matching visible content: `Organization` + `WebSite` site-wide, `Product` + `Offer` for products, `Article` for articles, `BreadcrumbList`. Structured data is not required for AI features (Google). FAQ and HowTo rich results are no longer shown by Google — FAQPage/HowTo markup is optional; keep Q&A as body text.
- Writing: a question-style subheading, the direct answer in the first 1–2 sentences, then evidence, tables, numbers, dates. Content others don't have (real conditions, prices, experience). Don't mass-produce templated variants of a page.
- `llms.txt` is not needed — Google does not use it and no other engine documents using it. Optional for developer-doc sites only.
- Speed: Core Web Vitals (LCP, INP, CLS); static HTML + CDN is the easy path.

## 5. Measuring

- Google: Search Console generative-AI performance report (impressions by page, country, device).
- Bing / Copilot: Bing Webmaster Tools AI Performance (citations, cited pages, grounding queries).
- ChatGPT: links carry `utm_source=chatgpt.com`; referrer `chatgpt.com`.
- Others: referrers `perplexity.ai`, `claude.ai`, `copilot.microsoft.com`, `gemini.google.com` (apps may drop the referrer). Group these as one "AI answers" channel in analytics.
- Crawl evidence: server/CDN logs by user agent, verified against the published IP lists (`openai.com/searchbot.json`, Perplexity's list).

## 6. Checks before launch

- View source (not DevTools Elements) of each public page type: main text, title, canonical, JSON-LD are there.
- `curl -A "OAI-SearchBot" <url>` (and PerplexityBot, Yeti) → 200 with content, not a login redirect, a JS shell, or a WAF challenge.
- Rich Results Test / schema validator passes.
- `robots.txt` and `sitemap.xml` reachable at the root; consoles verified and sitemap submitted.

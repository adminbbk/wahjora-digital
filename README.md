# WAHJORA Digital — website

A single-file, bilingual (English / Arabic, full RTL) website for a Dubai social media agency.

```
wahjora/
├── index.html      ← the whole site (HTML + CSS + JS). Open it in a browser.
├── api/chat.js     ← optional: Claude-powered "Ask Wahj" (Vercel serverless function)
└── package.json    ← only needed for api/chat.js
```

## Open it

Double-click `index.html`. Everything works offline except fonts and GSAP (loaded from CDN).
"Ask Wahj" uses its built-in assistant when there's no server.

## Pages (hash routes, shareable links)

| Route | Page |
|---|---|
| `#/` | Home: WebGL glow hero, stats, scroll-pinned process, services, work, clients, ROI estimator, FAQ |
| `#/services?s=2` | Services (accordion, opens service 3) |
| `#/pricing` | Packages, monthly/quarterly toggle, comparison table |
| `#/work?ind=realestate` · `#/work/1` | Case studies (filter) · case study pop-up |
| `#/about` | Studio, values, team |
| `#/insights` · `#/insights/2` | Articles list · article |
| `#/contact` | 3-step booking form with call slots |
| `#/ar/...` | Arabic version of any route |

## Before launch — replace the placeholders

All in the first `<script>` block of `index.html`:

- **`CONFIG`**: email, phone, WhatsApp number (digits only, e.g. `9715XXXXXXXX`), social links.
- **`CONFIG.formEndpoint`**: paste a Formspree / Basin / your CRM webhook URL. While it's empty, the form opens an email draft to `CONFIG.email`.
- **`CONFIG.newsletterEndpoint`**: same for the footer newsletter (empty = confirmation only, nothing is stored).
- **Content you must confirm or swap for real data** (currently illustrative):
  - `LOGOS` and `TESTI` — client names and quotes. Use only real clients who have approved it.
  - `STATS` (120+ brands, 4.1M, AED 38, 7 days) and the hero trust badges (Meta / TikTok partner) in `T.en.trust` / `T.ar.trust`.
  - `CASES`, `TEAM`, `POSTS`, `TIERS`, `CMP` — case studies, team, articles, prices.
  - `BENCH` — the ROI estimator's CPM / CTR / conversion benchmarks per industry. Tune to your own campaign data.
- Domain: replace `https://wahjora.ae/` in the `<head>` (canonical, hreflang, Open Graph, JSON-LD).

## Real AI chat (optional)

1. Deploy the `wahjora/` folder to Vercel (`npx vercel` from this folder, or import it in the dashboard).
2. In Vercel → Project → Settings → Environment Variables, add `ANTHROPIC_API_KEY`.
3. Redeploy. The site calls `/api/chat` automatically when served over http(s); if that fails or the key is missing, it falls back to the built-in assistant.

The function uses Claude Opus 5.5 at low effort, with server-side refusal fallback enabled, and caps history at 12 messages / 1,000 characters each. Consider adding rate limiting (e.g. Vercel Firewall rules) before a big launch. Pin `@anthropic-ai/sdk` in `package.json` to the version you deploy with.

## Notes

- Hash routing keeps it a single file. For best Google indexing of each page and the Arabic version, a later step is to pre-render routes into separate HTML files (`/services`, `/ar/services`, ...).
- Respects `prefers-reduced-motion` (shader, marquee, pinning and counters switch off), keyboard navigation, skip link and visible focus rings.
- Size: ~165 KB HTML, no images; WebGL starts after first paint and pauses off-screen.

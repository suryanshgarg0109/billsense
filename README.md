# BillSense ⚡

**Electricity bills, understood in seconds.**

**Live demo:** [billsense-ten.vercel.app](https://billsense-ten.vercel.app) · **Repo:** [github.com/suryanshgarg0109/billsense](https://github.com/suryanshgarg0109/billsense)

BillSense is a working prototype that shows how multimodal AI can eliminate manual bill data entry for finance and operations teams. Upload an electricity bill — a PDF or even a photo — and within seconds you get structured data, an analyst-grade summary, anomaly observations, practical recommendations, and one-click CSV/JSON export.

The emphasis is **document understanding, not OCR**: the AI reasons about tariff structures, demand penalties, power-factor norms, and arrears — it doesn't just read text off the page.

## How it works

1. **Upload** any electricity bill (PDF, PNG, JPEG, WebP — scanned copies work).
2. Gemini analyzes the document against a strict extraction schema: provider, consumer, billing period, meter readings, every charge line itemized and categorized, totals, due dates.
3. The same pass produces **business insights**: unusually high unit cost, demand-charge share, penalties detected, arrears, expiring rebates — each grounded in numbers actually on the bill.
4. Fields the model can't find are reported as *missing*; fields it can't read confidently are *flagged* — uncertainty is communicated, never papered over.
5. Export the structured result as CSV or JSON.

## Try it without a bill

Three synthetic specimen bills are bundled (fictional utilities, realistic layouts):

- **Residential home** — clean slab-tariff bill
- **Commercial office** — arrears, late-payment surcharge, excess-demand penalty
- **Industrial HT unit** — TOD tariff, CT/PT multiplier, power-factor penalty

Regenerate them anytime with `node scripts/generate-samples.js`.

## Stack

- **Next.js 16** (App Router) + **Tailwind CSS 4** — one deployable app, one API route
- **Gemini** (`gemini-3.1-flash-lite` primary, with an automatic fallback chain) via `@google/genai`, structured JSON output, free tier
- No database, no auth, no persistence — files are analyzed in memory and never stored

## Run locally

```bash
git clone <this-repo>
cd billsense
npm install
cp .env.example .env.local   # then paste your key into .env.local
npm run dev
```

Get a free Gemini API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and set it in `.env.local`:

```
GEMINI_API_KEY=your-key-here
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

One-command deploy on Vercel's free tier:

```bash
vercel --prod
```

Add `GEMINI_API_KEY` as an environment variable in the Vercel project settings.

## Project notes

- `app/api/analyze/route.ts` — the single API route: validates the upload, sends it inline to Gemini with a response schema, returns typed JSON.
- `lib/prompt.ts` — the analysis prompt and schema. This is where the product lives: extraction rules, insight severity rubric, and an instruction to treat document text as data (prompt-injection resistance).
- `components/ResultsView.tsx` — results UI: document preview alongside extracted data, charge breakdown with proportion bars, severity-badged observations, confidence footnotes.
- Derived figures (cost per unit) are computed in the client, not by the model, so the AI never does arithmetic it could get wrong.

---

*Built as an interview prototype. Specimen bills are synthetic; no real utility, consumer, or bill data is included.*

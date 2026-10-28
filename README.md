# OAuth Setup Guide Agent

Given an app name or URL, this returns a structured OAuth setup guide with a confidence tag on every claim: `tested`, `verified`, or `reported`. Three guides are pre-generated. Anything else goes through live generation.

## Setup

```bash
npm install
cp .env.example .env   # add your own ANTHROPIC_API_KEY
npm run dev            # serves the API and frontend on :3001
```

Open `http://localhost:3001`. No paid accounts or completed provider approvals are needed to run this.

## What's actually working right now

This is a 3-hour cut of a 6-8 hour scope, built after an earlier pass spent too long on planning documents instead of code. Being direct about what was and wasn't run:

- **Confirmed working in this environment:** `GET /api/guides`, `GET /api/guides/:slug`, the frontend rendering all three library guides with their confidence tags, and `POST /api/generate`'s error paths (missing input returns 400, missing API key returns 500).
- **Not confirmed working in this environment:** the live-generation path's actual call to the Anthropic API. This sandbox has no `ANTHROPIC_API_KEY` available to it, so `researchApp()` is implemented and schema-validated against a library guide shape, but the real web-search-and-generate round trip has not been executed end to end here. Run it yourself with a key to confirm, that's the one claim in this README that needs your own verification, not mine.

## Key decisions

**Cut the browser-automation agent entirely.** The original plan had a Playwright agent actually driving OAuth app registration to earn a `tested` tag. In 3 hours, getting that reliable across even one provider's current UI, with screenshots as evidence, was not a safe bet. Every guide here tops out at `verified`, sourced against the provider's own current docs, which is honestly where this scope lands. That's a real limitation, not a hidden one, it's stated on every guide and in the schema's own comments.

**Three library guides, not more.** GitHub (self-serve, instant), Google (self-serve with a three-track, scope-gated review), LinkedIn (manual, partner-gated, 2-8 weeks reported). These were picked to span the real difficulty axis, not for name recognition, see the confidence tags on each: GitHub and Google's steps are sourced against the providers' own current documentation, LinkedIn's timeline is explicitly `reported` because LinkedIn does not publish one.

**A guide with zero `tested` or `verified` steps fails validation (schema.js, `passesConfidenceFloor`).** It returns a 422 with partial findings rather than rendering as if it were trustworthy. This is the one rule in the whole system I'd defend hardest: a confidence-tagging product that lets an all-`reported` guide through the front door isn't one.

**No database, no auth, no queue.** Flat JSON files for the library, a single synchronous POST for live generation. At this scope a queue only matters if generation needs to outrun an HTTP request, and three sourced guides don't.

## What was checked against real sources

Google's and LinkedIn's guides in `/library` are not invented. Google's three-track verification system (non-sensitive scopes need nothing, sensitive scopes get a 2-3 business day brand verification per Google's own stated estimate, restricted scopes get a security assessment running several weeks with no published number) is sourced directly from `support.google.com/cloud/answer/13463817`. LinkedIn's partner-gating is corroborated across multiple independent sources including Microsoft Learn's hosting of LinkedIn's own API docs, its 2-8 week approval estimate is explicitly tagged `reported` because no official source states it. GitHub's registration steps are sourced against GitHub's own docs; its "no separate production review" line is flagged `[VERIFY]` in the library file itself, because the fetched page didn't explicitly confirm that, it reflects common developer practice rather than stated policy. That distinction, between what a source states and what's merely likely true, is the whole point of the tagging system, so I didn't collapse it here either.

## Limitations

- No `tested` steps anywhere in this build. See "cut the browser-automation agent" above.
- The live-generation path depends entirely on the model's own web search during the request, there's no caching or retry logic beyond the 422 floor check.
- Business or partner-gated providers (LinkedIn, enterprise fintech APIs) cannot be driven end to end without a real company identity, their guides stay at `verified`/`reported` by design.
- No rate limiting, no auth on the API. Fine for a take-home demo, not for anything public.

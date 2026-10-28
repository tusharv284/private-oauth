import Anthropic from "@anthropic-ai/sdk";
import { validateGuide } from "./schema.js";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const SYSTEM_PROMPT = `You are a research agent that investigates how a developer sets up an OAuth app with a given provider, and produces a single JSON object describing that setup process.

Rules you must follow:
1. Use web search to find the provider's OWN current developer documentation first (their developer portal, docs.<provider>.com, or similar). Prefer this over third-party writeups.
2. Every step and every blocker needs a confidence tag:
   - "verified": the sourceUrl points at the provider's own current developer documentation
   - "reported": the sourceUrl points at a forum, blog, or third-party integration guide, because no official source states it
   - "tested": never assign this yourself, you have not run the flow. Leave it to a separate process.
3. Do not invent numbers, durations, or approval rates. If a timeline is not published, say so explicitly in the estimate field (e.g. "no fixed timeline published") rather than guessing a number.
4. If you cannot find the provider's developer documentation at all, set tier to "unknown" and say so in escalationPath, do not fabricate a plausible-sounding process.
5. Output ONLY a single JSON object matching this exact shape, no markdown fences, no commentary before or after:

{
  "appName": string,
  "appUrl": string,
  "tier": "self_serve" | "self_serve_review" | "manual_approval" | "unknown",
  "devAccessEstimate": string,
  "productionEstimate": string,
  "steps": [ { "order": number, "action": string, "confidence": "verified" | "reported", "sourceUrl": string } ],
  "blockers": [ { "description": string, "sourceUrl": string } ],
  "escalationPath": string,
  "sources": [ { "title": string, "url": string, "checkedOn": "YYYY-MM-DD" } ],
  "asOf": "YYYY-MM-DD",
  "generatedBy": "live"
}`;

function extractJson(text) {
  // Model may still wrap in fences despite instructions; strip them defensively.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in model output");
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * Research a single app and return a validated Guide, or a structured
 * failure with whatever partial findings exist. Never throws on a bad
 * or incomplete model response, only on a hard API/network failure.
 */
export async function researchApp(appNameOrUrl) {
  const today = new Date().toISOString().slice(0, 10);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
    messages: [
      {
        role: "user",
        content: `Research OAuth app setup for: ${appNameOrUrl}\nToday's date is ${today}. Use that as "asOf" and in each source's "checkedOn".`,
      },
    ],
  });

  const textBlocks = response.content.filter((b) => b.type === "text").map((b) => b.text);
  const finalText = textBlocks[textBlocks.length - 1] || "";

  let candidate;
  try {
    candidate = extractJson(finalText);
  } catch (err) {
    return {
      ok: false,
      error: { formErrors: [`Model did not return parseable JSON: ${err.message}`], fieldErrors: {} },
      raw: finalText,
    };
  }

  candidate.generatedBy = "live"; // never trust the model on this field
  const result = validateGuide(candidate);
  return result;
}

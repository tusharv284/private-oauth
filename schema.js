import { z } from "zod";

// Confidence tag: how a given fact or step was established.
//   tested   - an agent (or a human following the guide) actually drove the flow and confirmed it
//   verified - confirmed against the provider's own current developer documentation
//   reported - drawn from third-party writeups or forum posts, not independently confirmed
export const Confidence = z.enum(["tested", "verified", "reported"]);

export const StepSchema = z.object({
  order: z.number().int().positive(),
  action: z.string().min(1), // imperative, one sentence
  confidence: Confidence,
  sourceUrl: z.string().url().optional(),
});

export const BlockerSchema = z.object({
  description: z.string().min(1),
  sourceUrl: z.string().url(),
});

export const SourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  checkedOn: z.string(), // ISO date
});

export const GuideSchema = z.object({
  appName: z.string().min(1),
  appUrl: z.string().url(),
  tier: z.enum(["self_serve", "self_serve_review", "manual_approval", "unknown"]),
  devAccessEstimate: z.string().min(1), // e.g. "same day"
  productionEstimate: z.string().min(1), // e.g. "2-3 business days" or "several weeks, unpublished"
  steps: z.array(StepSchema).min(1),
  blockers: z.array(BlockerSchema),
  escalationPath: z.string().min(1),
  sources: z.array(SourceSchema).min(1),
  asOf: z.string(), // ISO date
  generatedBy: z.enum(["library", "live"]),
});

/**
 * The floor: a guide with zero tested or verified steps is not shippable.
 * A guide built entirely from reported sources should fail here and be
 * returned to the caller as a 422 with partial findings, not rendered
 * as if it were trustworthy.
 */
export function passesConfidenceFloor(guide) {
  return guide.steps.some((s) => s.confidence === "tested" || s.confidence === "verified");
}

export function validateGuide(candidate) {
  const parsed = GuideSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.flatten() };
  }
  if (!passesConfidenceFloor(parsed.data)) {
    return {
      ok: false,
      error: { formErrors: ["Guide has zero tested/verified steps, below the confidence floor"], fieldErrors: {} },
      partial: parsed.data,
    };
  }
  return { ok: true, data: parsed.data };
}

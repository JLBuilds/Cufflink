// Ported from Groove's src/lib/anthropic.ts: lazy client so module
// evaluation never depends on secrets at build time. The model is set by
// ANTHROPIC_MODEL (spec §13) so it can be swapped without code changes.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

let _client: Anthropic | null = null;

export function client(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export function model(): string {
  return process.env.ANTHROPIC_MODEL || "claude-opus-5";
}

export type ImageInput = { base64: string; mimeType: string };

type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export function imageBlock(img: ImageInput): Anthropic.ImageBlockParam {
  const mt = (["image/jpeg", "image/png", "image/gif", "image/webp"] as const).includes(
    img.mimeType as SupportedMediaType,
  )
    ? (img.mimeType as SupportedMediaType)
    : "image/jpeg";
  return { type: "image", source: { type: "base64", media_type: mt, data: img.base64 } };
}

export class ModelOutputError extends Error {}

/**
 * One structured call, validated against `schema` (zod). Spec §13:
 * "Reject and retry once on invalid output." `validate` adds app-level
 * checks (e.g. grounding) — return an error string to trigger the retry.
 */
export async function structuredCall<S extends z.ZodType>(opts: {
  schema: S;
  system: string;
  content: Anthropic.ContentBlockParam[];
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  validate?: (out: z.infer<S>) => string | null;
}): Promise<z.infer<S>> {
  let feedback: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const content: Anthropic.ContentBlockParam[] = feedback
      ? [...opts.content, { type: "text", text: `Your previous answer was rejected: ${feedback}. Answer again, fixing that.` }]
      : opts.content;
    let parsed: z.infer<S> | null = null;
    try {
      const res = await client().messages.parse({
        model: model(),
        max_tokens: opts.maxTokens ?? 8000,
        system: opts.system,
        messages: [{ role: "user", content }],
        output_config: { format: zodOutputFormat(opts.schema), effort: opts.effort ?? "medium" },
      });
      if (res.stop_reason === "refusal") throw new ModelOutputError("The model declined this image.");
      if (res.stop_reason === "max_tokens") {
        feedback = "the output was cut off; be more concise";
        continue;
      }
      parsed = res.parsed_output as z.infer<S> | null;
    } catch (err) {
      if (err instanceof Anthropic.APIError || err instanceof ModelOutputError) throw err;
      // Local parse/validation failure of the model output → retry once.
      feedback = err instanceof Error ? err.message.slice(0, 300) : "invalid JSON";
      continue;
    }
    if (!parsed) {
      feedback = "the output did not match the schema";
      continue;
    }
    const problem = opts.validate?.(parsed) ?? null;
    if (!problem) return parsed;
    feedback = problem;
  }
  throw new ModelOutputError(`Invalid model output after retry: ${feedback}`);
}

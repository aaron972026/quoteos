import Anthropic from "@anthropic-ai/sdk";

/**
 * Vision-based audit of customer-uploaded yard photos. Returns a structured
 * assessment of what's on the ground (existing fence, slope, obstacles) plus
 * a suggested demo type, which the configure screen can pre-fill.
 *
 * Implementation per the claude-api skill:
 *  - Opus 4.7 (skill default)
 *  - Adaptive thinking — vision tasks benefit from reasoning before answering
 *  - Prompt-cached system prompt (stable across every audit call)
 *  - Structured JSON via `output_config.format` (no Zod helper — avoids the
 *    zod-3-vs-zod-4 compatibility headache and keeps the dep list small)
 */

export interface PhotoAuditResult {
  existing_fence_material:
    | "cedar"
    | "chain-link"
    | "ornamental-steel"
    | "wood-rail"
    | "vinyl"
    | "concrete-base"
    | "none"
    | "unclear"
    | null;
  slope_estimate: "flat" | "mild" | "moderate" | "steep" | "unclear" | null;
  obstacles: string[];
  suggested_demo_type: "NONE" | "CEDAR" | "CHAIN" | "METAL" | "CONC" | null;
  confidence: number;
  raw_notes: string;
  audited_at: string;
}

const SYSTEM_PROMPT = `You are a fence-quoting assistant for FencePros Tulsa. A homeowner has uploaded 1–3 photos of their yard alongside a request for an instant quote. Your job is to look at the photos and produce a structured assessment for the pricing engine.

Identify, where possible:

1. **existing_fence_material** — the material of any fence visible at the property line, if any. Choose ONE of:
   - "cedar" — wood pickets, common residential
   - "chain-link" — galvanized or vinyl-coated wire mesh
   - "ornamental-steel" — vertical iron/aluminum pickets (decorative)
   - "wood-rail" — split-rail, post-and-rail, ranch style
   - "vinyl" — solid white/tan plastic panels
   - "concrete-base" — fence anchored in continuous concrete footing
   - "none" — no existing fence visible at the property line
   - "unclear" — fence visible but you can't reliably classify

2. **slope_estimate** — visual estimate of yard slope where the fence would run. Choose ONE of:
   - "flat" — appears level (<5% grade)
   - "mild" — slight rise (5–10%)
   - "moderate" — noticeable rise (10–20%)
   - "steep" — significant rise (20%+)
   - "unclear" — can't tell from the angle

3. **obstacles** — list (0–8 short phrases) of installation considerations visible in the photos. Examples: "mature oak within 3 ft of line", "AC condenser blocking access", "shed at corner", "retaining wall", "grade change at property line", "existing 4ft walk gate", "irrigation visible".

4. **suggested_demo_type** — what demolition will be required for the existing fence, if any. Choose ONE of:
   - "NONE" — nothing to remove
   - "CEDAR" — wood fence
   - "CHAIN" — chain-link
   - "METAL" — ornamental/iron
   - "CONC" — concrete-anchored (most expensive — flag clearly when seen)

5. **confidence** — 0.0 to 1.0, your overall confidence in this assessment. Lower the confidence when photos are blurry, only show landscaping (no property line visible), or are taken from inside the house.

6. **raw_notes** — one to three sentences in plain English describing what you see. Will be shown to the customer.

Be conservative: when in doubt, prefer "unclear" / "NONE" / lower confidence over guessing. The homeowner will see your output and can correct it on the next screen.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    existing_fence_material: {
      anyOf: [
        {
          type: "string",
          enum: [
            "cedar",
            "chain-link",
            "ornamental-steel",
            "wood-rail",
            "vinyl",
            "concrete-base",
            "none",
            "unclear",
          ],
        },
        { type: "null" },
      ],
    },
    slope_estimate: {
      anyOf: [
        {
          type: "string",
          enum: ["flat", "mild", "moderate", "steep", "unclear"],
        },
        { type: "null" },
      ],
    },
    obstacles: {
      type: "array",
      items: { type: "string" },
    },
    suggested_demo_type: {
      anyOf: [
        { type: "string", enum: ["NONE", "CEDAR", "CHAIN", "METAL", "CONC"] },
        { type: "null" },
      ],
    },
    confidence: { type: "number" },
    raw_notes: { type: "string" },
  },
  required: [
    "existing_fence_material",
    "slope_estimate",
    "obstacles",
    "suggested_demo_type",
    "confidence",
    "raw_notes",
  ],
  additionalProperties: false,
} as const;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    _client = new Anthropic();
  }
  return _client;
}

export async function runPhotoAudit(
  photoUrls: string[]
): Promise<PhotoAuditResult> {
  if (photoUrls.length === 0) {
    throw new Error("At least one photo URL is required");
  }
  const trimmed = photoUrls.slice(0, 3);

  const client = getClient();

  const userContent = [
    ...trimmed.map((url) => ({
      type: "image" as const,
      source: { type: "url" as const, url },
    })),
    {
      type: "text" as const,
      text: "Audit these yard photos. Return the assessment as structured JSON matching the configured schema.",
    },
  ];

  // output_config + json_schema is too new to be in the SDK's type defs at
  // 0.95.x; cast the whole params object to bypass strict typing for this
  // one field while we wait for an SDK release that ships it natively.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = {
    model: "claude-opus-4-7",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: RESPONSE_SCHEMA },
    },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  };
  const response = await client.messages.create(params);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic response contained no text block");
  }
  const parsed = JSON.parse(textBlock.text) as Omit<
    PhotoAuditResult,
    "audited_at"
  >;
  return { ...parsed, audited_at: new Date().toISOString() };
}

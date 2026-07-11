/**
 * Thin wrapper around the Anthropic SDK.
 *
 * Provides a single `llm(prompt)` helper that agents call during their
 * Reason step.  The model and temperature are centralised here so all
 * agents stay consistent without needing to import the SDK directly.
 */
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-3-5-sonnet-20241022";
const MAX_TOKENS = 4096;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

/**
 * Run a single text prompt and return the assistant's text response.
 * Throws on API error — callers should wrap in try/catch.
 */
export async function llm(prompt: string, systemPrompt?: string): Promise<string> {
  const client = getClient();

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: prompt }
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt ?? "You are a Helix AI agent for service delivery management. Be concise, structured, and action-oriented.",
    messages,
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected response type from LLM: ${block.type}`);
  }
  return block.text;
}

/**
 * Run a structured reasoning prompt and parse JSON from the response.
 * Wraps the prompt in a JSON-extraction instruction.
 */
export async function llmJson<T>(prompt: string, systemPrompt?: string): Promise<T> {
  const wrappedPrompt = `${prompt}

Respond with ONLY valid JSON matching the requested schema. Do not include markdown code fences or any explanation outside the JSON object.`;

  const raw = await llm(wrappedPrompt, systemPrompt);

  // Strip any accidental markdown fences
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  return JSON.parse(cleaned) as T;
}

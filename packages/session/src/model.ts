import type { IntentKind } from "./broker.js";
import { keywordIntent } from "./broker.js";

export interface FactProposal { text: string; kind: "sensory" | "flexible_world_fact"; basisFactIds: string[] }
export interface InterpretResult { intent: IntentKind; resolutionChoice: string | null; factProposals: FactProposal[] }
export interface DmModel {
  interpret(input: { playerText: string; context: string; options: Array<{ id: string; requirement: string; applicability: string }> }): Promise<InterpretResult>;
  narrate(input: { playerText: string; context: string; engineSummary: string }): Promise<string>;
}

const INTENTS = new Set<IntentKind>(["talk", "move", "force", "attack", "take", "other"]);

export function scriptedModel(): DmModel {
  return {
    async interpret({ playerText }) {
      return { intent: keywordIntent(playerText), resolutionChoice: null, factProposals: [] };
    },
    async narrate({ engineSummary }) {
      return engineSummary ? `The moment settles. ${engineSummary}` : "Colm waits, breath fogging in the yard.";
    },
  };
}

export function ollamaModel(input?: { baseUrl?: string; model?: string; timeoutMs?: number }): DmModel {
  const base = (input?.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/v1").replace(/\/$/, "");
  const model = input?.model ?? process.env.DM_MODEL ?? "qwen3:8b";
  const timeoutMs = input?.timeoutMs ?? 180000;
  const key = process.env.OLLAMA_API_KEY || "ollama";
  return {
    async interpret({ playerText, context, options }) {
      const schema = { type: "object", additionalProperties: false, required: ["intent", "resolutionChoice", "factProposals"], properties: { intent: { type: "string", enum: [...INTENTS] }, resolutionChoice: { type: "string" }, factProposals: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, required: ["text", "kind", "basisFactIds"], properties: { text: { type: "string" }, kind: { type: "string", enum: ["sensory", "flexible_world_fact"] }, basisFactIds: { type: "array", items: { type: "string" } } } } } } };
      const raw = await chat(base, key, model, timeoutMs, schema, "You interpret a player's action for a deterministic RPG engine. Return JSON only. intent is talk, move, force, attack, take, or other. resolutionChoice is one supplied option id, or an empty string. Do not invent dice, DCs, damage, or hidden facts.", `CONTEXT:\n${context}\n\nOPTIONS:\n${options.map((option) => `- ${option.id} (${option.requirement}): ${option.applicability}`).join("\n") || "(none)"}\n\nPLAYER:\n${playerText}`);
      const parsed = parseJson(raw);
      const candidate = parsed?.intent;
      const intent: IntentKind = candidate && INTENTS.has(candidate) ? candidate : keywordIntent(playerText);
      return { intent, resolutionChoice: parsed?.resolutionChoice || null, factProposals: Array.isArray(parsed?.factProposals) ? parsed.factProposals : [] };
    },
    async narrate({ playerText, context, engineSummary }) {
      return chat(base, key, model, timeoutMs, undefined, "You are the fiction layer of a D&D game. Write in English only, in second person, in two to four sentences. Describe only what the ENGINE block says happened and what the visible facts say is true now. If the ENGINE block says nothing changed, say that the action did not happen. Do not describe a gift, attack, discovery, or goblin unless the ENGINE block says so. Do not change numbers. Do not ask the player to roll. Do not add objects, weather, or any language other than English.", `CONTEXT:\n${context}\n\nPLAYER:\n${playerText}\n\nENGINE:\n${engineSummary || "No mechanical change."}\n\nNarrate only that engine result, in English.`);
    },
  };
}

async function chat(base: string, key: string, model: string, timeoutMs: number, schema: object | undefined, system: string, user: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body: Record<string, unknown> = { model, temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content: user }] };
    if (schema) body.response_format = { type: "json_schema", json_schema: { name: "dm_intent", strict: true, schema } };
    const response = await fetch(`${base}/chat/completions`, { method: "POST", signal: controller.signal, headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return String(payload.choices?.[0]?.message?.content ?? "");
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(raw: string): { intent?: IntentKind; resolutionChoice?: string; factProposals?: FactProposal[] } | undefined {
  try { return JSON.parse(raw) } catch { return undefined }
}

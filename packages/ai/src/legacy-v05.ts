import type { CampaignDefinition, GameState } from "../../domain/src/index.js";
import type { ToolContext } from "../../mcp-server/src/index.js";
import { callTool, tools } from "../../mcp-server/src/index.js";

export interface DmConfig {
  narration: "concise" | "balanced" | "cinematic";
  improvisation: "strict" | "guided" | "creative";
  ruleStrictness: "loose" | "normal" | "strict";
}

export interface AiProvider {
  runTurn(input: { instructions: string; playerText: string; toolContext: ToolContext }): Promise<string>;
}

export interface TextGenerationProvider {
  generateText(input: { instructions: string; userText: string; jsonMode?: boolean }): Promise<string>;
}

export type SupportedAiProvider = "openai" | "gemini" | "compatible" | "groq" | "openrouter" | "ollama";
export type AiRole = "dm" | "npc" | "memory" | "campaign-builder" | "character-builder" | "visual-prompt";

export interface AiRoute { role: AiRole; provider: SupportedAiProvider; model: string; baseUrl: string; apiKeyConfigured: boolean; }

export function buildDmInstructions(campaign: CampaignDefinition, state: GameState, config: DmConfig): string {
  const scene = campaign.scenes.find((candidate) => candidate.id === state.currentSceneId);
  const protectedCanon = campaign.canon.filter((fact) => fact.protected).map((fact) => `- ${fact.text}`).join("\n");
  const visibleFacts = state.facts.filter((fact) => fact.visibility === "player").map((fact) => `- ${fact.text}`).join("\n") || "- None beyond the current scene.";
  const activeGoals = campaign.goals.filter((goal) => goal.status === "active").map((goal) => `- ${goal.text}`).join("\n");
  const livingCreatures = state.creatures.filter((creature) => !creature.defeated).map((creature) => `${creature.id}: ${creature.name}`).join(", ") || "none";
  const recentConversation = state.events
    .filter((e) => e.type === "PLAYER_SPOKE" || e.type === "NPC_SPOKE")
    .slice(-16)
    .map((e) => {
      const p = e.payload as any;
      const speaker = e.type === "PLAYER_SPOKE" ? state.player.name : (p?.speaker || "DM");
      return `${speaker}: ${String(p?.text || "").slice(0, 1200)}`;
    }).join("\n") || "(No prior dialogue in this session.)";

  return `You are the AI Dungeon Master for ${campaign.title}.

AUTHORITY RULES
- You narrate, interpret intent, roleplay NPCs and keep the adventure moving.
- You MUST use a tool for dice checks, attacks, scene transitions, combat starts, inventory changes, or persistent story facts.
- Never invent a die result, damage/hit result, inventory mutation, combat outcome or scene transition in prose.
- Tool results are authoritative even when inconvenient.
- Never contradict protected canon.
- AI-authored story facts are ordinary mutable campaign facts; the AI may never create or alter protected canon.
- Allow deviations only when they fit the adventure's tone and can naturally reconnect to the core story. Do not railroad, but do not replace the core plot with an unrelated one.
- Do not expose DM-only canon merely because it appears below. Reveal information only when the current scene, roleplay, a successful check, or an authored clue justifies it.
- If the player attempts something impossible under their current abilities, explain that naturally rather than silently granting it.
- Keep the player in control: describe consequences, then invite or await their next action.

STYLE
- Narration: ${config.narration}
- Improvisation: ${config.improvisation}
- Rules strictness: ${config.ruleStrictness}
- Game difficulty: ${state.difficulty || "normal"}${state.adaptiveDifficulty ? " (adaptive adjustments allowed)" : " (fixed)"}
- Difficulty must never rewrite revealed facts or fabricated die results. Prefer legal levers such as enemy count before encounter start, tactics, hint frequency, and resource generosity. Advanced means smarter opposition and fewer hints, not hidden cheating.
- Use second-person narration for the player's experience.
- Keep ordinary turns to roughly 1-3 short paragraphs. Use more detail only for important reveals or dramatic moments.

CURRENT GAME STATE
Scene: ${scene?.name ?? state.currentSceneId}
Scene description: ${scene?.description ?? "Unknown"}
Scene goals: ${scene?.goals.join(", ") ?? "none"}
Player: ${state.player.name}; health ${state.player.health}/${state.player.maxHealth}; armor ${state.player.armor}
Abilities: ${state.player.abilities.map((ability) => `${ability.label} ${ability.modifier >= 0 ? "+" : ""}${ability.modifier}`).join(", ")}
Powers: ${state.player.powers.map((power) => `${power.id} (${power.name})`).join(", ")}
Inventory: ${state.player.inventory.join(", ") || "empty"}
Visible creatures: ${livingCreatures}
Combat active: ${Boolean(state.combat?.active)}
Player-visible facts:\n${visibleFacts}
Long-term session memory:\n${state.memory?.summary || "(No long-term summary yet.)"}\nRecent conversation (short-term memory):\n${recentConversation}
Active campaign goals:\n${activeGoals || "- Follow the current scene."}

PROTECTED CANON — DO NOT CONTRADICT, DO NOT AUTOMATICALLY REVEAL
${protectedCanon}

DLE ADVENTURE GUIDANCE
- In Midrolia's Lair, Midrolia is grieving. The player may comfort her. If an uncertain attempt reasonably tests wit, empathy or clever persuasion, use request_ability_check with Brain and an appropriate DLE difficulty. A successful consolation can justify giving the rain-wand.
- When the player clearly agrees to help, use set_game_flag to set quest_accepted=true. Only then can transition_scene move to swamp-navigation.
- In swamp-navigation, interpret a plausible approach as Strength, Speed or Brain and use a medium check. Record navigation_success using set_game_flag, then transition to spider-encounter.
- On entering spider-encounter, use start_spider_encounter with the recorded navigation result. During combat, attacks must use perform_attack. Never fabricate combat resolution.
- When all spiders are defeated, set spiders_defeated=true, give the healing-potion once, and transition to act2-placeholder.
`;
}

function jsonSchemaForTool(name: string): Record<string, unknown> {
  switch (name) {
    case "get_game_state": return { type: "object", properties: {}, required: [], additionalProperties: false };
    case "request_ability_check": return {
      type: "object", properties: {
        abilityId: { type: "string", enum: ["strength", "speed", "brain"] },
        difficulty: { type: "string", enum: ["easy", "medium", "hard", "legendary"] },
        reason: { type: "string" }
      }, required: ["abilityId", "difficulty", "reason"], additionalProperties: false
    };
    case "transition_scene": return { type: "object", properties: { destinationId: { type: "string" } }, required: ["destinationId"], additionalProperties: false };
    case "give_item": return { type: "object", properties: { itemId: { type: "string" } }, required: ["itemId"], additionalProperties: false };
    case "record_story_fact": return {
      type: "object", properties: {
        id: { type: "string" }, text: { type: "string" }, visibility: { type: "string", enum: ["dm", "player"] }
      }, required: ["id", "text", "visibility"], additionalProperties: false
    };
    case "set_game_flag": return {
      type: "object", properties: { key: { type: "string" }, value: { anyOf: [{ type: "boolean" }, { type: "number" }, { type: "string" }] } }, required: ["key", "value"], additionalProperties: false
    };
    case "start_spider_encounter": return { type: "object", properties: { navigationSuccess: { type: "boolean" } }, required: ["navigationSuccess"], additionalProperties: false };
    case "perform_attack": return {
      type: "object", properties: { attackerId: { type: "string" }, targetId: { type: "string" }, powerId: { type: "string" } }, required: ["attackerId", "targetId", "powerId"], additionalProperties: false
    };
    default: return { type: "object", properties: {}, required: [], additionalProperties: false };
  }
}

function responseTools() {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: `${tool.description} Risk level ${tool.risk}.`,
    parameters: jsonSchemaForTool(tool.name),
    strict: true
  }));
}

function chatTools() {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: `${tool.description} Risk level ${tool.risk}.`,
      parameters: jsonSchemaForTool(tool.name)
    }
  }));
}

export class OpenAiResponsesProvider implements AiProvider, TextGenerationProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options?: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model = options?.model ?? process.env.OPENAI_MODEL ?? "gpt-5.5";
    this.baseUrl = (options?.baseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is not set. Configure .env or choose another AI_PROVIDER.");
  }

  async runTurn(input: { instructions: string; playerText: string; toolContext: ToolContext }): Promise<string> {
    let response = await this.createResponse({ model: this.model, instructions: input.instructions, input: input.playerText, tools: responseTools() });

    for (let loop = 0; loop < 12; loop++) {
      const calls = Array.isArray(response.output) ? response.output.filter((item: any) => item?.type === "function_call") : [];
      if (calls.length === 0) return String(response.output_text ?? "").trim();
      const outputs = calls.map((call: any) => {
        let parsed: unknown = {};
        try { parsed = JSON.parse(call.arguments || "{}"); }
        catch { throw new Error(`AI returned invalid JSON arguments for ${call.name}`); }
        let result: unknown;
        try { result = callTool(call.name, input.toolContext, parsed); }
        catch (error) { result = { error: error instanceof Error ? error.message : String(error) }; }
        return { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result ?? { ok: true }) };
      });
      response = await this.createResponse({ model: this.model, previous_response_id: response.id, input: outputs, tools: responseTools() });
    }
    throw new Error("AI tool loop exceeded 12 rounds; stopping to protect game state.");
  }

  async generateText(input: { instructions: string; userText: string; jsonMode?: boolean }): Promise<string> {
    const response = await this.createResponse({
      model: this.model,
      instructions: input.instructions,
      input: input.userText,
      ...(input.jsonMode ? { text: { format: { type: "json_object" } } } : {})
    });
    return String(response.output_text ?? "").trim();
  }

  private async createResponse(body: unknown): Promise<any> {
    const response = await fetch(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`OpenAI Responses API error ${response.status}: ${JSON.stringify(payload)}`);
    return payload;
  }
}

export class OpenAiCompatibleProvider implements AiProvider, TextGenerationProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly providerName: string;

  constructor(options: { apiKey?: string; model: string; baseUrl: string; providerName?: string }) {
    this.apiKey = options.apiKey ?? "";
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.providerName = options.providerName ?? "OpenAI-compatible";
  }

  async runTurn(input: { instructions: string; playerText: string; toolContext: ToolContext }): Promise<string> {
    const messages: any[] = [
      { role: "system", content: input.instructions },
      { role: "user", content: input.playerText }
    ];
    for (let loop = 0; loop < 12; loop++) {
      const payload = await this.chat({ messages, tools: chatTools(), tool_choice: "auto" });
      const message = payload?.choices?.[0]?.message;
      if (!message) throw new Error(`${this.providerName} returned no assistant message.`);
      const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
      if (!calls.length) return String(message.content ?? "").trim();
      messages.push(message);
      for (const call of calls) {
        let args: unknown = {};
        try { args = JSON.parse(call?.function?.arguments || "{}"); }
        catch { throw new Error(`AI returned invalid JSON arguments for ${call?.function?.name || "unknown tool"}`); }
        let result: unknown;
        try { result = callTool(call.function.name, input.toolContext, args); }
        catch (error) { result = { error: error instanceof Error ? error.message : String(error) }; }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result ?? { ok: true }) });
      }
    }
    throw new Error("AI tool loop exceeded 12 rounds; stopping to protect game state.");
  }

  async generateText(input: { instructions: string; userText: string; jsonMode?: boolean }): Promise<string> {
    const payload = await this.chat({
      messages: [{ role: "system", content: input.instructions }, { role: "user", content: input.userText }],
      ...(input.jsonMode ? { response_format: { type: "json_object" } } : {})
    });
    return String(payload?.choices?.[0]?.message?.content ?? "").trim();
  }

  private async chat(body: Record<string, unknown>): Promise<any> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: this.model, ...body })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${this.providerName} API error ${response.status}: ${JSON.stringify(payload)}`);
    return payload;
  }
}

function rolePrefix(role: AiRole): string {
  return role.toUpperCase().replaceAll("-", "_");
}

function providerDefaults(provider: SupportedAiProvider): { model:string; baseUrl:string; apiKey:string } {
  switch (provider) {
    case "openai": return { model: process.env.OPENAI_MODEL || "gpt-5.5", baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1", apiKey: process.env.OPENAI_API_KEY || "" };
    case "gemini": return { model: process.env.GEMINI_MODEL || "gemini-3.8-flash", baseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai", apiKey: process.env.GEMINI_API_KEY || "" };
    case "groq": return { model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile", baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY || "" };
    case "openrouter": return { model: process.env.OPENROUTER_MODEL || "openrouter/free", baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1", apiKey: process.env.OPENROUTER_API_KEY || "" };
    case "ollama": return { model: process.env.OLLAMA_MODEL || "qwen3:4b", baseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1", apiKey: process.env.OLLAMA_API_KEY || "ollama" };
    case "compatible": return { model: process.env.COMPATIBLE_MODEL || "local-model", baseUrl: process.env.COMPATIBLE_BASE_URL || "http://127.0.0.1:8000/v1", apiKey: process.env.COMPATIBLE_API_KEY || "" };
    default: throw new Error(`Unsupported AI provider '${provider}'.`);
  }
}

export function getConfiguredAiRoute(role: AiRole = "dm"): AiRoute {
  const prefix = rolePrefix(role);
  const provider = ((process.env[`${prefix}_PROVIDER`] || process.env.AI_PROVIDER || "openai").toLowerCase()) as SupportedAiProvider;
  if (!["openai", "gemini", "groq", "openrouter", "ollama", "compatible"].includes(provider)) throw new Error(`Unsupported AI provider '${provider}' for role ${role}.`);
  const defaults = providerDefaults(provider);
  const model = process.env[`${prefix}_MODEL`] || defaults.model;
  const baseUrl = (process.env[`${prefix}_BASE_URL`] || defaults.baseUrl).replace(/\/$/, "");
  const apiKey = process.env[`${prefix}_API_KEY`] ?? defaults.apiKey;
  return { role, provider, model, baseUrl, apiKeyConfigured: provider === "ollama" || Boolean(apiKey) || provider === "compatible" };
}

export function isAiRoleConfigured(role: AiRole = "dm"): boolean {
  const route = getConfiguredAiRoute(role);
  if (route.provider === "ollama") return true;
  if (route.provider === "compatible") return Boolean(route.baseUrl && route.model);
  return route.apiKeyConfigured;
}

export function createConfiguredAiProvider(role: AiRole = "dm"): AiProvider & TextGenerationProvider {
  const route = getConfiguredAiRoute(role);
  const prefix = rolePrefix(role);
  const defaults = providerDefaults(route.provider);
  const apiKey = process.env[`${prefix}_API_KEY`] ?? defaults.apiKey;
  if (route.provider === "openai") return new OpenAiResponsesProvider({ apiKey, model: route.model, baseUrl: route.baseUrl });
  return new OpenAiCompatibleProvider({
    providerName: `${route.provider === "gemini" ? "Google Gemini" : route.provider === "openrouter" ? "OpenRouter" : route.provider === "groq" ? "Groq" : route.provider === "ollama" ? "Ollama" : "Compatible AI"} (${role})`,
    baseUrl: route.baseUrl,
    model: route.model,
    apiKey
  });
}

async function maybeRefreshMemory(state: GameState, provider?: TextGenerationProvider): Promise<void> {
  if (!provider || String(process.env.MEMORY_ENABLED || "false").toLowerCase() !== "true") return;
  const dialogue = state.events.filter((e) => e.type === "PLAYER_SPOKE" || e.type === "NPC_SPOKE");
  const every = Math.max(6, Number(process.env.MEMORY_SUMMARY_EVERY || 12));
  if (dialogue.length < every || dialogue.length % every !== 0) return;
  const recent = dialogue.slice(-every).map((e) => `${e.type === "PLAYER_SPOKE" ? state.player.name : String((e.payload as any)?.speaker || "DM")}: ${String((e.payload as any)?.text || "")}`).join("\n");
  const previous = state.memory?.summary || "(none)";
  const summary = await provider.generateText({
    instructions: "You maintain factual RPG session memory. Summarize only established events, player decisions, promises, discovered facts, NPC relationships, unresolved goals, and persistent consequences. Do not invent canon or hidden information. Keep it under 350 words.",
    userText: `Previous memory:\n${previous}\n\nRecent dialogue:\n${recent}`
  });
  state.memory = { summary: summary.trim(), summarizedThroughEventId: dialogue.at(-1)?.id, updatedAt: new Date().toISOString() };
}

export class AiDirector {
  constructor(private readonly campaign: CampaignDefinition, private readonly provider: AiProvider, private readonly config: DmConfig, private readonly memoryProvider?: TextGenerationProvider) {}
  async handleTurn(state: GameState, toolContext: ToolContext, playerText: string): Promise<string> {
    state.events.push({ id: crypto.randomUUID(), type: "PLAYER_SPOKE", at: new Date().toISOString(), payload: { text: playerText } });
    const instructions = buildDmInstructions(this.campaign, state, this.config);
    const narration = await this.provider.runTurn({ instructions, playerText, toolContext });
    state.events.push({ id: crypto.randomUUID(), type: "NPC_SPOKE", at: new Date().toISOString(), payload: { speaker: "DM", text: narration } });
    await maybeRefreshMemory(state, this.memoryProvider);
    return narration;
  }
}

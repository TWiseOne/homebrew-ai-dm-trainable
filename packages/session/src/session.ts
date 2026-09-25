import fs from "node:fs";
import type { DiceRoller } from "../../rules-core/src/index.js";
import { RandomDiceRoller } from "../../rules-core/src/index.js";
import type { FactRecord, GameState, PendingRoll, TraceRoll } from "../../domain/src/index.js";
import { actorById } from "../../domain/src/index.js";
import { CampaignEngine, FactLedger, reviewNarrativeClaim } from "../../campaign-engine/src/index.js";
import { Dnd5eRuleset } from "../../rules-dnd5e/src/index.js";
import { DOOR_DC, DOOR_FAIL_DAMAGE, campaign, createParty, seedFacts } from "./adventure.js";
import { chooseOption, keywordIntent, legalOptions, publicOptions, turnActorId, wantsHandoff, type BrokerOption, type IntentKind } from "./broker.js";
import type { DmModel, FactProposal } from "./model.js";

export interface StepResult {
  status: "narrated" | "need_roll";
  lines: string[];
  narration: string;
  prompt?: string;
  trace?: TurnTrace;
}

export interface TurnTrace {
  traceVersion: 1;
  gameId: string;
  turnIndex: number;
  at: string;
  campaignId: string;
  rulesetId: string;
  rulesVersion: string;
  sceneId: string;
  actorId: string;
  controllerKind: "human";
  playerText: string;
  context: { scene: string; visibleFactIds: string[]; omitted: string };
  modelIntent: { mode: "narrate" | "resolve" | "reject"; resolutionChoice: string | null; narration: string; factProposals: FactProposal[] };
  brokerOptions: Array<{ id: string; requirement: string; applicability: string; rollOwner: string; engine: string }>;
  roll: { status: "none" | "awaiting_player_roll" | "resolved"; owner: "human" | "engine" | "none"; method: TraceRoll["method"]; natural: number | null; modifier: number | null; total: number | null; dc: number | null; success: boolean | null };
  engineResult: { events: string[]; stateDelta: string[]; earlierRolls: TraceRoll[]; followups: string[] };
  authorityReview: { disposition: string; reason: string };
  finalNarration: string;
  humanLabel: null;
  gaps: string[];
}

export class PlaySession {
  constructor(private engine: CampaignEngine, private model: DmModel, private engineDice: DiceRoller, private traceDir: string) {}

  newGame(): GameState {
    const { aria, colm, goblin } = createParty();
    const state = this.engine.createGame({
      participants: [{ id: "p1", name: "Local Player", kind: "human", controllerId: "human", actorIds: ["aria"] }],
      controllers: [{ id: "human", kind: "human", participantId: "p1" }, { id: "dm", kind: "ai-dm" }],
      actors: [aria, colm, goblin],
    });
    state.ledger = structuredClone(seedFacts);
    state.dmPreferences = { assistanceMode: "informative", narration: "succinct", humour: "opportunistic", failureStyle: "failure-forward" };
    return state;
  }

  async playerText(state: GameState, playerText: string): Promise<StepResult> {
    if (state.pendingRoll) return { status: "need_roll", lines: [], narration: "", prompt: state.pendingRoll.prompt };
    const opened = this.pumpEngine(state);
    const context = buildContext(state, playerText);
    const options = legalOptions(state);
    let gaps: string[] = [];
    let interpreted;
    try {
      interpreted = await this.model.interpret({ playerText, context: context.text, options: publicOptions(options) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "intent failed";
      gaps.push("model_intent_failed");
      gaps.push(`Model: intent call failed (${message}). Your words were used instead.`);
      interpreted = { intent: keywordIntent(playerText), resolutionChoice: null, factProposals: [] as FactProposal[] };
    }
    const intent: IntentKind = interpreted.intent || keywordIntent(playerText);
    const choice = chooseOption(state, options, intent, playerText, interpreted.resolutionChoice);
    const review = reviewProposals(state, interpreted.factProposals);
    if (wantsHandoff(playerText) && hasLantern(state) && !goblinBetween(state)) {
      const delta = this.deliverLantern(state);
      return this.finish(state, playerText, options, intent, "res_give", "resolve", opened, delta, review, gaps, delta.join(" "));
    }
    if (!choice && intent === "take") return this.finish(state, playerText, options, intent, null, "reject", opened, [heldLantern(state)], review, gaps, heldLantern(state));
    if (!choice && intent === "attack") return this.finish(state, playerText, options, intent, null, "reject", opened, [], review, gaps, "No attack is resolved. The goblin is not in reach.");
    if (!choice) return this.finish(state, playerText, options, intent, null, "narrate", opened, [], review, gaps, engineLine(opened, heldLantern(state)));
    if (choice.engine === "check" || choice.engine === "initiative" || choice.engine === "attack") {
      const purpose = choice.engine === "check" ? "check" : choice.engine === "initiative" ? "initiative" : "attack";
      state.pendingRoll = { purpose, optionId: choice.id, actorId: "aria", prompt: rollPrompt(purpose), playerText, earlierRolls: [] };
      return { status: "need_roll", lines: opened, narration: "", prompt: state.pendingRoll.prompt };
    }
    const delta = this.applyQuiet(state, choice, playerText);
    return this.finish(state, playerText, options, intent, choice.id, choice.engine === "none" && intent === "talk" ? "narrate" : "resolve", opened, delta, review, gaps, engineLine(opened, delta.join(" ")));
  }

  async submitDie(state: GameState, natural: number, method: "manual_raw_die" | "digital_button"): Promise<StepResult> {
    const pending = state.pendingRoll;
    if (!pending) throw new Error("No roll is waiting.");
    if (!Number.isInteger(natural) || natural < 1 || natural > 20) throw new Error("Enter a natural d20 from 1 to 20.");
    const playerText = pending.playerText ?? `(natural d20 ${natural})`;
    const options = legalOptions(state);
    const lines: string[] = [];
    const earlier = [...(pending.earlierRolls ?? [])];
    state.pendingRoll = undefined;
    if (pending.purpose === "check") {
      const result = this.engine.check(state, "aria", { ability: "str", skill: "athletics", dc: DOOR_DC, reason: "Force the barred door" }, naturalDie(natural));
      const roll: TraceRoll = { owner: "human", method, natural: result.die, modifier: result.modifier, total: result.total, dc: result.target, success: result.success, purpose: "check" };
      lines.push(`Engine  d20 ${result.die} + ${result.modifier} = ${result.total} vs DC ${result.target}. ${result.success ? "Success." : "Failure."}`);
      if (result.success) lines.push("Engine  The bar gives. The door opens.");
      else {
        const hp = this.engine.applyDamage(state, "aria", DOOR_FAIL_DAMAGE);
        lines.push(`Engine  The bar splits and clips Aria for ${DOOR_FAIL_DAMAGE} damage. HP ${hp}/${maxHp(state, "aria")}. The door opens anyway.`);
      }
      state.flags.doorOpen = true;
      this.markDoorOpen(state);
      this.enterStorehouse(state);
      lines.push("Engine  Scene: Storehouse.");
      return this.finish(state, playerText, options, "force", pending.optionId, "resolve", lines, ["door opened"], reviewProposals(state, []), [], lines.join(" "), roll, earlier);
    }
    if (pending.purpose === "initiative") {
      const dice = new SplitDice(natural, this.engineDice);
      const table = this.engine.startEncounter(state, "storehouse-fight", ["aria", "goblin"], dice);
      const aria = table.find((entry) => entry.actorId === "aria")!;
      const goblin = table.find((entry) => entry.actorId === "goblin")!;
      earlier.push({ owner: "human", method, natural: aria.die, modifier: aria.modifier, total: aria.total, purpose: "initiative" });
      earlier.push({ owner: "engine", method: "engine", natural: goblin.die, modifier: goblin.modifier, total: goblin.total, purpose: "initiative" });
      lines.push(`Engine  Initiative: Aria d20 ${aria.die} + ${aria.modifier} = ${aria.total}. Goblin d20 ${goblin.die} + ${goblin.modifier} = ${goblin.total}.`);
      lines.push(...this.pumpEngine(state));
      if (turnActorId(state) === "aria" && hpOf(state, "goblin") > 0 && hpOf(state, "aria") > 0) {
        state.pendingRoll = { purpose: "attack", optionId: "res_strike", actorId: "aria", prompt: rollPrompt("attack"), playerText: pending.playerText, earlierRolls: earlier };
        return { status: "need_roll", lines, narration: "", prompt: state.pendingRoll.prompt };
      }
      return this.finish(state, playerText, options, "attack", "res_init", "resolve", lines, ["initiative"], reviewProposals(state, []), [], lines.join(" "), earlier[0], earlier.slice(1));
    }
    const result = this.engine.attack(state, "aria", "goblin", "longsword", new SplitDice(natural, this.engineDice));
    const roll: TraceRoll = { owner: "human", method, natural: result.die, modifier: result.modifier, total: result.total, dc: result.target, success: result.success, purpose: "attack" };
    lines.push(`Engine  Attack d20 ${result.die} + ${result.modifier} = ${result.total} vs AC ${result.target}. ${result.success ? `Hit for ${result.damage} ${result.damageType}.` : "Miss."}`);
    if (result.targetDefeated) {
      this.engine.endEncounter(state);
      state.flags.goblinDefeated = true;
      this.markGoblinDown(state);
      lines.push("Engine  The goblin drops.");
    } else {
      this.engine.endTurn(state);
      lines.push(...this.pumpEngine(state));
    }
    return this.finish(state, playerText, options, "attack", pending.optionId, "resolve", lines, ["attack resolved"], reviewProposals(state, []), [], lines.join(" "), roll, earlier);
  }

  private applyQuiet(state: GameState, choice: BrokerOption, playerText: string): string[] {
    if (choice.engine === "move" && choice.sceneId) {
      if (choice.sceneId === "storehouse" && !state.flags.doorOpen) return ["The door is still barred."];
      this.engine.enterScene(state, choice.sceneId);
      if (choice.sceneId === "storehouse") this.revealGoblin(state);
      return [`Scene: ${sceneName(state)}.`];
    }
    if (choice.engine === "give") return this.deliverLantern(state);
    if (choice.engine === "take") {
      this.engine.giveItem(state, "aria", "lantern");
      state.flags.hasLantern = true;
      const carried = reviseFact(state, "f-lantern", "carried by Aria");
      if (carried) carried.tags = ["storehouse", "yard"];
      addFact(state, { id: "f-taken", subject: "Aria", predicate: "carries", value: "the storehouse lantern", source: "engine_result", visibility: ["player"], protection: "established", confidence: "explicit", provenance: "event:ITEM_GAINED", tags: ["storehouse", "yard"] });
      if (wantsHandoff(playerText)) return ["Aria takes the lantern.", ...this.deliverLantern(state)];
      if (/\b(return|back|yard)\b/i.test(playerText)) {
        this.engine.enterScene(state, "yard");
        return ["Aria takes the lantern.", `Scene: ${sceneName(state)}.`, "The lantern is still in Aria's inventory."];
      }
      return ["Aria takes the lantern."];
    }
    if (choice.intent === "talk" && state.currentSceneId === "yard") {
      state.flags.questKnown = true;
      if (state.flags.questComplete) return ["The errand is already done."];
      if (hasLantern(state)) return ["Colm is waiting for the lantern. It is still in Aria's hands."];
      return ["Colm asks Aria to bring back the storehouse lantern."];
    }
    if (choice.intent === "take") return ["The goblin is still between Aria and the lantern."];
    return ["Nothing mechanical changes."];
  }

  private enterStorehouse(state: GameState) {
    this.engine.enterScene(state, "storehouse");
    this.revealGoblin(state);
  }

  private markDoorOpen(state: GameState) {
    const fact = reviseFact(state, "f-door", "open. The oak bar has been lifted.");
    if (fact && !(fact.tags ?? []).includes("storehouse")) fact.tags = [...(fact.tags ?? []), "storehouse"];
  }

  private deliverLantern(state: GameState): string[] {
    const lines: string[] = [];
    if (state.currentSceneId !== "yard") {
      this.engine.enterScene(state, "yard");
      lines.push(`Scene: ${sceneName(state)}.`);
    }
    this.engine.removeItem(state, "aria", "lantern");
    state.flags.hasLantern = false;
    state.flags.questComplete = true;
    const lantern = reviseFact(state, "f-lantern", "with Warden Colm in the yard");
    if (lantern) lantern.tags = ["yard"];
    const taken = reviseFact(state, "f-taken", "handed the lantern to Colm");
    if (taken) taken.tags = ["yard"];
    lines.push("Colm takes the lantern. Aria's hands are empty. The errand is done.");
    return lines;
  }

  private markGoblinDown(state: GameState) {
    reviseFact(state, "f-goblin-seen", "lies defeated among the crates");
  }

  private revealGoblin(state: GameState) {
    addFact(state, { id: "f-goblin-seen", subject: "Goblin", predicate: "stands", value: "among the crates in the storehouse", source: "engine_result", visibility: ["player"], protection: "established", confidence: "explicit", provenance: "event:SCENE_ENTERED", tags: ["storehouse"] });
  }

  private pumpEngine(state: GameState): string[] {
    const lines: string[] = [];
    for (let guard = 0; guard < 4 && state.encounter?.active; guard++) {
      const actorId = turnActorId(state);
      if (!actorId) break;
      if (hpOf(state, actorId) <= 0) { this.engine.endTurn(state); continue; }
      if (isHuman(state, actorId)) break;
      const result = this.engine.attack(state, actorId, "aria", "scimitar", this.engineDice);
      lines.push(`Engine  Goblin attack d20 ${result.die} + ${result.modifier} = ${result.total} vs AC ${result.target}. ${result.success ? `Hit for ${result.damage} ${result.damageType}. Aria HP ${result.targetHp}.` : "Miss."}`);
      if (hpOf(state, "aria") <= 0) { this.engine.endEncounter(state); lines.push("Engine  Aria falls."); break; }
      if (result.targetDefeated) this.engine.endEncounter(state);
      else this.engine.endTurn(state);
    }
    return lines;
  }

  private async finish(state: GameState, playerText: string, options: BrokerOption[], intent: IntentKind, resolutionChoice: string | null, mode: "narrate" | "resolve" | "reject", lines: string[], delta: string[], review: { disposition: string; reason: string }, gaps: string[], summary: string, roll?: TraceRoll, earlier: TraceRoll[] = []): Promise<StepResult> {
    const context = buildContext(state, playerText);
    const engineSummary = `${summary}\nNow: ${situation(state)}`;
    let narration = "";
    try { narration = await this.model.narrate({ playerText, context: context.text, engineSummary }); }
    catch (error) {
      gaps.push("narration_fallback");
      narration = `The model did not answer. ${error instanceof Error ? error.message : "Narration failed."}`;
    }
    if (mixesAnotherLanguage(narration)) {
      try {
        narration = await this.model.narrate({ playerText, context: context.text, engineSummary: `${engineSummary}\nThe previous reply was not English. Reply in English only.` });
      } catch (error) {
        gaps.push("narration_fallback");
        narration = `The model did not answer. ${error instanceof Error ? error.message : "Narration failed."}`;
      }
      if (mixesAnotherLanguage(narration)) {
        gaps.push("narration_non_english");
        narration = "The narration was not in English, so it was set aside. The engine line above is what happened.";
      }
    }
    if (/tell me your|what did you roll|roll a d20|enter your (die|roll|d20)/i.test(narration)) {
      gaps.push("narration_asked_for_roll");
      narration = "The roll is already resolved.";
    }
    const trace = this.trace(state, playerText, context, options, intent, resolutionChoice, mode, lines, delta, review, gaps, narration, roll, earlier);
    writeTrace(this.traceDir, trace);
    return { status: "narrated", lines, narration, trace };
  }

  private trace(state: GameState, playerText: string, context: ReturnType<typeof buildContext>, options: BrokerOption[], intent: IntentKind, resolutionChoice: string | null, mode: "narrate" | "resolve" | "reject", lines: string[], delta: string[], review: { disposition: string; reason: string }, gaps: string[], narration: string, roll: TraceRoll | undefined, earlier: TraceRoll[]): TurnTrace {
    const events = state.events.slice(-6).map((event) => event.type);
    return {
      traceVersion: 1, gameId: state.id, turnIndex: nextTurn(state), at: new Date().toISOString(), campaignId: state.campaignId, rulesetId: state.rulesetId, rulesVersion: state.rulesVersion, sceneId: state.currentSceneId, actorId: "aria", controllerKind: "human", playerText,
      context: { scene: context.scene, visibleFactIds: context.visibleFactIds, omitted: "dm_only facts stay out of this context" },
      modelIntent: { mode, resolutionChoice, narration, factProposals: [] },
      brokerOptions: options.map((option) => ({ id: option.id, requirement: option.requirement, applicability: option.applicability, rollOwner: option.rollOwner, engine: option.engine })),
      roll: roll ? { status: "resolved", owner: roll.owner, method: roll.method, natural: roll.natural, modifier: roll.modifier, total: roll.total, dc: roll.dc ?? null, success: roll.success ?? null } : { status: "none", owner: "none", method: "none", natural: null, modifier: null, total: null, dc: null, success: null },
      engineResult: { events, stateDelta: delta, earlierRolls: earlier, followups: lines },
      authorityReview: review, finalNarration: narration, humanLabel: null, gaps,
    };
  }
}

export function createPlay(opts: { model: DmModel; engineDice?: DiceRoller; traceDir?: string }): PlaySession {
  return new PlaySession(new CampaignEngine(campaign, new Dnd5eRuleset()), opts.model, opts.engineDice ?? new RandomDiceRoller(), opts.traceDir ?? "data/play-traces");
}

export function sceneView(state: GameState): string {
  const scene = campaign.scenes.find((item) => item.id === state.currentSceneId);
  const hp = `${hpOf(state, "aria")}/${maxHp(state, "aria")}`;
  const lantern = hasLantern(state) ? " carrying the lantern" : "";
  const quest = state.flags.questComplete ? " Errand complete." : "";
  return `${campaign.title}\nAria HP ${hp}${lantern}. ${scene?.name ?? state.currentSceneId}.${quest}\n${sceneDescription(state)}`;
}

function nextTurn(state: GameState): number {
  const current = Number(state.flags.traceTurns ?? 0);
  state.flags.traceTurns = current + 1;
  return current;
}

function rollPrompt(purpose: PendingRoll["purpose"]): string {
  if (purpose === "check") return "Roll needed: natural d20 to force the door. Enter 1-20, or /roll.";
  if (purpose === "initiative") return "Roll needed: natural d20 for initiative. Enter 1-20, or /roll.";
  return "Roll needed: natural d20 to attack. Enter 1-20, or /roll.";
}

function reviewProposals(state: GameState, proposals: FactProposal[]): { disposition: string; reason: string } {
  if (!proposals.length) return { disposition: "allow", reason: "no_proposal" };
  const ledger = loadLedger(state);
  let last = { disposition: "allow", reason: "no_proposal" };
  for (const proposal of proposals) {
    const kind = proposal.kind === "sensory" ? "presentation" : "persistent_fact";
    last = reviewNarrativeClaim({ text: proposal.text, kind, basisFactIds: proposal.basisFactIds }, ledger.relevant({ viewer: "dm", terms: ["colm", "door", "lantern", "goblin", "storehouse"], limit: 20 }).concat(state.ledger));
    if (last.disposition !== "allow") addGapFact(state, proposal.text, last.reason);
  }
  return last;
}

function addGapFact(state: GameState, text: string, reason: string) {
  state.flags.lastProposal = `${reason}: ${text}`.slice(0, 180);
}

function buildContext(state: GameState, playerText: string): { text: string; scene: string; visibleFactIds: string[] } {
  const ledger = loadLedger(state);
  const scene = campaign.scenes.find((item) => item.id === state.currentSceneId);
  const visible = state.ledger.filter((fact) => ledger.visibleTo(fact, "aria") && (fact.tags ?? []).includes(state.currentSceneId));
  const ids = [...new Set(visible.map((fact) => fact.id))];
  const turn = turnActorId(state);
  const door = state.flags.doorOpen ? "The storehouse door is open." : "The storehouse door is barred.";
  const text = [`Scene: ${scene?.name}. ${sceneDescription(state)}`, door, `Aria HP ${hpOf(state, "aria")}/${maxHp(state, "aria")}.`, turn ? `Turn: ${turn}.` : "No encounter.", `Visible facts:`, ...state.ledger.filter((fact) => ids.includes(fact.id)).map((fact) => `- ${fact.subject} ${fact.predicate} ${fact.value}`)].join("\n");
  return { text, scene: sceneDescription(state), visibleFactIds: ids };
}

function sceneDescription(state: GameState): string {
  if (state.currentSceneId === "door" && state.flags.doorOpen) return "The storehouse door stands open. The oak bar has been lifted.";
  if (state.currentSceneId === "storehouse" && goblinKnown(state) && hpOf(state, "goblin") <= 0) return "Crates fill the storehouse. The goblin lies defeated.";
  return campaign.scenes.find((item) => item.id === state.currentSceneId)?.description ?? "";
}

function situation(state: GameState): string {
  const door = state.flags.doorOpen ? "The storehouse door is open." : "The storehouse door is barred.";
  const parts = [`${sceneName(state)}. ${door}`];
  if (state.currentSceneId === "storehouse" && goblinKnown(state)) parts.push(hpOf(state, "goblin") > 0 ? "The goblin is here." : "The goblin lies defeated.");
  if (hasLantern(state)) parts.push("Aria is carrying the lantern.");
  else if (state.flags.questComplete) parts.push("Colm has the lantern.");
  return parts.join(" ");
}

function goblinKnown(state: GameState): boolean {
  return state.ledger.some((fact) => fact.id === "f-goblin-seen");
}

function goblinBetween(state: GameState): boolean {
  return state.currentSceneId === "storehouse" && hpOf(state, "goblin") > 0;
}

function heldLantern(state: GameState): string {
  if (goblinBetween(state) && !hasLantern(state)) return "The goblin is still between Aria and the lantern.";
  if (hasLantern(state)) return "No mechanical change. The lantern is still in Aria's inventory.";
  if (state.flags.questComplete) return "No mechanical change. Colm already has the lantern.";
  return "No mechanical change.";
}

function mixesAnotherLanguage(text: string): boolean {
  return /[^\u0000-\u024F\u1E00-\u1EFF\u2010-\u2027\u2030-\u205E]/.test(text);
}

function loadLedger(state: GameState): FactLedger {
  const ledger = new FactLedger();
  for (const fact of state.ledger) ledger.add(fact);
  return ledger;
}

function addFact(state: GameState, fact: FactRecord) {
  if (state.ledger.some((item) => item.id === fact.id)) return;
  state.ledger.push(fact);
}

function reviseFact(state: GameState, id: string, value: string): FactRecord | undefined {
  const fact = state.ledger.find((item) => item.id === id);
  if (!fact) return undefined;
  fact.value = value;
  fact.source = "engine_result";
  return fact;
}

function writeTrace(dir: string, trace: TurnTrace) {
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(`${dir}/${trace.gameId}.jsonl`, `${JSON.stringify(trace)}\n`);
}

function engineLine(opened: string[], extra: string): string {
  return [...opened, extra].filter(Boolean).join(" ");
}

function sceneName(state: GameState): string {
  return campaign.scenes.find((scene) => scene.id === state.currentSceneId)?.name ?? state.currentSceneId;
}

function hasLantern(state: GameState): boolean {
  return actorById(state, "aria").inventory.some((item) => item.itemId === "lantern" && item.quantity > 0);
}

function hpOf(state: GameState, id: string): number {
  return (actorById(state, id).rulesData as { hitPoints: { current: number } }).hitPoints.current;
}

function maxHp(state: GameState, id: string): number {
  return (actorById(state, id).rulesData as { hitPoints: { maximum: number } }).hitPoints.maximum;
}

function isHuman(state: GameState, actorId: string): boolean {
  const actor = actorById(state, actorId);
  return state.controllers.find((controller) => controller.id === actor.controllerId)?.kind === "human";
}

class SplitDice implements DiceRoller {
  private used = false;
  constructor(private natural: number, private rest: DiceRoller) {}
  d20() { if (!this.used) { this.used = true; return this.natural; } return this.rest.d20(); }
  roll(sides: number, count = 1) { return this.rest.roll(sides, count); }
}

function naturalDie(natural: number): DiceRoller {
  return { d20: () => natural, roll: () => [natural] };
}

import type { GameState } from "../../domain/src/index.js";
import { actorById } from "../../domain/src/index.js";

export type IntentKind = "talk" | "move" | "force" | "attack" | "take" | "other";
export type OptionEngine = "check" | "attack" | "initiative" | "move" | "take" | "none";

export interface BrokerOption {
  id: string;
  requirement: "optional" | "mandatory";
  applicability: string;
  rollOwner: "human" | "engine" | "none";
  engine: OptionEngine;
  intent: IntentKind;
  sceneId?: string;
}

export function keywordIntent(text: string): IntentKind {
  const t = text.toLowerCase();
  if (/\b(attack|strike|stab|swing|hit|fight|slash)\b/.test(t)) return "attack";
  if (/\b(take|grab|pick up|lantern)\b/.test(t)) return "take";
  if (/\b(shoulder|force|break|shove|pry|bar|open)\b/.test(t)) return "force";
  if (/\b(go|enter|return|back|walk|head|leave|storehouse|yard|door|inside)\b/.test(t)) return "move";
  if (/\b(talk|ask|say|hello|speak|colm|warden)\b/.test(t)) return "talk";
  return "other";
}

function hp(state: GameState, id: string): number {
  const actor = actorById(state, id);
  const points = (actor.rulesData as { hitPoints?: { current: number } }).hitPoints;
  if (!points) throw new Error(`${actor.name} has no hit points`);
  return points.current;
}

function hasItem(state: GameState, actorId: string, itemId: string): boolean {
  return actorById(state, actorId).inventory.some((item) => item.itemId === itemId && item.quantity > 0);
}

export function turnActorId(state: GameState): string | undefined {
  const encounter = state.encounter;
  if (!encounter?.active) return undefined;
  return encounter.initiative[encounter.turnIndex]?.actorId;
}

export function legalOptions(state: GameState): BrokerOption[] {
  const scene = state.currentSceneId;
  const options: BrokerOption[] = [];
  const goblinAlive = hp(state, "goblin") > 0;
  if (scene === "yard") {
    options.push({ id: "res_listen", requirement: "optional", applicability: "speak with Colm", rollOwner: "none", engine: "none", intent: "talk" });
    options.push({ id: "res_to_door", requirement: "optional", applicability: "go to the storehouse door", rollOwner: "none", engine: "move", intent: "move", sceneId: "door" });
  }
  if (scene === "door") {
    if (!state.flags.doorOpen) options.push({ id: "res_door", requirement: "optional", applicability: "force the barred door", rollOwner: "human", engine: "check", intent: "force" });
    else options.push({ id: "res_inside", requirement: "optional", applicability: "step into the storehouse", rollOwner: "none", engine: "move", intent: "move", sceneId: "storehouse" });
    options.push({ id: "res_back_yard", requirement: "optional", applicability: "return to the yard", rollOwner: "none", engine: "move", intent: "move", sceneId: "yard" });
  }
  if (scene === "storehouse") {
    if (goblinAlive && !state.encounter?.active) options.push({ id: "res_init", requirement: "optional", applicability: "fight the goblin", rollOwner: "human", engine: "initiative", intent: "attack" });
    if (goblinAlive && state.encounter?.active && turnActorId(state) === "aria") options.push({ id: "res_strike", requirement: "optional", applicability: "strike the goblin", rollOwner: "human", engine: "attack", intent: "attack" });
    if (!goblinAlive && !hasItem(state, "aria", "lantern")) options.push({ id: "res_lantern", requirement: "optional", applicability: "take the hanging lantern", rollOwner: "none", engine: "take", intent: "take" });
    options.push({ id: "res_leave", requirement: "optional", applicability: "return to the yard", rollOwner: "none", engine: "move", intent: "move", sceneId: "yard" });
  }
  return options;
}

export function chooseOption(options: BrokerOption[], intent: IntentKind, playerText: string, resolutionChoice: string | null): BrokerOption | undefined {
  const mandatory = options.filter((option) => option.requirement === "mandatory");
  if (mandatory.length === 1) return mandatory[0];
  if (resolutionChoice) {
    const chosen = options.find((option) => option.id === resolutionChoice);
    if (chosen && (chosen.intent === intent || intent === "other")) return chosen;
  }
  if (intent === "move") return pickMove(options, playerText);
  return options.find((option) => option.intent === intent);
}

function pickMove(options: BrokerOption[], playerText: string): BrokerOption | undefined {
  const moves = options.filter((option) => option.engine === "move");
  const text = playerText.toLowerCase();
  if (/\b(storehouse|inside|enter|in)\b/.test(text)) return moves.find((option) => option.sceneId === "storehouse") ?? moves[0];
  if (/\b(door|bar)\b/.test(text)) return moves.find((option) => option.sceneId === "door") ?? moves[0];
  if (/\b(yard|back|colm|return|leave)\b/.test(text)) return moves.find((option) => option.sceneId === "yard") ?? moves[0];
  return moves[0];
}

export function publicOptions(options: BrokerOption[]): Array<{ id: string; requirement: BrokerOption["requirement"]; applicability: string }> {
  return options.map((option) => ({ id: option.id, requirement: option.requirement, applicability: option.applicability }));
}

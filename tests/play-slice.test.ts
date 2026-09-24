import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DiceRoller } from "../packages/rules-core/src/index.js";
import { SaveStore } from "../packages/persistence/src/index.js";
import { createPlay, scriptedModel, type DmModel } from "../packages/session/src/index.js";
import { actorById } from "../packages/domain/src/index.js";

class QueueDice implements DiceRoller {
  constructor(private d20s: number[], private faces: number[]) {}
  d20() { const value = this.d20s.shift(); if (value === undefined) throw new Error("engine d20 exhausted"); return value; }
  roll(_sides: number, count = 1) { return Array.from({ length: count }, () => { const value = this.faces.shift(); if (value === undefined) throw new Error("engine face exhausted"); return value; }); }
}

const dir = mkdtempSync(join(tmpdir(), "play-slice-"));
const dice = new QueueDice([5, 15, 18], [4, 4]);
const play = createPlay({ model: scriptedModel(), engineDice: dice, traceDir: dir });
const state = play.newGame();

const talk = await play.playerText(state, "Hello Colm, what do you need?");
assert.equal(talk.status, "narrated");
assert.equal(state.flags.questKnown, true);
assert.equal(talk.trace?.context.visibleFactIds.includes("f-goblin"), false);
assert.equal(state.currentSceneId, "yard");

const moved = await play.playerText(state, "I go to the door.");
assert.equal(state.currentSceneId, "door");
assert.equal(moved.status, "narrated");

const forced = await play.playerText(state, "I shoulder the door open.");
assert.equal(forced.status, "need_roll");
assert.match(forced.prompt ?? "", /natural d20/);
await play.submitDie(state, 6, "manual_raw_die");
const aria = () => (actorById(state, "aria").rulesData as { hitPoints: { current: number } }).hitPoints.current;
assert.equal(aria(), 10);
assert.equal(state.currentSceneId, "storehouse");
assert.equal(state.flags.doorOpen, true);
assert.equal(state.ledger.some((fact) => fact.id === "f-goblin-seen"), true);

const fight = await play.playerText(state, "I attack the goblin.");
assert.equal(fight.status, "need_roll");
const afterInit = await play.submitDie(state, 12, "manual_raw_die");
assert.equal(afterInit.status, "need_roll");
assert.match(afterInit.lines.join("\n"), /Aria d20 12 \+ 2 = 14/);
assert.match(afterInit.lines.join("\n"), /Goblin d20 5 \+ 2 = 7/);
await play.submitDie(state, 15, "manual_raw_die");
assert.equal((actorById(state, "goblin").rulesData as { hitPoints: { current: number } }).hitPoints.current, 0);
assert.equal(state.encounter?.active, false);

await play.playerText(state, "I take the lantern.");
assert.equal(actorById(state, "aria").inventory.some((item) => item.itemId === "lantern"), true);
await play.playerText(state, "I return to the yard.");
assert.equal(state.currentSceneId, "yard");
assert.equal(state.flags.questComplete, true);

const traces = fs.readFileSync(join(dir, `${state.id}.jsonl`), "utf8").trim().split("\n").map((line) => JSON.parse(line));
const door = traces.find((trace) => trace.roll?.purpose === undefined && trace.roll?.natural === 6);
assert.equal(door.roll.natural, 6);
assert.equal(door.roll.modifier, 3);
assert.equal(door.roll.total, 9);
assert.equal(door.roll.owner, "human");
assert.equal(traces.some((trace) => trace.engineResult.earlierRolls.some((roll: { owner: string }) => roll.owner === "engine")), true);

const saveDir = mkdtempSync(join(tmpdir(), "play-save-"));
const store = new SaveStore(join(saveDir, "save.sqlite"));
store.upsert(state);
const loaded = store.load(state.id)!;
assert.equal(loaded.currentSceneId, "yard");
assert.equal(loaded.flags.questComplete, true);
assert.equal((actorById(loaded, "aria").rulesData as { hitPoints: { current: number } }).hitPoints.current, 10);
assert.equal(actorById(loaded, "aria").inventory[0]?.itemId, "lantern");
assert.equal(loaded.ledger.some((fact) => fact.id === "f-taken"), true);
store.close();

const asking: DmModel = { async interpret({ playerText }) { return { intent: "talk", resolutionChoice: null, factProposals: [] }; }, async narrate() { return "Tell me your d20 result."; } };
const askPlay = createPlay({ model: asking, engineDice: new QueueDice([], []), traceDir: dir });
const askState = askPlay.newGame();
const asked = await askPlay.playerText(askState, "Hello Colm");
assert.equal(asked.narration, "The roll is already resolved.");
assert.equal(asked.trace?.gaps.includes("narration_asked_for_roll"), true);

const inventing: DmModel = { async interpret() { return { intent: "other", resolutionChoice: null, factProposals: [{ text: "A silver key lies beneath the desk.", kind: "flexible_world_fact", basisFactIds: ["f-colm"] }] }; }, async narrate() { return "Aria looks around."; } };
const inventPlay = createPlay({ model: inventing, engineDice: new QueueDice([], []), traceDir: dir });
const inventState = inventPlay.newGame();
const invented = await inventPlay.playerText(inventState, "I look under the desk.");
assert.equal(invented.trace?.authorityReview.disposition, "deny");
assert.equal(inventState.ledger.some((fact) => fact.value.includes("silver key")), false);

const hitDice = new QueueDice([15, 18], [4]);
const hitPlay = createPlay({ model: scriptedModel(), engineDice: hitDice, traceDir: dir });
const hitState = hitPlay.newGame();
hitState.currentSceneId = "storehouse";
hitState.flags.doorOpen = true;
await hitPlay.playerText(hitState, "I fight the goblin.");
const init = await hitPlay.submitDie(hitState, 1, "manual_raw_die");
assert.match(init.lines.join("\n"), /Goblin attack d20 18 \+ 4 = 22/);
assert.equal((actorById(hitState, "aria").rulesData as { hitPoints: { current: number } }).hitPoints.current, 6);
assert.equal(init.status, "need_roll");

rmSync(dir, { recursive: true, force: true });
rmSync(saveDir, { recursive: true, force: true });
console.log("Play slice tests PASS");

import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { SaveStore } from "../../../packages/persistence/src/index.js";
import type { GameState } from "../../../packages/domain/src/index.js";
import { createPlay, ollamaModel, sceneView } from "../../../packages/session/src/index.js";

const arg = (name: string) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
const store = new SaveStore(process.env.SAVE_DB_PATH || "data/ai-rpg-v06.sqlite");
const play = createPlay({ model: ollamaModel() });
let state = loadState();
const rl = readline.createInterface({ input, output });
printState();
try {
  for (;;) {
    const pending = state.pendingRoll;
    const line = (await rl.question(pending ? `${pending.prompt}\n> ` : "You:\n> ")).trim();
    if (!line) continue;
    if (line === "/quit") { store.upsert(state); console.log(`Saved ${state.id}. Trace: data/play-traces/${state.id}.jsonl`); break; }
    if (line === "/save") { store.upsert(state); console.log(`Saved ${state.id}`); continue; }
    if (line === "/help") { console.log("/save  /quit  /roll when a d20 is waiting  /inventory"); continue; }
    if (line === "/inventory") { console.log(inventory()); continue; }
    if (pending && line === "/roll") { await applyDie(Math.floor(Math.random() * 20) + 1, "digital_button"); continue; }
    if (pending) {
      const natural = Number(line);
      if (!Number.isInteger(natural)) { console.log("Enter the natural d20, or /roll."); continue; }
      await applyDie(natural, "manual_raw_die");
      continue;
    }
    const step = await play.playerText(state, line);
    show(step.lines, step.narration);
    if (step.status === "need_roll" && step.prompt) console.log(step.prompt);
    else printState();
    store.upsert(state);
  }
} finally {
  rl.close();
  store.close();
}

function loadState(): GameState {
  const id = arg("--game");
  if (id) { const saved = store.load(id); if (!saved) throw new Error(`No save ${id}`); return saved; }
  if (process.argv.includes("--continue")) {
    const rows = store.list();
    const saved = rows[0] ? store.load(rows[0].id) : undefined;
    if (!saved) throw new Error("No save to continue.");
    return saved;
  }
  return play.newGame();
}

async function applyDie(natural: number, method: "manual_raw_die" | "digital_button") {
  const step = await play.submitDie(state, natural, method);
  show(step.lines, step.narration);
  if (step.status === "need_roll" && step.prompt) console.log(step.prompt);
  store.upsert(state);
  printState();
}

function show(lines: string[], narration: string) {
  for (const line of lines) console.log(line);
  if (narration) console.log(`DM  ${narration}`);
}

function printState() { console.log(`\n${sceneView(state)}\n`); }
function inventory() {
  const aria = state.actors.find((actor) => actor.id === "aria");
  return aria?.inventory.length ? aria.inventory.map((item) => `${item.itemId} x${item.quantity}`).join(", ") : "Empty hands.";
}

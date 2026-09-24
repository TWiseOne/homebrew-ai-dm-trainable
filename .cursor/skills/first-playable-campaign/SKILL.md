---
name: first-playable-campaign
description: >-
  Builds the first playable AI RPG session and records structured turn traces
  for later DM training. Use when the user asks for a playable runtime, a first
  campaign or test walkthrough, a vertical slice, session loop, human dice,
  Resolution Broker wiring, save/reload, or capturing play data to train the
  model. Also use when work drifts into eval suites, teacher generation, or
  fine-tuning before a campaign can be played.
---

# First playable campaign

Get one human through a tiny revised-5e adventure, quit, reload, and continue. Every player turn must write a trace that can later become training data. Fine-tuning is out of scope until that walkthrough exists.

Read [reality.md](reality.md) before claiming a capability is implemented. Inspect the files. If the repo and this skill disagree, the repo wins, then update reality.md.

## Product rule

The model interprets, roleplays, and narrates. The engine owns dice, modifiers, DCs, attacks, damage, HP, inventory, initiative, location, scene, flags, and protected canon.

A human-controlled actor owns the player-facing die. The play client collects a digital roll or a raw natural die. The engine applies modifiers and decides the outcome. An engine-controlled actor is rolled by the engine. The model never invents either number, and narration must not ask "tell me your d20."

Keep `participants`, `controllers`, and `actors`. Do not restore `state.player`. Do not use `packages/ai/src/legacy-v05.ts` as the session driver.

## Definition of implemented

A capability is implemented only when the playable session calls it, a player action exercises it, and state or an event changes.

Otherwise label it `DESIGN`, `EXPERIMENTAL`, `EVALUATION`, `TRAINING`, `LEGACY`, or `UNUSED`. An eval scenario, a prompt, a type, a unit test, or a training row is not the runtime.

## Do this, in order

Copy the checklist and keep it current.

```
Walkthrough progress:
- [ ] Reality check against the repo
- [ ] Minimal session calls Ollama and the engine on one path
- [ ] Three-scene adventure authored as original campaign data
- [ ] Human roll and NPC roll both happen inside that path
- [ ] Save, quit, reload, state still correct
- [ ] One turn trace per player turn, schema in turn-trace.md
- [ ] User completes the acceptance play
- [ ] Traces summarized; nothing promoted to gold without the user
```

### 1. Reality check

Run `npm test` if dependencies are installed. That test proves check math, advantage, initiative, one weapon hit, SQLite save, and fact visibility. It does not prove a playable DM.

Leave these frozen: `npm run dm:training:*` teacher generation, `training/scripts/train_sft.py`, promoting `training/gold/generated/candidates.jsonl`. The SFT export under `training/datasets/exports/` is a 21-row smoke set. The 50 generated candidates are unreviewed; all preferred answers only narrate.

### 2. One session path

Add the smallest local play client on this PC. Ollama stays at `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434/v1`) using `DM_MODEL`. A terminal client is enough. Do not build a hosted site, voice, or a polished UI.

Target call order for each player input:

```
player text
  -> relevant context only (scene, visible facts, actors, encounter, recent events)
  -> model proposes fictional intent and a mode
  -> broker returns opaque legal options from current state
  -> if human roll: client asks for the natural die, outside DM prose
  -> if NPC roll: engine rolls
  -> ruleset resolves; events and state update
  -> model receives the authoritative result and narrates
  -> append the turn trace
```

The broker, ledger, and narration check must be called from this path. Hand-written options inside `evals/` do not count.

For this slice the broker may be narrow: conversation with no option, one environmental check, a player weapon attack, an NPC attack. Mandatory options cannot be waived by the model. Optional options apply only when they match the stated approach.

Use one fact shape on this path: `FactRecord` in `packages/campaign-engine/src/fact-ledger.ts`. `KnowledgeFact` on `GameState` is existing debt. Do not add a third fact model. Call `reviewNarrativeClaim` before a model proposal becomes a persistent fact. Ephemeral atmosphere may be narrated. A new interactable object may not.

Persist with `SaveStore`. Pin `rulesetId` `dnd-5e-2024` and `rulesVersion` `srd-5.2.1`. Do not expand `rules-dle` except to keep existing tests passing.

### 3. The adventure

Author an original three-scene campaign. No published-module text.

- Scene 1: talk to an NPC. No roll required for ordinary talk.
- Scene 2: one obstacle that needs an ability check. Human supplies the natural d20.
- Scene 3: one hostile creature. Initiative, player attack (human die), NPC attack (engine die), damage, defeat.
- Objective: obtain one object and return. That needs a scene change, an inventory or flag change, and a quest flag.
- Reload must restore scene, HP, inventory or flag, and facts.

Missing rules stay missing. Do not implement spells, conditions, or full action economy unless this adventure cannot be finished without a specific check. `create5eActor` still forces proficiency bonus +2; set bonus from level before the walkthrough if the character is above level 4, otherwise use a level 1 character and record the limit.

### 4. Capture traces

Write one JSON object per player turn to `data/play-traces/<gameId>.jsonl` using [turn-trace.md](turn-trace.md). The session writes the file as it plays. Do not reconstruct traces afterward from memory.

Traces are evidence. They are not gold. Do not copy them into `training/datasets/` or `dm-training/exports/` until the user marks turns good, bad, or corrected.

### 5. Acceptance play

The release is complete only after the user does this:

1. Start the play client.
2. Load the tiny adventure and the character.
3. Talk to the NPC in their own words.
4. Attempt the obstacle. Enter a natural d20 when the client asks. Confirm the engine total equals natural die plus modifier.
5. Fight. Enter their attack die. Watch the NPC die come from the engine.
6. Take the object and return.
7. Quit. Start again. Load the save. Scene, HP, object, and quest flag match the quit state.

Automated tests may accompany this. They do not replace it.

## When the user asks for something else

If they ask to train, generate teacher rows, or add an eval version, say the walkthrough is the milestone and point at the first unfinished checklist item. Collect traces first. Fine-tune only after a played session shows a failure that instructions, context, and the engine do not fix.

If they ask for a new subsystem (another ledger, broker rewrite, or ingestion tree), implement only the part this adventure calls.

Challenge work that does not change what the player can do on the next launch.

## Status language

Use these labels in progress reports: `IMPLEMENTED AND PLAYABLE`, `IMPLEMENTED BUT NOT IN PLAY PATH`, `PARTIAL`, `DESIGNED ONLY`, `EVALUATOR ONLY`, `TRAINING ONLY`, `LEGACY`, `MISSING`.

State what you ran. Do not claim `npm test` or a model call passed unless you executed it.

## After the walkthrough

Report: path of the trace file, turn count, how many turns waited on a human die, how many used an engine roll, how many the user would mark good, bad, or corrected. Stop there unless the user asks to promote reviewed rows.

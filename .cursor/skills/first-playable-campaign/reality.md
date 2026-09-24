# Parsed standing directive vs this repo

Inspect files before repeating any row. Update this file when a row changes.

The standing directive's immediate milestone is a playable runtime, not another training revision. The user's added requirement is that the first walkthrough record turn traces. That does not reactivate teacher generation or QLoRA.

## Section 36, checked

| Claim | Repo | Label |
|---|---|---|
| No complete playable session loop | `npm run play` runs The Storehouse Lantern: Ollama, broker, human d20, engine goblin dice, save/reload, and `data/play-traces`. The DM Lab still does not call the engine. A full playtest by the user is still required. | PARTIAL |
| Fact Ledger and Narrative Authority are not on the play path | `npm run play` reads `state.ledger` and calls `reviewNarrativeClaim` before a proposal can become a fact. The DM Lab still does not. | IMPLEMENTED AND PLAYABLE for this adventure only |
| Resolution Broker is not a runtime | `packages/session/src/broker.ts` builds options for The Storehouse Lantern and the play client calls it. Eval files still hand-write their own options. | IMPLEMENTED AND PLAYABLE for this adventure only |
| Mechanics are a partial 5e subset | `Dnd5eRuleset` resolves checks, saves, initiative, one weapon attack, rest. `create5eActor` sets `proficiencyBonus: 2`. | PARTIAL |
| Human-owned player dice are the product decision | The play client asks for Aria's natural d20, or `/roll`. The engine adds the modifier. Goblin initiative and attacks use the engine roller. `RandomDiceRoller` remains the default inside rules calls that are not on this path. | IMPLEMENTED AND PLAYABLE for this adventure |
| V6.5 "engine rolls for the player" is historical | `apps/dm-eval-v6/src/v65.ts` still says the engine rolls and the DM must never ask. Do not treat that sentence as the product rule. | EVALUATION, stale policy |
| SFT export is a smoke set | `training/datasets/exports/manifest.json` is 21 examples, 17 train / 4 validation. | TRAINING ONLY |
| Teacher candidates are not gold | `training/gold/generated/candidates.jsonl` has 50 rows: 35 `informational_rules`, 8 project, 7 behavioral. All preferred `mode` values are `narrate`. Zero `resolutionChoice`. No `training/gold/review/review.jsonl`. | TRAINING ONLY |
| Do not fine-tune while the runtime is built | `training/scripts/train_sft.py` and `training/configs/sft-qwen3-8b-4090.yaml` exist and expect CUDA Linux. Leave them unused. | TRAINING ONLY |
| V0.5 driver is not the runtime | `packages/ai/src/legacy-v05.ts` imports missing `mcp-server` and reads `state.player`. The foundation test asserts `state.player` is undefined. | LEGACY |

`awaiting_player_roll` appears in `training/scripts/`, not in `packages/`.

`GameEventType` includes `SCENE_ENTERED`, `FACT_REVEALED`, and `ITEM_GAINED`. `CampaignEngine` never emits them.

There is no `imports/` campaign tree.

## Directive sections that are design until the session calls them

| Sections | Topic | Current label |
|---|---|---|
| 7, 8, 9 | Session order, opaque broker ids, mandatory vs optional | DESIGN. Eval JSON simulates it. |
| 10, 11 | Human die UI vs engine NPC rolls | DESIGN. Follow this, not the V6.5 prompt. |
| 12 | Participants, controllers, actors | PARTIAL. Domain types exist. Demo creates one human. |
| 13 | `dnd-5e-2024` / SRD 5.2.1 primary; DLE is regression | IMPLEMENTED as ruleset classes. DLE must not grow for the slice. |
| 14 | Generic action / effect model | DESIGNED ONLY. Do not build it for scene 1. |
| 15 | Campaign vs save vs character | PARTIAL. `CampaignDefinition` and `SaveStore` exist. No character library. |
| 16, 24 | Source vs canon vs runtime; `imports/` ingestion | DESIGNED ONLY. First adventure is original data written into the campaign format. |
| 17, 18 | Knowledge split; one fact model | PARTIAL. Two shapes: `KnowledgeFact` and `FactRecord`. Play path uses `FactRecord` only. |
| 19 | Ephemeral prose vs persistent facts | PARTIAL. `reviewNarrativeClaim` is unused by play. |
| 20, 21, 22 | Agency, style, informative vs difficulty | TRAINING / EVALUATION text in `dm-experience/` and `dm-training/`. Not a play setting that changes a session. |
| 23 | Context selection, not a full dump | MISSING on the play path. |
| 25, 26, 27 | Play traces, then review, then maybe train. Teacher is not the rules authority. | TRAINING policy. Traces start with the first session. Promotion stays manual. |
| 28 | Evaluator is not production | Still true. |
| 33 | Zip layout `ai-rpg-v0.6/` with no extra wrapper | Apply only when cutting a package. |

## Training data that must not be treated as the campaign

- `evals/**` and `data/eval-results/**` stay out of training.
- Commercial adventure text stays out of the repo and out of SFT.
- External `dnd_dm_v3` rows are behavioral hints only. Do not copy their tool syntax.
- SRD anchor pairs are rules evidence. The 50-candidate file already shows them rewritten as fake DM lines. Do not train on that file as it stands.

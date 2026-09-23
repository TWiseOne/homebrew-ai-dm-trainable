# DM Lab V6.3 — Fact Ledger + Resolution Broker

V6.3 moves the next authority boundary out of the model. V6.2 showed that the Resolution Broker is a better mechanical boundary; the 8B/14B/30B comparison then exposed unsupported narrative specificity as the next bottleneck.

## Findings incorporated from qwen3:14b

The 14B scored 100% on the V6.2 single-turn suite but only 77.8% craft on the multi-turn suite. Manual review matters more than the aggregate: it invented letter contents, assumptions about Harbormaster signing practice and stolen seals, extra consequences on Mira's favor, bridge damage, a rusted key, and clue-like details. These outputs passed several old regex checks, demonstrating that the evaluator was under-detecting narrative authority violations.

V6.3 therefore treats established narrative truth like mechanics: it has provenance and an authority boundary.

## Fact Ledger

Facts carry source, visibility, protection, confidence and provenance. Protected/established facts are authoritative. Flexible facts define safe areas for improvisation. DM-only facts must not enter player context.

The included `FactLedger` is intentionally small: it proves the data contract and visibility-aware retrieval seam. It is not yet a production semantic retriever.

## Narration vs fact proposals

Harmless sensory presentation may be narrated directly if it cannot change a decision. New persistent or decision-relevant world facts must be emitted as `factProposals`; they are not true until a later validator/campaign layer accepts them. A proposal may only elaborate a player-visible flexible fact and must cite its basis fact IDs.

This prevents a failed search from silently generating a rusted key or turning scratches into evidence that specifically matches a ledger.

## Mandatory vs optional broker choices

V6.3 distinguishes mandatory triggered mechanics from optional approaches. A mandatory authored hazard cannot be waived by the DM because a player's mitigation sounds plausible. An optional broker choice cannot be silently substituted for a different player approach.

## Evaluation

`v6.3-scenarios.json` focuses on the observed failure classes: unsupported letter contents, epistemic overreach, mandatory hazards, silent approach substitution, promise payoff without new cost, invented clues after failure, hidden-fact leakage, safe sensory creativity, controlled flexible proposals and serious-scene restraint.

The preference corpus contains new project-authored pairs derived from observed V6.2 model failure patterns. They are abstractions, not copied model prose.

## Run

```bash
npm install
npm test
npm run dm:corpus:check
npm run dm:v6.3 -- --model ai-rpg-dm:latest --runs 1
```

Use the 8B production target first. Do not tune to V6.3 results. Keep the scenarios as holdout evaluation material; preference examples are separately authored abstractions.

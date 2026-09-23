# DM Lab V3 — Experience Guidance and 4090 Model Ladder

V3 tests whether a smaller local DM can close the gap to a larger model through selective DM-craft guidance rather than fine-tuning.

## Experiment design

V2's three axes remain unchanged: semantic DM reasoning, strict application-contract adherence, and experience guardrails. V3 adds an optional retrieved guidance layer and a holdout suite. Guidance is selected by scenario category from generic principles and analogous preference examples; it does not contain the eval scenario answers.

Run the original 20-scenario baseline unchanged:

```bash
npm run dm:eval -- --model ai-rpg-dm:latest --runs 3
```

Run the same suite with guidance:

```bash
npm run dm:eval -- --model ai-rpg-dm:latest --runs 3 --guidance
```

Then test generalization on scenarios not represented verbatim in the guidance corpus:

```bash
npm run dm:eval -- --model ai-rpg-dm:latest --runs 3 --suite holdout --guidance
```

For a model-size ladder on a 24 GB RTX 4090, compare 8B, 14B and 30B with the same settings. Qwen3 14B is the first middle candidate to test; do not assume it wins until measured on this workload.

```bash
ollama pull qwen3:14b
npm run dm:eval -- --model qwen3:14b --runs 3
npm run dm:eval -- --model qwen3:14b --runs 3 --guidance
npm run dm:eval -- --model qwen3:14b --runs 3 --suite holdout --guidance
```

V3 records mean response latency as well as quality. Compare quality and latency together; a production DM needs adequate reasoning/contract reliability without consuming all GPU capacity needed by NPC, memory, builder or visual roles.

## Interpretation

A guidance improvement on both core and holdout is evidence of generalizable instruction/context value. Improvement only on core is a warning for overfitting. If 8B remains materially behind 14B after guidance, 14B becomes a strong DM candidate. If 8B closes the gap, prefer the smaller model and reserve GPU budget for other roles. Fine-tuning remains a later step after the guidance experiment.

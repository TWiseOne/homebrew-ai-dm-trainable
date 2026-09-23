# AI RPG V0.6 — DM Lab V6.5

V6.5 is the **frozen pre-training foundation** for the AI DM.

The authority model is now fixed around three boundaries: the Resolution Broker owns mechanics, the Fact Ledger owns truth/visibility, and Narrative Authority controls what the DM may add in presentation. Missing authored context is not permission to invent.

## Validate

```bash
npm install
npm test
npm run dm:corpus:check
npm run dm:training:export
```

## Capture the final untrained 8B baseline

```bash
npm run dm:v6.5 -- --model ai-rpg-dm:latest --runs 1
```

Keep the resulting V6.5 JSON and `dm-training/exports/manifest.json`. Do not train on anything under `evals/` or `data/eval-results/`.

See `docs/DM-LAB-V6.5.md` for the freeze and training policy.

## Training V1

The V6.5 DM foundation is frozen. Training-stage assets live under `training/`. See `training/README.md` and `training/recipes/TRAINING-V1.md`. The frozen untrained V6.5 baseline is retained under `training/reports/baselines/` for comparison only and is excluded from dataset generation.

# DM Lab V6.5 — Frozen Pre-Training Foundation

V6.5 is the final capability-foundation release before model training begins.

## Frozen architecture

1. Resolution Broker owns legal mechanical resolution choices.
2. Fact Ledger owns established/protected/flexible truth and visibility.
3. Narrative Authority limits what the DM may add while presenting that truth.
4. Context Manager treats unavailable authored information as missing context, not fiction to fill.
5. Engine results are authoritative; the DM never rerolls or rewrites them.

From V6.5 onward, improve behavior primarily through training data, retrieval/context quality, deterministic validation, and evaluator quality. Change these authority boundaries only for a demonstrated architectural defect.

## Training-readiness additions

- Behavioral dimension taxonomy under `dm-training/annotations/`.
- Provenance/training policy that explicitly excludes benchmarks and eval outputs from training.
- SFT and DPO export command.
- Frozen V6.5 benchmark with scenarios that are not exported into training data.
- Generalized preference examples derived from observed failure *patterns*, using different entities and situations rather than copying benchmark answers.

## Baseline workflow

```bash
npm install
npm test
npm run dm:corpus:check
npm run dm:training:export
npm run dm:v6.5 -- --model ai-rpg-dm:latest --runs 1
```

Archive the V6.5 result JSON and `dm-training/exports/manifest.json` before training. They are the pre-training baseline.

## Training order

Start with a small LoRA/QLoRA experiment against the 8B production target. Prefer SFT on high-quality positive behavior examples first; use preference optimization only after the SFT baseline is measured. Keep V6.5 benchmark prompts out of all training files.

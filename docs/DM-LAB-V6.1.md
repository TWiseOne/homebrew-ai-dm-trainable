# DM Lab V6.1 — Training Readiness Correction

V6.1 is a focused correction after the first V6 continuity comparison. It does not start model training yet.

## Why V6.1 exists

V6 showed useful DM-quality differences, but also allowed contradictory structured responses: narration could carry a mechanical capability even when the model's own reasoning said no roll was needed. It also over-penalized a restrained serious-state narration because `resultContext` was `none` rather than `state`.

V6.1 makes the measurement instrument stricter before multi-turn evaluation or corpus-scale preference generation.

## Response contract

The response now uses a single nullable `mechanic` object rather than independent capability/resolution fields.

- `mode: narrate` => `mechanic` must be null.
- `mode: resolve` => `mechanic` must be present and name an allowed capability.
- `mode: reject` => normally `mechanic` is null.
- `resultContext` describes only an already-authoritative success, failure, or state.

The evaluator explicitly reports four axes: protocol, contract, authority, and craft.

## New V6.1 checks

The 12-scenario suite includes the 10 continuity/craft cases plus two positive mechanical controls. It checks for unnecessary mechanics, unsupported invention, continuity/payoff, reminder quality, failure-forward play, arc preservation without railroading, tone restraint, and correct use of real checks/saves.

The V6 observations also seed three project-authored preference pairs: promise payoff vs invented obstacle, restrained grief vs unsupported supernatural embellishment, and known-clue reminder vs unnecessary roll. These are corpus seeds, not training data copied from a model response.

## Run

```bash
npm install
npm test
npm run dm:corpus:check

npm run dm:eval:v6 -- --model ai-rpg-dm:latest --runs 1 --suite v6.1 --guidance
npm run dm:eval:v6 -- --model qwen3:30b --runs 1 --suite v6.1 --guidance --timeout-ms 300000
```

Results are written to `data/eval-results/dm-eval-v6.1-*.json`.

Do not run repeated trials yet. Compare one 8B and one 30B run first. If the schema/evaluator behaves correctly, the next step is multi-turn mini-scenes.

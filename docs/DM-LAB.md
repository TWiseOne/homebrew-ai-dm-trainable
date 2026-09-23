# V0.6 DM Lab — Ollama evaluation

This harness tests whether the configured DM model makes safe, useful RPG decisions before it is allowed to drive the live game engine. It does not grade prose style yet; it grades decision/tool behavior.

## Quick start on Rocky Linux 9

From the V0.6 project directory:

```bash
npm install
npm test
cp -n .env.example .env
```

Edit `.env` so it points at Ollama. For Ollama on the same Rocky host:

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_API_KEY=ollama
DM_MODEL=ai-rpg-dm:latest
DM_EVAL_RUNS=3
DM_EVAL_TEMPERATURE=0.2
```

Confirm Ollama can see the model:

```bash
ollama list
ollama ps
```

Run the original one-prompt smoke test:

```bash
npm run ollama:test
```

Run the DM Lab suite:

```bash
npm run dm:eval
```

The default suite contains 20 scenarios and runs each 3 times (60 model decisions). Results are printed by category and the complete model outputs are saved under `data/eval-results/`.

A non-zero exit code means one or more evaluation cases failed. This is intentional so the suite can later be used in CI. A failed evaluation does not mean Ollama or the application crashed.

## More robust runs

Five runs per scenario:

```bash
npm run dm:eval -- --runs 5
```

Ten runs per scenario (recommended baseline once the quick run works):

```bash
npm run dm:eval -- --runs 10
```

Test only one category:

```bash
npm run dm:eval -- --scenario knowledge --runs 10
npm run dm:eval -- --scenario authority --runs 10
```

Test one exact scenario:

```bash
npm run dm:eval -- --scenario hide-procedure --runs 10
```

Compare another model without editing `.env`:

```bash
npm run dm:eval -- --model qwen3:14b --runs 5
```

Keep temperature fixed when comparing models or prompts. The current recommended evaluation temperature is `0.2`.

## What is tested

The initial corpus covers routine actions that should not cause rolls, ability/skill checks, saving throws, attacks, action/resource rejection, impossible actions, automatic discoveries, canon protection, NPC knowledge boundaries, authoritative engine results, off-script agency, social adjudication, state narration, and a Hide decision.

Each scenario declares the expected semantic DM decision and, where applicable, expected capability, ability and skill. The harness also detects some obvious invented-roll language. The saved JSON preserves every raw response so failures can be reviewed rather than hidden behind a score.

## Important limitation

This is a behavioral contract test, not yet a complete D&D rules conformance suite. It tests whether the model chooses the right kind of engine operation. The deterministic rules engine remains responsible for actual mechanics.

## Turning failures into DM-improvement data

Do not fine-tune immediately. First run a baseline and keep the JSON report. Review failures and classify them. Add or improve short DM principles/examples, run exactly the same evaluation again, and compare the result. Only persistent failures that prompting/context cannot reliably fix should become candidates for LoRA/preference training.

The scenario file is `evals/dm-scenarios.json`. Add new cases whenever real play exposes a bad DM behavior. This becomes the regression suite for DM quality.

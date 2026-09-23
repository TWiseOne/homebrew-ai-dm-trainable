# DM Lab V2

DM Lab V2 separates **DM reasoning**, **API contract adherence**, and basic **experience guardrails**. This avoids treating a correct DM decision expressed with the wrong API vocabulary as if the reasoning itself were wrong.

## Install on Rocky Linux 9

From the extracted `ai-rpg-v0.6` directory:

```bash
node --version
npm --version
npm install
npm test
```

Node 22+ is required.

Copy `.env.example` to `.env` if needed and configure Ollama:

```dotenv
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_API_KEY=ollama
DM_MODEL=ai-rpg-dm:latest
DM_EVAL_RUNS=3
DM_EVAL_TEMPERATURE=0.2
```

If Ollama is remote, retain the working host URL from your existing installation.

## Baseline run

```bash
npm run dm:eval
```

The progress characters mean:

- `.` semantic reasoning and strict contract both passed
- `c` semantic reasoning passed but strict API contract failed
- `F` semantic reasoning failed

The report has three axes:

1. **DM reasoning / semantics** — did the model choose the right kind of adjudication?
2. **Contract adherence** — did it use the exact decision/capability/ability/skill vocabulary required by the app?
3. **Experience guardrails** — initial checks for useful narration and authority violations. This is intentionally only a starter metric; subjective DM quality will be expanded with a curated preference corpus.

A non-zero exit code means at least one semantic or contract test failed. It does not mean the harness crashed.

## Targeted runs

```bash
npm run dm:eval -- --scenario checks --runs 5
npm run dm:eval -- --scenario authority --runs 5
npm run dm:eval -- --scenario hide-procedure --runs 10
```

## Model comparison

Keep temperature and run count identical:

```bash
npm run dm:eval -- --model ai-rpg-dm:latest --runs 5
npm run dm:eval -- --model qwen3:14b --runs 5
```

## Results

Full JSON is written to:

```text
data/eval-results/dm-eval-v2-*.json
```

Preserve these files. They will become the baseline for prompt/context improvements and, later, any LoRA/preference-training experiments.

## Recommended first run

Do not run 200 cases yet. Start with the default 60 decisions:

```bash
npm run dm:eval
```

Send the complete summary and diagnostics back for analysis. Do not change the model, Modelfile, temperature, or system prompt before this baseline is captured.

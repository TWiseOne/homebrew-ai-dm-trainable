# DM Lab V4.1

V4.1 is a resilience patch for the V4 evaluator. It does not change the scenario corpus or scoring rules.

## Changes
- Explicit per-request timeout: `DM_REQUEST_TIMEOUT_MS`, default 180000 ms; CLI `--timeout-ms` overrides it.
- Retry count: `DM_REQUEST_ATTEMPTS`, default 2; CLI `--attempts` overrides it.
- A timeout/transport failure no longer crashes the complete evaluation.
- `r` in progress output means a request is being retried; `T` means all attempts failed for that scenario/run.
- Results are checkpointed after every scenario/run to `data/eval-results/dm-eval-v4.1-*.json`.
- Transport failures are recorded separately and excluded from DM quality denominators. The run still exits non-zero when transport errors or quality failures exist.

## Recommended V4.1 behavioral comparison

```bash
npm run dm:eval -- --model ai-rpg-dm:latest --runs 1 --suite behavioral --guidance
npm run dm:eval -- --model qwen3:30b --runs 1 --suite behavioral --guidance
```

For an unusually slow local setup:

```bash
npm run dm:eval -- --model qwen3:30b --runs 1 --suite behavioral --guidance --timeout-ms 300000 --attempts 2
```

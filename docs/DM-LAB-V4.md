# DM Lab V4 — Behavioral Evaluation

V4 keeps the V3 guidance experiment and adds a broader behavioral suite designed to measure whether a DM response obeys invariants, not merely whether it selected one expected enum.

## Four axes

1. **DM decision** — appropriate high-level decision and check/save metadata.
2. **Engine contract** — exact application-facing decision/capability schema.
3. **Safety / authority** — no forbidden knowledge/canon/state leakage, no invented authoritative results, and required authoritative facts preserved.
4. **Experience** — player-facing narration exists, remains concise, and does not violate the behavioral safety checks.

## Suites

- `core`: the V2/V3 20-scenario regression suite.
- `holdout`: the original V3 8-scenario holdout.
- `behavioral`: 40 new, diverse cases covering routine judgment, checks, saves, combat, temporary resource rejection, authoritative outcomes, NPC knowledge, canon, agency, social play, Hide, and revealed-state preservation.
- `all`: all suites combined.

The behavioral suite is intended primarily as **one run per diverse scenario** during rapid development. Diversity is more valuable than repeated sampling at this stage. Core may still be run three times for continuity with the V2/V3 baseline.

## Guidance

`--guidance` still retrieves only category-relevant principles and analogous preference examples. It does not contain the behavioral scenario answers.

## Progress legend

- `.` decision + contract + safety pass
- `c` decision passes, contract fails
- `s` safety/authority invariant fails
- `F` DM decision fails

## Recommended edge-model experiment

```bash
npm run dm:eval -- --model ai-rpg-dm:latest --runs 3 --guidance
npm run dm:eval -- --model qwen3:30b --runs 3 --guidance
npm run dm:eval -- --model ai-rpg-dm:latest --runs 1 --suite behavioral --guidance
npm run dm:eval -- --model qwen3:30b --runs 1 --suite behavioral --guidance
```

Do not introduce the middle model yet. V4 is designed to refine the 8B efficiency boundary against the 30B reference boundary.

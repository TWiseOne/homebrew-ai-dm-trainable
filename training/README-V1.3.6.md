# DM Training Pipeline V1.3.6

V6.5 application architecture remains frozen. V1.3.6 is a training-data composition correction based on V1.3.5 calibration.

## Core change

V1.3.5 proved the sanitizer can distinguish behavioral themes, but the source itself is heavily skewed toward unresolved mechanical results. V1.3.6 stops forcing `dnd_dm_v3` to be a general DM curriculum.

- SRD anchor pairs: rules evidence and informational rules behavior.
- `dnd_dm_v3`: capped, sanitized behavioral inspiration only. It is never rules authority.
- project-native seeds: product-specific roll ownership, resolution lifecycle, agency, continuity, epistemic discipline, failure-forward behavior, creative permission, informative DM and narrative authority.

Default 2,000-record target starts from 65% SRD / 20% external behavior / 15% project-native, but source suitability outranks quotas. Per-theme caps can reduce the external-behavior contribution; shortages are filled from SRD/project-native rather than duplicating weak themes.

## Human roll contract

Human-controlled player-facing rolls remain pending until the controlling human initiates the digital roll or enters a raw physical/external die. The engine applies modifiers/rules and determines the outcome. The AI DM never fabricates or silently resolves the human die. For AI-controlled actors, the AI DM may choose fictional intent/tactics while the deterministic engine owns mechanical resolution and dice.

## Historical objects

Carry forward only `training/cache/` and `training/normalized/` from V1.3.5. Rebuild curation, portable seeds, project-native seeds, curriculum, authority envelopes, generated candidates, validation queues and human decisions. Do not copy prior `training/curation/`, `training/gold/`, generated/review/rejected files, or human decisions.

## Pipeline

```bash
python training/scripts/normalize_sources.py
python training/scripts/curate_candidates.py
python training/scripts/sanitize_dm_behavior.py
python training/scripts/build_project_native_seeds.py
python training/scripts/build_curriculum.py --target 2000
python training/scripts/build_authority_envelopes.py
python training/scripts/generate_gold_candidates.py --model qwen3:30b --limit 50 --sampling stratified
python training/scripts/validate_gold_candidates.py
```

## Regression

```bash
python training/scripts/run_v136_regression.py
```

This checks Python compilation, SRD lookup classification, foreign-system-text exclusion, external theme caps, the observed V1.3.5 skew case, project-native coverage, stratified three-source calibration sampling, human-roll lifecycle wording, foreign-runtime exclusion, and NPC-intent/engine-resolution separation.

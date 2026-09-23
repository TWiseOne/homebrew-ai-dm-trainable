# AI RPG DM Training

Current pipeline: **V1.3.3 Human-Roll Authority + Portable Behavior Calibration**. Application foundation remains **V6.5 frozen**.

V1.3.3 adds four calibration rules: human-controlled actors own their dice; SRD lookups are separated from in-fiction resolutions; dnd_dm_v3 is portable behavioral inspiration rather than a foreign runtime protocol; and scenario facts distinguish established/engine/flexible authority.

Calibration run:

```bash
python training/scripts/normalize_sources.py
python training/scripts/curate_candidates.py
python training/scripts/build_curriculum.py --target 2000
python training/scripts/build_authority_envelopes.py
python training/scripts/generate_gold_candidates.py --model qwen3:30b --limit 50 --sampling stratified
python training/scripts/validate_gold_candidates.py
```

Do not promote or scale to 500 until the fresh 50-record calibration has been independently inspected. See `training/recipes/TRAINING-V1.3.3-HUMAN-ROLL-AUTHORITY.md`.

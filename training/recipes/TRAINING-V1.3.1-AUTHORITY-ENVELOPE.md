# Training V1.3.1 — Authority Envelope Calibration

V6.5 application architecture remains frozen. This release changes only the training-data generation pipeline.

## Why
V1.3 calibration showed the teacher could invent context rules/results and then treat its own inventions as authority. V1.3.1 prevents that by constructing an immutable authority envelope before teacher generation.

## Contract
- SRD source passage remains grounding evidence; teacher cannot add rules.
- Foreign DM corpus is behavioral inspiration only; foreign tools are never target API.
- Broker option IDs are precomputed before teacher generation.
- Authoritative result is `null` and `resultStatus` is `unresolved` during calibration generation.
- Teacher may author only flexible fictional setup facts.
- Resolve choices must exactly match a supplied opaque broker ID.
- Narrate/reject choices must be null.
- Every generated candidate remains review-only until explicit human acceptance.

## Calibration workflow
1. Copy `training/cache` and `training/normalized` from V1.3 (or V1.2).
2. Run normalization/curation/curriculum as needed.
3. `python training/scripts/build_authority_envelopes.py`
4. Archive/delete old V1.3 generated/review files before generating.
5. `python training/scripts/generate_gold_candidates.py --model qwen3:30b --limit 50`
6. `python training/scripts/validate_gold_candidates.py`
7. Inspect validation report plus accepted and rejected samples. Do not scale until calibration is reviewed.

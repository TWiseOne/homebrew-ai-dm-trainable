# Training V1.3.2 — Semantic Calibration + Human Review

V6.5 application architecture remains frozen. V1.3.2 changes only the training-data generation/review pipeline based on the V1.3.1 50-record calibration.

## Lessons incorporated

1. **Informational rules lookup is not a mechanical resolution.** Obvious identity/reference questions receive no broker option and must be narrated from supplied rule evidence.
2. **Source evidence is the complete rules authority for a generated candidate.** The teacher is explicitly forbidden from adding DCs, modifiers, exceptions or mechanics-bearing setup premises.
3. **Source identity must survive transformation.** Named spells/features/items/rules may not silently become another mechanic.
4. **Unknown remains unknown and engine results remain unresolved.** The V1.3.1 authority envelope is retained and strengthened.
5. **Preference contrasts must be material.** Trivial wording/format/synonym contrasts are not useful training data.
6. **Foreign-tool detection is contextual.** We inspect API-bearing response fields instead of rejecting a record merely because ordinary scenario prose contains a tool-like word.
7. **Calibration is representative.** `--sampling stratified` deterministically samples according to the full curriculum's source proportions instead of taking the first N records.
8. **Structural pass is not semantic gold.** Validator warnings surface mechanics-bearing flexible setup and weak contrasts, while a terminal reviewer records Good/Bad/Edit decisions. Gold promotion still requires explicit human acceptance.

## Calibration workflow

```bash
python training/scripts/build_curriculum.py --target 2000
python training/scripts/build_authority_envelopes.py
rm -f training/gold/generated/candidates.jsonl \
      training/gold/review/review.jsonl \
      training/gold/rejected/reject.jsonl \
      training/gold/reports/validation-report.json
python training/scripts/generate_gold_candidates.py --model qwen3:30b --limit 50 --sampling stratified
python training/scripts/validate_gold_candidates.py
cat training/gold/reports/authority-envelope-report.json
cat training/gold/reports/validation-report.json
wc -l training/gold/generated/candidates.jsonl training/gold/review/review.jsonl training/gold/rejected/reject.jsonl
python training/scripts/review_candidates.py
```

Use `python training/scripts/review_candidates.py --include-rejected` to inspect both validator-review and hard-rejected records. Reviewer keys are Good, Bad, Edit-needed, Skip, Previous and Quit.

## Scale gate

Do not launch the full 2,000 teacher run from validator pass rate alone. First inspect the stratified 50. Target at least ~90% semantic/human survival among validator-accepted records, with no recurring authority/source-grounding failure. If clean, scale to 500 and spot-check again before the remainder.

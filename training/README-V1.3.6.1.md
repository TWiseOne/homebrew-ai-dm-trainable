# DM Training Pipeline V1.3.6.1

Narrow regression fix over V1.3.6. V6.5 application architecture remains frozen.

## Fix
`dnd_dm_v3` classification may use source excerpts internally, but verbatim `evidenceSignal` text is stripped at the authority-envelope boundary. The 30B teacher receives only normalized portable lesson text, provenance metadata, source signals and forbidden-semantics policy.

## Regression gate
`python training/scripts/run_v136_regression.py` compiles scripts/tests, runs unit regressions, rebuilds project-native seeds, and—when `training/gold/prompts/authority-envelopes.jsonl` exists—scans the final teacher-visible artifact for foreign runtime tags, known foreign tool names, last-turn protocol, coordinate-protocol phrases, and coordinate triples.

After rebuilding authority envelopes, a matching foreign-runtime leak is a hard stop before teacher generation.

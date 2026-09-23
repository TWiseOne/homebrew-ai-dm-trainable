# DM Training Pipeline V1.3.5

V6.5 application architecture remains frozen. V1.3.5 changes only training-data preparation.

## Lessons incorporated

- SRD rules lookups remain informational unless the source actually expresses an in-fiction action.
- Human-controlled player-facing rolls remain pending until the human initiates the app die or enters a raw die; the deterministic engine applies modifiers/rules and resolves the outcome.
- AI-controlled NPC/monster intent may be chosen by the DM model, but engine mechanics and dice remain deterministic-engine authority.
- Raw `dnd_dm_v3` runtime/tool semantics never reach the teacher.
- Behavioral sanitization now excludes system/tool-schema text from theme detection and assigns only 1–3 evidence-supported portable lessons per source record.
- Behavioral curriculum selection is balanced across primary themes so human-roll examples cannot dominate merely because the source corpus repeats roll language.
- Calibration sampling is stratified by source and, within `dnd_dm_v3`, by behavioral theme.
- Pending human rolls should yield to the UI roll interaction rather than training repetitive “tell me your d20” dialogue.

## Carry-forward rule

Carry forward only `training/cache/` and `training/normalized/` from V1.3.4. Rebuild curation, portable seeds, curriculum, authority envelopes, generated candidates, validation queues and human decisions. Do not copy prior `training/gold/`, `training/curation/`, generated/review/rejected files, or human decisions.

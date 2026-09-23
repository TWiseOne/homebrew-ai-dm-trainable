# Training V1.3.3 — Human-Roll Authority

Application architecture remains V6.5 frozen. This release changes the training-data pipeline, not runtime persistence or rules implementation.

## Lessons incorporated

1. **Human-owned player dice.** For a human-controlled actor, the human initiates the digital die or enters the raw result from physical/external dice. The AI never invents that result. The deterministic engine applies modifiers/rules and determines the outcome. NPC/monster rolls remain engine-owned by default.
2. **Rules lookup is not resolution.** SRD anchor questions default to informational unless they explicitly express an in-fiction action requiring resolution. A rules lookup receives no broker option.
3. **Portable behavior extraction.** dnd_dm_v3 evidence may teach agency, pacing and authority discipline, but not foreign tools, XML tags, coordinates, turn-reset procedures or source-runtime lifecycle.
4. **Fact authority.** Scenario facts are `established`, `engine`, or `flexible`. Mechanics-bearing facts may not be teacher-authored as `flexible`.
5. **Unresolved means unresolved.** Teacher cannot author rules, engine results, hidden truth, or a human die result.

## Calibration gate

Generate only 50, validate, archive, and inspect. Do not promote or generate 500 yet.

# DM Lab V6 — Training Readiness

V6 moves the lab from protocol hardening toward DM-craft measurement and corpus preparation.

## Key architectural change
The DM response is compositional. `mode` describes what the DM does (`narrate`, `resolve`, `reject`). Knowledge, canon, agency, engine authority and continuity are independent constraints. This prevents good narration from failing merely because an invariant such as `respect_knowledge` was treated as a competing action label.

## DM assistance mode
`DmPreferences.assistanceMode` is independent of `difficulty`:
- `standard`: no extra reminder hints simply to assist the player.
- `informative`: surface relevant facts the player/character already knows, connect useful earlier threads, and gently remind where appropriate. It must never reveal unknown facts, solve mysteries, change mechanics, or lower difficulty.

Recommended defaults: `narration=succinct`, `humour=opportunistic`, `failureStyle=failure-forward`.

## Training readiness
V6 adds project-authored principles/preferences and provenance metadata. User-supplied transcripts are reference sources for craft observation; transcript wording is not redistributed or automatically converted into training targets. Training examples should be authored/annotated with provenance and separated from holdout evaluation.

## First V6 suite
The continuity suite tests memory hints, informative on/off behavior, failure-forward play, story-arc preservation without railroading, callbacks to promises, situational humour, serious-tone restraint, and player agency.

# DM Lab V6.4 — Final Capability Foundation

V6.4 freezes the pre-training DM capability boundary. Future work should prefer data, training, retrieval, and validator improvements over changing the model-facing authority architecture unless a genuine correctness defect is found.

## Three authorities
1. **Resolution Broker** owns legal mechanical resolution and mandatory/optional applicability.
2. **Fact Ledger / Context Manager** owns established truth, provenance, visibility, uncertainty, and relevant retrieval.
3. **Narrative Authority** treats model prose as candidate presentation. Persistent/interactable facts require grounded authority or a validated proposal from a flexible fact.

## Frozen model contract
- `narrate`: narration + optional fact proposals; no resolution choice.
- `resolve`: exactly one supplied resolution choice + narration/proposals.
- `reject`: narration + optional proposals; no resolution choice.
- The model never supplies dice, DCs, abilities, skills, outcomes, or database mutations.
- The model never tells the player to roll after selecting a resolution; the engine resolves and returns the result.

## Missing context
Not supplied is not nonexistent. If authoritative content is required to answer (for example a readable letter whose text was not retrieved), the application should retrieve it rather than invite the DM to fill the gap.

## Narrative claims
Ephemeral presentation may be emitted directly. Interactable/persistent details, evidence, routes, NPCs, possessions, relationships, architecture, supernatural effects, and consequences are world-state claims. They require established grounding or an accepted flexible-world proposal.

## Training readiness
`dm-training/preferences/starter.json` now includes project-authored preference pairs derived from observed 8B/14B/30B failures through V6.3.3. Train behavior, not campaign facts. Campaign knowledge belongs in retrieval/Fact Ledger, mechanics in deterministic rules/Broker.

## Gate
Run `npm test`, `npm run dm:corpus:check`, then `npm run dm:v6.4 -- --model ai-rpg-dm:latest --runs 1`.

# DM Lab V6.2 — Resolution Broker & Multi-turn Readiness

## Architectural decision
V6.2 replaces the proposed free-form `action -> mechanic` mapper with a Resolution Broker.

The deterministic engine/campaign layer compiles the current state into zero or more **legal resolution options**. The DM model may:
- narrate without resolution,
- reject an impossible/inapplicable approach, or
- select one supplied resolution option by opaque ID.

The model does **not** emit ability, skill, DC, capability, roll, or result fields.

Why this is stronger:
1. Authored rules/hazards can produce one exact option.
2. Routine actions produce zero options, preventing invented rolls.
3. Ambiguous creative play can expose several engine-validated alternatives, preserving DM judgment.
4. The broker can evolve with each ruleset without expanding the model schema.
5. Invalid mechanical combinations become structurally impossible at the AI boundary.
6. Authoritative results return as state for narration; the model no longer echoes `resultContext`.

This matches the SRD 5.2.1 split between rules-defined mechanics (including tool entries with defined abilities/Utilize rules) and contextual GM adjudication.

## Production flow
Player language -> DM intent/fiction interpretation -> Resolution Broker -> legal resolution options -> DM selects option or narrates/rejects -> deterministic engine resolves -> authoritative result -> DM narrates.

For an authored hazard, the broker may provide only `res_poison_save`. For a creative jammed-door approach, it may provide validated force/careful options. The DM selects an option; it never constructs a raw check.

## V6.2 suites
`v6.2`: 10 focused broker/authority/craft cases.

`v6.2-multiturn`: 3 starter mini-scenes covering promise continuity, failure-forward routing, and Informative-mode thread recall. This is intentionally small; expand only after the broker boundary scores cleanly.

## Training readiness
Do not fine-tune to compensate for broker/contract failures. First require stable protocol, no invented resolution IDs, strong authority preservation, and clean multi-turn continuity. Preference training remains focused on DM craft rather than D&D mechanical serialization.

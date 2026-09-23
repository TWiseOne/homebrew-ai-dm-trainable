# DM Lab V5 — Protocol-Hardened Behavioral Evaluation

V5 incorporates the V2–V4.1 findings. It keeps the deterministic-engine authority boundary and separates five concerns:

1. **Protocol** — did the model produce machine-parseable structured output?
2. **DM decision** — was the intended DM course of action semantically appropriate?
3. **Engine contract** — did the response use the exact application taxonomy/capability schema?
4. **Safety / authority** — did it preserve engine state, canon, knowledge boundaries, and player agency?
5. **Experience** — was the narration usable and appropriately concise?

## Key V5 changes

- Requests Ollama/OpenAI-compatible **JSON Schema structured output** by default.
- Strict parser: executable decisions are never recovered with heuristic brace extraction.
- Invalid JSON is now a **Protocol** failure, not automatically four unrelated DM failures.
- Protocol failures may be retried separately from transport failures.
- Reports **first-pass protocol reliability**, **effective protocol reliability**, and recovered protocol calls.
- Retains V4.1 timeout/retry/checkpoint resilience.
- Fixes semantic treatment of `narrate_success`: it remains a resolved-success decision, while still being accepted semantically where a routine `narrate` is expected.
- Adds a small `protocol` stress suite with dialogue/apostrophes/knowledge/mechanics cases.
- Tightens the player-emotion agency invariant after V4.1 showed that subtle dictated emotion could pass.

## Defaults

- request timeout: 180000 ms
- transport attempts: 2
- protocol attempts: 2
- structured output: enabled

Environment variables:

```dotenv
DM_REQUEST_TIMEOUT_MS=180000
DM_REQUEST_ATTEMPTS=2
DM_PROTOCOL_ATTEMPTS=2
DM_STRUCTURED_OUTPUT=1
```

CLI overrides include `--timeout-ms`, `--attempts`, `--protocol-attempts`, and `--no-structured-output`.

## Suites

- `core` — regression continuity
- `holdout` — original unseen/generalization suite
- `behavioral` — 40 diverse DM behavior cases
- `protocol` — structured-output stress cases
- `all` — combined; avoid for rapid iteration unless needed

## Output legend

- `.` behavioral axes pass
- `c` decision passes but strict contract fails
- `s` safety/authority fails
- `F` DM decision fails
- `j` invalid JSON caused a protocol retry
- `p` invalid JSON was recovered by a later protocol attempt
- `J` protocol still invalid after protocol retries
- `r` transient transport retry
- `T` transport/timeout failure after retries

## Interpretation

A protocol failure means the application could not safely parse the response. It is operationally important, but it is not evidence by itself that the underlying DM judgment was bad. Downstream decision/contract/safety/experience scores therefore use only successfully parsed responses, while protocol reliability is reported separately.

For production state-changing actions, fail closed: schema validation and capability/rules validation must occur before any deterministic state mutation.

### Exact field hygiene

V5 also tightens contract validation: irrelevant mechanical fields must be `null`. For example, `request_attack` must not smuggle an `ability` or `skill` field into a capability that does not accept those parameters. This was visible in V4.1 and is now measured as a contract issue rather than silently accepted.

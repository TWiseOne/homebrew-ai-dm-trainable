# Training V1.3 — Gold Dataset Builder

V6.5 remains frozen. V1.3 changes the training pipeline only.

## Pipeline
1. Normalize source pool.
2. Curate candidates; actual foreign tool calls are now distinguished from tool schemas.
3. Build a deterministic ~2,000-item curriculum.
4. Use a teacher model to generate materially new V6.5-native preferred/rejected candidates.
5. Deterministically validate into the review queue.
6. Human review/spot-check. Nothing becomes gold automatically.
7. Promote only explicit accepts.

## Teacher generation
Default teacher is `qwen3:30b`, configurable with `TEACHER_MODEL`. Start with 50–100 examples before scaling.

## Review gate
Edit `training/gold/review/review.jsonl`: for an accepted record set `validation.humanReviewed` to `true` and `validation.humanDecision` to `accept`. Mixed/incorrect examples should be corrected or rejected, not blindly promoted.

## Benchmark isolation
Never use `evals/**`, V6.5 scenario text, or baseline result responses as generation sources. Source-derived scenarios must be materially new.

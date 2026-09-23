# Frozen holdout policy

The V6.5 benchmark is a measurement set, not training data.

- Never export files under `evals/` into SFT/DPO/ORPO training data.
- Never convert V6.5 benchmark answers or failures directly into training examples.
- Training examples may teach the same *principles*, but should use materially different situations, wording, entities, and surface forms.
- Keep at least one post-training evaluation suite untouched by training and preference generation.
- Record dataset provenance and hashes before each training run.

This prevents a higher benchmark score from merely measuring memorization of the evaluator.

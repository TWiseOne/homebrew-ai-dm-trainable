# DM Training V1

Training V1 starts model tuning. The V6.5 architecture and benchmark are frozen.

## Order of operations

1. Run the normal application tests and corpus check.
2. Generate deterministic train/validation exports with `python training/scripts/prepare_dataset.py`.
3. Inspect `training/datasets/exports/manifest.json` and keep it with the run.
4. Install the Python training dependencies in a dedicated venv.
5. Run QLoRA SFT with `python training/scripts/train_sft.py`.
6. Import/serve the resulting adapter or merged model through the chosen local runtime.
7. Run the exact frozen V6.5 benchmark and compare against `training/reports/baselines/v6.5-untrained-8b.json`.

Do not tune against V6.5 benchmark prompts. Do not add benchmark answers to the training corpus. Preference optimization is deliberately a second step; first establish whether SFT improves held-out behavior.

The initial 21-example corpus is a pipeline smoke-test/seed corpus, not enough data for a production-quality fine-tune. Expand with project-authored, provenance-preserving examples before treating a trained checkpoint as production-ready.

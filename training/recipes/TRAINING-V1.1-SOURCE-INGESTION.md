# DM Training V1.1 — Source Pool & Ingestion

V6.5 remains the frozen behavioural foundation and benchmark. V1.1 adds a provenance-aware external source pool; it does **not** change the runtime DM protocol.

## Safety rails

1. External source records are **candidates**, never automatically trainable examples.
2. Foreign function calls are transformed into V6.5 Resolution Broker semantics before review.
3. SRD retrieval pairs teach retrieval/rule grounding or seed new scenarios; they are not bulk DM-prose SFT.
4. FIREBALL is quarantined because its repository combines a CC-BY-4.0 label with “research purposes only” wording.
5. `evals/**` and `training/reports/baselines/**` are forbidden training inputs.
6. Every accepted derivative must retain source ID, source row/location, license, transformation history, and review status.

## Run

```bash
python3 training/scripts/source_report.py
python3 training/scripts/fetch_sources.py --source dnd_dm_v3 --source srd_anchor_pairs --source srd_structured --source srd_markdown
python3 training/scripts/normalize_sources.py
python3 training/scripts/prepare_dataset.py
```

`pyarrow` is required to normalize the SRD parquet dataset. It is listed in `training/requirements.txt`.

Do **not** pass `--include-quarantine` in the normal training workflow.

## Next dataset stage

Transform candidates into project-authored examples with V6.5 inputs/outputs and dimensional labels. Human/reviewer acceptance is required before moving a record into the reviewed training corpus. The target is diversity of principles, not maximum row count.

## V1.1.1 fetcher maintenance

The fetch layer no longer assumes GitHub branch names or Hugging Face internal shard paths.

- Hugging Face datasets use `datasets.load_dataset()` and are exported to the canonical local cache format.
- GitHub repositories use `git clone --depth 1`, allowing Git to resolve `main` vs `master`.
- A failed source is recorded and the remaining requested sources are still attempted.
- `download-manifest.json` records successful checksums plus any failures.
- A non-zero exit status is returned after all requested sources have been attempted if any failed.

This is an acquisition-layer fix only. V6.5 architecture and benchmark remain frozen.

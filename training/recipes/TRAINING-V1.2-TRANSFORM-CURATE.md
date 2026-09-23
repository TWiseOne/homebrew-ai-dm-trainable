# DM Training V1.2 — Transform & Curate

V6.5 is frozen. V1.2 does not change the DM protocol, Resolution Broker, Fact Ledger, Narrative Authority, or frozen benchmark.

## Purpose
Turn the normalized external pool (expected: 1,633 `dnd_dm_v3` + 11,267 SRD 5.2.1 anchor pairs) into reviewable curriculum candidates without treating external data as gold.

## Environment
Use an isolated ingestion environment:

```bash
python3 -m venv .venv-ingest
source .venv-ingest/bin/activate
python -m pip install -U pip setuptools wheel
pip install -r training/requirements-ingest.txt
```

Do not install the GPU training stack into Rocky's system Python. `requirements-train.txt` is intentionally separate and does not pin PyTorch/CUDA; choose the PyTorch build appropriate to the host when training begins.

## Pipeline

```bash
python training/scripts/fetch_sources.py --source dnd_dm_v3 --source srd_anchor_pairs --source srd_structured --source srd_markdown
python training/scripts/normalize_sources.py
python training/scripts/curate_candidates.py
```

Expected normalized counts from the first successful Rocky run:
- dnd_dm_v3: 1,633
- srd_anchor_pairs: 11,267
- total: 12,900

`curate_candidates.py` creates:
- `training/curation/queues/dnd_dm_v3.review.jsonl`
- `training/curation/queues/srd_scenario_seeds.review.jsonl`
- `training/curation/reports/curation-report.json`

The SRD queue is a balanced deterministic subset of up to 1,400 scenario seeds. The full 11,267-record normalized corpus remains available for later rounds.

## Acceptance rules
A source candidate is not an SFT example. To become gold it must:
1. retain provenance and license metadata;
2. use V6.5 response semantics;
3. replace foreign low-level tool calls with opaque Resolution Broker choices;
4. treat engine results as authoritative;
5. preserve knowledge/canon boundaries;
6. distinguish missing information from absent world state;
7. route persistent improvisation through authorized flexible facts/proposals;
8. use SRD text as grounding, not as copied DM prose;
9. be materially different from frozen V6.5 benchmark scenarios;
10. receive explicit review before entering train/validation exports.

## Dataset target
First serious run: approximately 1,500–2,500 reviewed examples, not 12,900 automatically accepted records. Reserve 10–15% for validation and maintain a separate unseen behavioural holdout.

## QA
Run `python training/scripts/qa_training_set.py <export.jsonl>` on any proposed gold export. Benchmark-derived provenance is a hard failure.

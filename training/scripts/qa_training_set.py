#!/usr/bin/env python3
from pathlib import Path
import json, hashlib, sys, collections
ROOT=Path(__file__).resolve().parents[1]
EVAL_IDS=set()
# Frozen eval files are never read as training material. Their paths are only prohibited provenance strings.
PROHIBITED=('evals/','data/eval-results','v6.5-scenarios','dm-eval-v6.5')
def main():
 paths=[Path(p) for p in sys.argv[1:]]
 if not paths:
  print('usage: qa_training_set.py <jsonl> [jsonl...]');return 2
 seen=set();errors=[];dims=collections.Counter();n=0
 for p in paths:
  for ln,line in enumerate(p.open(errors='replace'),1):
   try:x=json.loads(line)
   except Exception as e:errors.append(f'{p}:{ln}:invalid_json');continue
   n+=1; raw=json.dumps(x,sort_keys=True,ensure_ascii=False); h=hashlib.sha256(raw.encode()).hexdigest()
   if h in seen:errors.append(f'{p}:{ln}:duplicate_record')
   seen.add(h)
   prov=json.dumps(x.get('provenance',{})).lower()
   if any(q in prov for q in PROHIBITED):errors.append(f'{p}:{ln}:benchmark_provenance')
   for d in x.get('dimensions',[]):dims[d]+=1
 print(json.dumps({'records':n,'unique':len(seen),'dimensions':dict(dims),'errors':errors[:100],'errorCount':len(errors)},indent=2))
 return 1 if errors else 0
if __name__=='__main__':raise SystemExit(main())

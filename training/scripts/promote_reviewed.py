#!/usr/bin/env python3
from pathlib import Path
import json,collections
ROOT=Path(__file__).resolve().parents[1]; SRC=ROOT/'gold'/'review'/'review.jsonl'; OUT=ROOT/'gold'/'gold'/'gold.jsonl'; REP=ROOT/'gold'/'reports'/'gold-report.json'; OUT.parent.mkdir(parents=True,exist_ok=True)
def main():
 if not SRC.exists(): raise SystemExit('Missing review.jsonl')
 gold=[]; stats=collections.Counter()
 for l in SRC.read_text(errors='replace').splitlines():
  try:r=json.loads(l)
  except: continue
  v=r.get('validation',{}); decision=v.get('humanDecision')
  if v.get('status')=='review' and v.get('humanReviewed') is True and decision=='accept': gold.append(r); stats['gold']+=1
  else: stats['not_promoted']+=1
 with OUT.open('w') as f:
  for r in gold:f.write(json.dumps(r,ensure_ascii=False)+'\n')
 REP.write_text(json.dumps({'version':'1.3.6.1','counts':dict(stats),'gate':'humanReviewed=true + humanDecision=accept required'},indent=2)+'\n'); print(REP.read_text())
if __name__=='__main__':main()

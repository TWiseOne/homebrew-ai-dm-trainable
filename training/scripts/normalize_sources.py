#!/usr/bin/env python3
from pathlib import Path
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]; CACHE=ROOT/'cache'; OUT=ROOT/'normalized'; OUT.mkdir(exist_ok=True)
def emit(path, rows):
 with path.open('w') as f:
  for r in rows: f.write(json.dumps(r,ensure_ascii=False)+'\n')
def dm():
 p=CACHE/'dnd_dm_v3.jsonl'
 if not p.exists(): return 0
 rows=[]
 for i,line in enumerate(p.open(errors='replace')):
  try: x=json.loads(line)
  except: continue
  rows.append({'id':f'dnd_dm_v3:{i}','source':'dnd_dm_v3','lane':'dm_behaviour','status':'candidate','provenance':{'row':i,'license':'MIT'},'dimensions':['engineAuthority','brokerApplicability','resolutionLifecycle','agency'],'payload':{'messages':x.get('messages',[]),'tools':x.get('tools',[]),'meta':x.get('meta',{}),'transformRequired':True,'warning':'Foreign tool calls are evidence/candidates only; map to V6.5 broker choices before SFT.'}})
 emit(OUT/'dnd_dm_v3.candidates.jsonl',rows); return len(rows)
def pairs():
 p=CACHE/'srd_anchor_pairs.parquet'
 if not p.exists(): return 0
 try: import pyarrow.parquet as pq
 except ImportError:
  print('SKIP srd_anchor_pairs normalization: pip install pyarrow'); return 0
 tab=pq.read_table(p); cols=tab.to_pydict(); rows=[]
 anchors=cols.get('anchor',[]); positives=cols.get('positive',[])
 for i,(a,b) in enumerate(zip(anchors,positives)):
  rows.append({'id':f'srd_anchor_pairs:{i}','source':'srd_anchor_pairs','lane':'rules_retrieval','status':'candidate','provenance':{'row':i,'license':'CC-BY-4.0','rulesVersion':'srd-5.2.1'},'dimensions':['engineAuthority','missingContext'],'payload':{'anchor':a,'positive':b,'trainingUse':'retrieval_or_scenario_seed','warning':'Do not use directly as DM prose SFT.'}})
 emit(OUT/'srd_anchor_pairs.candidates.jsonl',rows); return len(rows)
def main():
 counts={'dnd_dm_v3':dm(),'srd_anchor_pairs':pairs()}
 (OUT/'normalization-report.json').write_text(json.dumps({'counts':counts,'trainableAutomatically':0,'policy':'All external records remain candidates until transformed/reviewed. FIREBALL remains quarantined.'},indent=2)+'\n')
 print(json.dumps(counts,indent=2))
if __name__=='__main__': main()

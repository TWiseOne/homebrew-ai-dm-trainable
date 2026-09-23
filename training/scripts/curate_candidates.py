#!/usr/bin/env python3
from pathlib import Path
import json, hashlib, collections
ROOT=Path(__file__).resolve().parents[1]
NORM=ROOT/'normalized'; OUT=ROOT/'curation'; Q=OUT/'queues'; R=OUT/'reports'
Q.mkdir(parents=True,exist_ok=True); R.mkdir(parents=True,exist_ok=True)
CATS={
 'combat':['attack','damage','armor class','hit point','critical','weapon'],
 'saving_throws':['saving throw','dexterity save','constitution save','wisdom save'],
 'checks':['ability check','skill check','athletics','acrobatics','perception','investigation'],
 'conditions':['condition','grappled','prone','poisoned','stunned','frightened','charmed','restrained'],
 'movement':['movement','speed','difficult terrain','jump','climb','swim','fall'],
 'spellcasting':['spell','spell slot','cantrip','ritual','casting time','spell attack'],
 'concentration':['concentration'], 'rest_resources':['short rest','long rest','hit dice','resource','recover'],
 'death':['death saving','unconscious','dying','stable'], 'equipment':['equipment','weapon','armor','shield','tool'],
 'classes_features':['class','feature','proficiency','feat','subclass'], 'creatures':['monster','creature','challenge rating','stat block'],
 'exploration':['exploration','travel','vision','light','hidden','search'], 'social':['persuasion','deception','intimidation','attitude','social']}

def read_jsonl(p):
 if not p.exists(): return
 with p.open(errors='replace') as f:
  for line in f:
   try: yield json.loads(line)
   except: pass

def write_jsonl(p,rows):
 with p.open('w') as f:
  for x in rows:f.write(json.dumps(x,ensure_ascii=False)+'\n')

def classify(text):
 t=text.lower(); scores={k:sum(t.count(w) for w in ws) for k,ws in CATS.items()}; m=max(scores.values(),default=0)
 return max(scores,key=scores.get) if m else 'other'

def stable_score(s): return int(hashlib.sha256(s.encode()).hexdigest()[:12],16)

def actual_tool_calls(messages):
 out=[]
 for m in messages if isinstance(messages,list) else []:
  if not isinstance(m,dict): continue
  tc=m.get('tool_calls') or []
  if isinstance(tc,list):
   for call in tc:
    if not isinstance(call,dict): continue
    fn=call.get('function',call)
    if isinstance(fn,dict) and fn.get('name'): out.append(str(fn['name']))
  fc=m.get('function_call')
  if isinstance(fc,dict) and fc.get('name'): out.append(str(fc['name']))
  # Some corpora encode assistant calls as name + role/function/tool.
  if m.get('role') in ('function','tool') and m.get('name'): out.append(str(m['name']))
 return out

def available_tools(tools):
 names=[]
 for t in tools if isinstance(tools,list) else []:
  if isinstance(t,dict):
   fn=t.get('function',t); n=fn.get('name') if isinstance(fn,dict) else None
   if n:names.append(str(n))
 return names

def dm_queue():
 rows=[]; actual=collections.Counter(); available=collections.Counter()
 for x in read_jsonl(NORM/'dnd_dm_v3.candidates.jsonl') or []:
  payload=x.get('payload',{}); msgs=payload.get('messages',[]); tools=payload.get('tools',[])
  txt=json.dumps(msgs,ensure_ascii=False); avail=available_tools(tools); calls=actual_tool_calls(msgs)
  available.update(avail); actual.update(calls)
  low=('update_hp','roll_dmg','roll_damage','reset_resources','set_','update_','add_','remove_','clear_')
  risk=[]
  if any(any(n.startswith(p) for p in low) for n in calls): risk.append('actual_foreign_low_level_mutation_or_roll')
  rows.append({**x,'review':{'category':classify(txt),'availableForeignTools':avail,'actualForeignToolCalls':calls,'flags':risk,
    'requiredTransformation':'Map player intent to opaque V6.5 resolution options; preserve engine result as authoritative; do not copy foreign tool API into SFT.',
    'priority':stable_score(x['id'])}})
 rows.sort(key=lambda z:z['review']['priority']); write_jsonl(Q/'dnd_dm_v3.review.jsonl',rows)
 return len(rows),actual,available

def srd_queue(cap=1400):
 buckets=collections.defaultdict(list)
 for x in read_jsonl(NORM/'srd_anchor_pairs.candidates.jsonl') or []:
  p=x.get('payload',{}); text=f"{p.get('anchor','')} {p.get('positive','')}"; cat=classify(text)
  x['review']={'category':cat,'requiredTransformation':'Use rule passage as grounding to author a materially new DM situation; never copy benchmark wording; engine remains rules authority.','priority':stable_score(x['id'])}
  buckets[cat].append(x)
 cats=sorted(buckets); per=max(1,cap//max(1,len(cats))); chosen=[]
 for c in cats:
  buckets[c].sort(key=lambda z:z['review']['priority']); chosen.extend(buckets[c][:per])
 if len(chosen)<cap:
  used={x['id'] for x in chosen}; rest=sorted((x for vs in buckets.values() for x in vs if x['id'] not in used),key=lambda z:z['review']['priority']);chosen+=rest[:cap-len(chosen)]
 write_jsonl(Q/'srd_scenario_seeds.review.jsonl',chosen)
 return sum(map(len,buckets.values())),collections.Counter({k:len(v) for k,v in buckets.items()}),len(chosen)

def main():
 d,actual,available=dm_queue(); s,cats,selected=srd_queue()
 report={'version':'1.3','sourcePool':{'dnd_dm_v3':d,'srd_anchor_pairs':s,'total':d+s},'reviewQueues':{'dnd_dm_v3':d,'srdScenarioSeeds':selected},
  'srdCoverage':dict(cats),'topActualForeignToolCalls':actual.most_common(40),'topAvailableForeignTools':available.most_common(20),
  'automaticGoldExamples':0,'gates':['provenance_required','no_eval_source','foreign_tool_api_must_be_transformed','rules_passage_not_dm_prose','explicit_review_before_gold']}
 (R/'curation-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()

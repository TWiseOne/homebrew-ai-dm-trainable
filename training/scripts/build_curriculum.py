#!/usr/bin/env python3
from pathlib import Path
import json,hashlib,collections,argparse
ROOT=Path(__file__).resolve().parents[1];Q=ROOT/'curation'/'queues';OUT=ROOT/'gold'/'prompts';REPORT=ROOT/'gold'/'reports';OUT.mkdir(parents=True,exist_ok=True);REPORT.mkdir(parents=True,exist_ok=True)
CAT_DIMS={'combat':['engineAuthority','agency'],'saving_throws':['engineAuthority'],'checks':['engineAuthority','pacing'],'conditions':['engineAuthority'],'movement':['engineAuthority','agency'],'spellcasting':['engineAuthority','epistemicDiscipline'],'concentration':['engineAuthority'],'rest_resources':['engineAuthority','pacing'],'death':['engineAuthority','tone'],'equipment':['narrativeAuthority'],'classes_features':['engineAuthority'],'creatures':['epistemicDiscipline'],'exploration':['exploration','narrativeAuthority'],'social':['social','agency','epistemicDiscipline'],'other':['narrativeAuthority','creativePermission']}
BEHAVIOR_TO_DIMS={'agency':['agency'],'unresolved_result':['engineAuthority','narrativeAuthority'],'turn_handoff':['pacing','agency'],'target_constraints':['engineAuthority','narrativeAuthority'],'resource_authority':['engineAuthority'],'human_roll_boundary':['engineAuthority','agency'],'npc_intent_engine_resolution':['engineAuthority','agency'],'continuity':['continuity','narrativeAuthority'],'failure_forward':['failureForward','narrativeAuthority'],'pacing':['pacing'],'authority_discipline':['engineAuthority','narrativeAuthority']}
# dnd_dm_v3 is behavioral inspiration, not a general-purpose DM curriculum. These caps prevent
# its mechanically-heavy source distribution from crowding out project-authored craft examples.
DM_THEME_CAPS={'unresolved_result':120,'npc_intent_engine_resolution':80,'resource_authority':55,'target_constraints':45,'turn_handoff':45,'continuity':30,'failure_forward':15,'agency':10,'pacing':10,'human_roll_boundary':5,'authority_discipline':5}
SOURCE_SHARES={'srd_anchor_pairs':0.65,'dnd_dm_v3':0.20,'project_native':0.15}
def read(p):return [json.loads(x) for x in p.read_text(errors='replace').splitlines() if x.strip()] if p.exists() else []
def h(s):return hashlib.sha256(s.encode()).hexdigest()
def compact_dm(x):return {'sourceId':x['sourceId'],'source':'dnd_dm_v3','category':x.get('category','other'),'primaryBehaviorTheme':x.get('primaryBehaviorTheme','authority_discipline'),'portableLessons':x.get('portableLessons',[]),'forbiddenSemantics':x.get('forbiddenSemantics',[]),'sourceSignals':x.get('sourceSignals',{}),'provenance':x.get('provenance',{})}
def compact_srd(x):
 p=x.get('payload',{});return {'sourceId':x['id'],'source':'srd_anchor_pairs','category':x['review']['category'],'ruleQuestion':p.get('anchor',''),'rulePassage':p.get('positive',''),'provenance':x.get('provenance',{})}
def compact_native(x):return {'sourceId':x['id'],'source':'project_native','category':x.get('category','other'),'primaryBehaviorTheme':x.get('primaryBehaviorTheme'),'dimensions':x.get('dimensions',[]),'situationSeed':x.get('situationSeed'),'portableLesson':x.get('portableLesson'),'controller':x.get('controller'),'rollOwner':x.get('rollOwner'),'resultStatus':x.get('resultStatus'),'authoritativeResult':x.get('authoritativeResult'),'requiresBroker':x.get('requiresBroker',False),'mandatory':x.get('mandatory',False),'provenance':x.get('provenance',{})}
def dims_for(c):
 if c['source']=='project_native':return c.get('dimensions') or ['narrativeAuthority']
 if c['source']=='dnd_dm_v3':
  ds=[]
  for l in c.get('portableLessons',[]):
   for d in BEHAVIOR_TO_DIMS.get(l.get('dimension'),[]):
    if d not in ds:ds.append(d)
  return ds or ['engineAuthority','narrativeAuthority']
 return CAT_DIMS.get(c.get('category','other'),CAT_DIMS['other'])
def select_dm(dm,n):
 by=collections.defaultdict(list)
 for c in dm:by[c.get('primaryBehaviorTheme','authority_discipline')].append(c)
 for k in by:by[k].sort(key=lambda x:h(x['sourceId']))
 out=[];used=collections.Counter();themes=sorted(by)
 while len(out)<n:
  progressed=False
  for t in themes:
   cap=DM_THEME_CAPS.get(t,5)
   if used[t]>=cap or not by[t]:continue
   out.append(by[t].pop(0));used[t]+=1;progressed=True
   if len(out)>=n:break
  if not progressed:break
 return out,used
def stable_pick(rows,n):return sorted(rows,key=lambda x:h(x['sourceId']))[:n]
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--target',type=int,default=2000);a=ap.parse_args()
 dm=[compact_dm(x) for x in read(Q/'dnd_dm_v3.portable.jsonl')];srd=[compact_srd(x) for x in read(Q/'srd_scenario_seeds.review.jsonl')];native=[compact_native(x) for x in read(Q/'project_native.review.jsonl')]
 desired={k:round(a.target*v) for k,v in SOURCE_SHARES.items()}; desired['srd_anchor_pairs']+=a.target-sum(desired.values())
 chosen_dm,dmthemes=select_dm(dm,min(desired['dnd_dm_v3'],len(dm)))
 chosen_native=stable_pick(native,min(desired['project_native'],len(native)))
 chosen_srd=stable_pick(srd,min(desired['srd_anchor_pairs'],len(srd)))
 chosen=chosen_srd+chosen_dm+chosen_native
 # Fill shortages from SRD first, then native, then safe/capped DM only; never violate DM theme caps.
 if len(chosen)<a.target:
  used={c['sourceId'] for c in chosen}; extras=[c for c in sorted(srd+native,key=lambda x:h(x['sourceId'])) if c['sourceId'] not in used]
  chosen.extend(extras[:a.target-len(chosen)])
 chosen=chosen[:a.target];chosen.sort(key=lambda c:h(c['sourceId']))
 rows=[];dims=collections.Counter()
 for c in chosen:
  ds=dims_for(c);dims.update(ds);rows.append({'id':'curriculum:'+h(c['sourceId'])[:16],'sourceEvidence':c,'dimensions':ds,'status':'generation_prompt','instruction':'Create a materially new V6.5-native training situation grounded only by this source evidence. Do not copy source prose. Foreign behavioral records teach only their supplied portable lessons and never supply rules authority. Project-native records teach the supplied product behavior and lifecycle. SRD records supply rules evidence. The AI DM interprets/narrates and may choose AI-controlled NPC intent; Resolution Broker/engine own legality, dice, modifiers, resources and outcomes; human-controlled actors initiate/input their own player-facing rolls; Fact Ledger owns truth; Narrative Authority limits invention. Produce preferred and plausible rejected responses with a material behavioral contrast.'})
 with (OUT/'curriculum.jsonl').open('w') as f:
  for r in rows:f.write(json.dumps(r,ensure_ascii=False)+'\n')
 src=collections.Counter(r['sourceEvidence']['source'] for r in rows)
 rep={'version':'1.3.6.1','requested':a.target,'built':len(rows),'sourcePolicy':{'shares':SOURCE_SHARES,'dndDmV3ThemeCaps':DM_THEME_CAPS},'sourceCounts':dict(src),'categoryCounts':dict(collections.Counter(r['sourceEvidence']['category'] for r in rows)),'dndDmV3PrimaryThemeCounts':dict(collections.Counter(r['sourceEvidence'].get('primaryBehaviorTheme') for r in rows if r['sourceEvidence']['source']=='dnd_dm_v3')),'projectNativeThemeCounts':dict(collections.Counter(r['sourceEvidence'].get('primaryBehaviorTheme') for r in rows if r['sourceEvidence']['source']=='project_native')),'dimensionCounts':dict(dims),'note':'Source-aware composition: SRD supplies rules evidence; dnd_dm_v3 is capped behavioral inspiration; project-native seeds teach product-specific lifecycle and DM craft. Source suitability determines composition.'}
 (REPORT/'curriculum-report.json').write_text(json.dumps(rep,indent=2)+'\n');print(json.dumps(rep,indent=2))
if __name__=='__main__':main()

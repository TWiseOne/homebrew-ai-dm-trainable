#!/usr/bin/env python3
from pathlib import Path
import argparse,json,os,urllib.request,hashlib
ROOT=Path(__file__).resolve().parents[1]; IN=ROOT/'gold'/'prompts'/'authority-envelopes.jsonl'; OUT=ROOT/'gold'/'generated'/'candidates.jsonl'; OUT.parent.mkdir(parents=True,exist_ok=True)
SYSTEM='''You generate REVIEW CANDIDATES for an AI-first revised D&D 5e DM. V6.5 application architecture is frozen; this is training-pipeline V1.3.6.1.
STRICT AUTHORITY RULES:
- The authorityEnvelope is immutable. Never invent, alter, or strengthen its rules or facts.
- authoritativeResult is unresolved unless supplied otherwise. Never fabricate success/failure, a die result, damage, a discovered identity, hidden passage, cause, or other unresolved fact.
- brokerOptions and opaque IDs are engine-owned. A resolve response may choose ONLY a supplied ID.
- If interactionKind=informational_rules: answer only from sourceRuleEvidence; preferred mode=narrate, resolutionChoice=null. Topic words such as spell, attack, movement or save do NOT turn a rules question into a game action.
- If interactionKind=behavioral_scenario: sourceBehaviorEvidence is already a SANITIZED PORTABLE BEHAVIOR SEED. Raw foreign transcripts and tool calls are intentionally absent. Teach only portableLessons. Never recreate or guess the original runtime, tools, tags, coordinates, resets, or lifecycle.
- If interactionKind=project_native_scenario: use only the supplied project-native situation/lesson and authority envelope; it is product-authored behavior, not external rules authority.
- For AI-controlled NPCs/monsters, the AI DM may choose fictional intent/tactics within authority; the deterministic engine owns dice, legality, modifiers, damage, resources, and mechanical outcome. Never say 'I roll' or imply the language model performs the mechanical roll.
- Source rule evidence is the complete rules authority for this candidate. Do not add a rule, modifier, DC, exception, condition, distance, size, resource state, willingness, cover, line of sight, or other mechanical premise not entailed by it.
- Scenario facts have authority established|engine|flexible. established = supplied non-engine truth; engine = authoritative mechanical state/result; flexible = harmless fictional colour. NEVER label a mechanics-bearing fact flexible.
- Missing context remains unknown. Do not convert unknown into absent, blank, harmless, secret, mineral, etc.
- Preserve source identity.
HUMAN ROLL LIFECYCLE:
- Human-controlled actors own their player-facing dice by default. A human may initiate the app's digital die or enter a raw physical/external die result.
- The AI DM NEVER invents, chooses, silently rolls, or pre-empts a human-controlled actor's die result.
- When a selected resolution requires a human roll and no roll has been supplied, the state is awaiting_player_roll. The preferred DM response yields to the pending roll interaction and MUST NOT narrate the outcome. The UI presents Roll and manual raw-die entry; do not train repetitive 'tell me your d20 result' phrasing unless conversationally necessary.
- The deterministic engine applies modifiers, DC/rules, and determines the outcome after the raw die is supplied. The DM narrates only the authoritative resolved result.
- NPC/monster rolls may be engine-owned by default; do not force the human to roll them unless the envelope says so.
- Do not ask the human to calculate modifiers or outcome. They provide/initiate the raw die; the engine resolves mechanics.
OTHER BEHAVIOR:
- Prefer player agency. Never choose the player's next voluntary action.
- Keep narration succinct and engaging; failure should move play forward where the authority permits.
- Behavioral records have 1-3 evidence-supported portable lessons. Focus the generated contrast on those supplied lessons; do not add unrelated authority lessons merely because they are generally important.
- The rejected response must be a plausible contrast with a MATERIAL failure in one or two named dimensions. No trivial wording/formatting/synonym contrasts.
Return JSON only with keys: scenario, scenarioFacts (array of {fact,authority:"established"|"engine"|"flexible"}), playerIntent, preferredResponse, rejectedResponse, dimensions, critique.
Each response has exactly: mode (narrate|resolve|reject), resolutionChoice (supplied opaque ID or null), factProposals (array), reason, narration.
The critique must name the material behavioral difference between preferred and rejected. Do not repeat source prose verbatim.'''

def call(base,model,item,timeout):
 url=base.rstrip('/')+'/chat/completions'; body={'model':model,'messages':[{'role':'system','content':SYSTEM},{'role':'user','content':json.dumps(item,ensure_ascii=False)}],'temperature':0.2,'response_format':{'type':'json_object'}}
 req=urllib.request.Request(url,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer ollama'})
 with urllib.request.urlopen(req,timeout=timeout) as r:data=json.load(r)
 return json.loads(data['choices'][0]['message']['content'])
def stable(rows): return sorted(rows,key=lambda x:hashlib.sha256(x['id'].encode()).hexdigest())
def sample_rows(rows,limit,mode):
 if not limit or limit>=len(rows): return stable(rows)
 if mode=='sequential': return rows[:limit]
 by_source={}
 for r in rows: by_source.setdefault(r.get('source','unknown'),[]).append(r)
 sources=sorted(by_source);total=len(rows);quotas={s:int(limit*len(by_source[s])/total) for s in sources};left=limit-sum(quotas.values())
 for src in sorted(sources,key=lambda z:(-(limit*len(by_source[z])/total-quotas[z]),z))[:left]:quotas[src]+=1
 picked=[]
 for src in sources:
  pool=by_source[src];q=quotas[src]
  if src not in ('dnd_dm_v3','project_native'):picked.extend(stable(pool)[:q]);continue
  # Behavioral calibration is itself stratified across primary portable themes.
  by_theme={}
  for r in pool:
   ev=r.get('authorityEnvelope',{}).get('sourceBehaviorEvidence',{});theme=ev.get('primaryBehaviorTheme') or 'authority_discipline';by_theme.setdefault(theme,[]).append(r)
  themes=sorted(by_theme);i=0
  for t in themes:by_theme[t]=stable(by_theme[t])
  while q>0 and themes:
   t=themes[i%len(themes)]
   if by_theme[t]:picked.append(by_theme[t].pop(0));q-=1
   if not by_theme[t]:themes.remove(t);i=0
   else:i+=1
 return stable(picked)
def main():
 ap=argparse.ArgumentParser(); ap.add_argument('--model',default=os.getenv('TEACHER_MODEL','qwen3:30b')); ap.add_argument('--base-url',default=os.getenv('OLLAMA_BASE_URL','http://127.0.0.1:11434/v1')); ap.add_argument('--limit',type=int,default=50); ap.add_argument('--timeout',type=int,default=180); ap.add_argument('--resume',action='store_true'); ap.add_argument('--sampling',choices=('stratified','sequential'),default='stratified'); a=ap.parse_args()
 if not IN.exists(): raise SystemExit('Missing authority-envelopes.jsonl; run build_authority_envelopes.py first')
 all_rows=[json.loads(x) for x in IN.read_text(errors='replace').splitlines() if x.strip()]; rows=sample_rows(all_rows,a.limit,a.sampling); done=set()
 if a.resume and OUT.exists():
  for l in OUT.read_text(errors='replace').splitlines():
   try:done.add(json.loads(l)['curriculumId'])
   except:pass
 mode='a' if a.resume else 'w'; n=0
 with OUT.open(mode) as f:
  for item in rows:
   if item['id'] in done:continue
   try:
    result=call(a.base_url,a.model,item,a.timeout); rec={'curriculumId':item['id'],'sourceId':item['sourceId'],'source':item.get('source'),'category':item.get('category'),'model':a.model,'authorityEnvelope':item['authorityEnvelope'],'generated':result}
    f.write(json.dumps(rec,ensure_ascii=False)+'\n');f.flush();n+=1;print('OK',n,item['id'],item.get('source'),item.get('category'),item['authorityEnvelope'].get('interactionKind'))
   except Exception as e:print('FAIL',item['id'],type(e).__name__,e)
 print('generated',n,'of',len(rows),'selected ->',OUT)
if __name__=='__main__':main()

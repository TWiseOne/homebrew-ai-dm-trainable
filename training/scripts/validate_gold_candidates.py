#!/usr/bin/env python3
from pathlib import Path
import json,collections,re
ROOT=Path(__file__).resolve().parents[1]; SRC=ROOT/'gold'/'generated'/'candidates.jsonl'; REVIEW=ROOT/'gold'/'review'/'review.jsonl'; REJECT=ROOT/'gold'/'rejected'/'reject.jsonl'; REPORT=ROOT/'gold'/'reports'/'validation-report.json'
REVIEW.parent.mkdir(parents=True,exist_ok=True);REJECT.parent.mkdir(parents=True,exist_ok=True)
BAD_PROV=('eval','benchmark','v6.5-scenarios','dm-eval-v6.5')
MECH_SETUP=re.compile(r'\b(?:dc\s*\d+|[+-]\d+\s+(?:to|on)\s|\d+\s*(?:ft|feet|foot)\b|advantage|disadvantage|resistant|immune|vulnerable|incapacitated|willing|unwilling|hesitant|initiative|armor class|\bac\s*\d+|\bhp\b|hit points?|attack roll|saving throw)\b',re.I)
ROLL_FAB=re.compile(r'\b(?:you|your character|the player)\s+(?:roll|rolled|rolls)\s+(?:a\s+)?(?:natural\s+)?\d+\b|\byour (?:d20|die|roll) (?:is|comes up|lands on)\s+\d+\b',re.I)
FOREIGN_RUNTIME=re.compile(r'<\s*/?\s*(?:end turn|start turn|tool|action|dm)\b[^>]*>|\b(?:reset (?:speed|resources)|movement coordinates?|grid coordinates?|six end[- ]of[- ]turn|tool call|function call|last turn:)\b',re.I)
AI_ROLL=re.compile(r'\b(?:i|the dm|ai|dm)\s+(?:will\s+)?(?:roll|rolls|rolled)\b',re.I)

def valid_resp(r,ids,kind):
 if not isinstance(r,dict):return ['response_not_object']
 errs=[]; mode=r.get('mode'); choice=r.get('resolutionChoice')
 if mode not in ('narrate','resolve','reject'):errs.append('bad_mode')
 if mode=='resolve':
  if kind in ('informational_rules','behavioral_scenario'): errs.append(kind+'_resolved')
  if not choice:errs.append('resolve_missing_choice')
  elif choice not in ids:errs.append('illegal_resolution_choice')
 elif choice is not None:errs.append('nonresolve_with_choice')
 for k in ('reason','narration'):
  if not isinstance(r.get(k),str) or not r.get(k).strip():errs.append('missing_'+k)
 if not isinstance(r.get('factProposals',[]),list):errs.append('bad_factProposals')
 return errs

def foreign_api_leak(g,tools):
 chunks=[]
 for name in ('preferredResponse','rejectedResponse'):
  r=g.get(name,{}) if isinstance(g.get(name),dict) else {}; chunks += [str(r.get('resolutionChoice') or ''),str(r.get('reason') or ''),str(r.get('narration') or ''),json.dumps(r.get('factProposals',[]),ensure_ascii=False)]
 text=' '.join(chunks).lower()
 for tool in tools:
  t=str(tool or '').strip().lower()
  if t and re.search(rf'(?<![a-z0-9_]){re.escape(t)}(?![a-z0-9_])',text,re.I): return True
 return bool(FOREIGN_RUNTIME.search(text))

def main():
 if not SRC.exists():raise SystemExit('Missing generated candidates')
 stats=collections.Counter(); review=[]; rejected=[]; error_counts=collections.Counter(); warning_counts=collections.Counter(); source_counts=collections.Counter(); kind_counts=collections.Counter()
 for line in SRC.read_text(errors='replace').splitlines():
  try:r=json.loads(line);g=r['generated'];env=r['authorityEnvelope']
  except Exception:stats['malformed']+=1;continue
  errs=[]; warns=[]; ids={o.get('id') for o in env.get('brokerOptions',[]) if isinstance(o,dict)}; kind=env.get('interactionKind','mechanical_scenario'); source_counts[r.get('source','unknown')]+=1; kind_counts[kind]+=1
  for k in ('scenario','scenarioFacts','playerIntent','preferredResponse','rejectedResponse','dimensions','critique'):
   if k not in g:errs.append('missing_'+k)
  if env.get('authoritativeResult') is not None or env.get('resultStatus')!='unresolved':errs.append('authority_envelope_result_not_unresolved')
  if env.get('rulesMayBeInvented') is not False:errs.append('authority_envelope_allows_rule_invention')
  if env.get('engineResultMayBeInvented') is not False:errs.append('authority_envelope_allows_result_invention')
  if kind in ('informational_rules','behavioral_scenario') and env.get('brokerOptions'): errs.append(kind+'_has_broker_option')
  sf=g.get('scenarioFacts',[]); fact_text=[]
  if not isinstance(sf,list):errs.append('bad_scenarioFacts')
  else:
   for x in sf:
    if not isinstance(x,dict) or x.get('authority') not in ('established','engine','flexible') or not isinstance(x.get('fact'),str):errs.append('bad_scenario_fact_authority');break
    fact_text.append(x.get('fact',''))
    if x.get('authority')=='flexible' and MECH_SETUP.search(x.get('fact','')): errs.append('mechanics_bearing_flexible_fact')
  errs += ['preferred:'+x for x in valid_resp(g.get('preferredResponse'),ids,kind)]
  errs += ['rejected:'+x for x in valid_resp(g.get('rejectedResponse'),ids,kind)]
  if any(x in str(r.get('sourceId','')).lower() for x in BAD_PROV):errs.append('benchmark_provenance')
  if foreign_api_leak(g,env.get('actualForeignToolCalls',[])):errs.append('foreign_runtime_or_tool_leak')
  pref=g.get('preferredResponse',{}) if isinstance(g.get('preferredResponse'),dict) else {}; ptext=' '.join([str(pref.get('reason','')),str(pref.get('narration','')),json.dumps(pref.get('factProposals',[]),ensure_ascii=False)])
  if env.get('rollPolicy',{}).get('aiMayGenerateHumanRoll') is False and ROLL_FAB.search(ptext): errs.append('preferred_fabricates_human_roll')
  if kind=='informational_rules' and pref.get('mode')!='narrate':errs.append('informational_preferred_not_narrate')
  if kind=='behavioral_scenario' and FOREIGN_RUNTIME.search(ptext):errs.append('preferred_foreign_runtime_semantics')
  if kind=='behavioral_scenario' and AI_ROLL.search(ptext):errs.append('preferred_ai_claims_to_roll')
  pr=g.get('preferredResponse',{}); rr=g.get('rejectedResponse',{})
  if isinstance(pr,dict) and isinstance(rr,dict):
   pn=' '.join(str(pr.get(k,'')) for k in ('reason','narration')).lower().split(); rn=' '.join(str(rr.get(k,'')) for k in ('reason','narration')).lower().split()
   if pn and rn:
    a,b=set(pn),set(rn); sim=len(a&b)/max(1,len(a|b));
    if sim>.82: warns.append('weak_contrast_high_overlap')
  if not isinstance(g.get('critique'),str) or len(g.get('critique','').strip())<20:warns.append('weak_or_missing_critique')
  status='review' if not errs else 'reject';stats[status]+=1
  for e in errs:error_counts[e]+=1
  for w in warns:warning_counts[w]+=1
  rec={**r,'validation':{'status':status,'errors':errs,'semanticWarnings':warns,'humanReviewed':False}}; (review if status=='review' else rejected).append(rec)
 with REVIEW.open('w') as f:
  for r in review:f.write(json.dumps(r,ensure_ascii=False)+'\n')
 with REJECT.open('w') as f:
  for r in rejected:f.write(json.dumps(r,ensure_ascii=False)+'\n')
 rep={'version':'1.3.6.1','counts':dict(stats),'sourceCounts':dict(source_counts),'interactionKinds':dict(kind_counts),'errorCounts':dict(error_counts),'semanticWarningCounts':dict(warning_counts),'hardChecks':['opaque_choice_membership','rules_lookup_no_broker','behavioral_no_foreign_broker','unresolved_authority','scenario_fact_authority','mechanics_bearing_flexible_fact','foreign_runtime_or_tool_leak','human_roll_not_fabricated','ai_does_not_claim_engine_rolls','response_contract','benchmark_provenance'],'policy':'Structural acceptance is not gold. Explicit human review/promotion remains mandatory.'}
 REPORT.write_text(json.dumps(rep,indent=2)+'\n');print(json.dumps(rep,indent=2))
if __name__=='__main__':main()

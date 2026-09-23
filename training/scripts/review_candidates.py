#!/usr/bin/env python3
from pathlib import Path
import argparse,json,textwrap
ROOT=Path(__file__).resolve().parents[1]
REVIEW=ROOT/'gold'/'review'/'review.jsonl'; REJECT=ROOT/'gold'/'rejected'/'reject.jsonl'; DEC=ROOT/'gold'/'review'/'human-decisions.jsonl'

def read(p):
 if not p.exists(): return []
 return [json.loads(x) for x in p.read_text(errors='replace').splitlines() if x.strip()]
def wrap(x,width=100): return '\n'.join(textwrap.wrap(str(x),width=width)) if x else '(none)'
def response(r):
 if not isinstance(r,dict): return '(missing)'
 return f"mode={r.get('mode')} choice={r.get('resolutionChoice')}\nreason: {r.get('reason')}\nnarration: {r.get('narration')}\nfactProposals: {json.dumps(r.get('factProposals',[]),ensure_ascii=False)}"
def show(r,i,n):
 g=r.get('generated',{}); e=r.get('authorityEnvelope',{}); v=r.get('validation',{})
 print('\n'+'='*108); print(f'[{i}/{n}] {r.get("curriculumId")}  source={r.get("source")}  category={r.get("category")}')
 print(f'validator={v.get("status")} errors={v.get("errors",[])} warnings={v.get("semanticWarnings",[])}')
 print(f'interaction={e.get("interactionKind")} broker={json.dumps(e.get("brokerOptions",[]),ensure_ascii=False)}')
 sr=e.get('sourceRuleEvidence',{}); print('\nSOURCE QUESTION:\n'+wrap(sr.get('question'))); print('\nSOURCE PASSAGE:\n'+wrap(sr.get('passage')))
 if e.get('sourceBehaviorEvidence'): print('\nBEHAVIOR EVIDENCE:\n'+wrap(json.dumps(e.get('sourceBehaviorEvidence'),ensure_ascii=False),120))
 print('\nSCENARIO:\n'+wrap(g.get('scenario'))); print('\nSCENARIO FACTS:\n'+wrap(json.dumps(g.get('scenarioFacts',[]),ensure_ascii=False),120)); print('\nPLAYER INTENT:\n'+wrap(g.get('playerIntent')))
 print('\nPREFERRED:\n'+response(g.get('preferredResponse'))); print('\nREJECTED CONTRAST:\n'+response(g.get('rejectedResponse'))); print('\nCRITIQUE:\n'+wrap(g.get('critique'))); print('\nDIMENSIONS:',g.get('dimensions'))
def write_rows(path,rows):
 with path.open('w') as f:
  for r in rows:f.write(json.dumps(r,ensure_ascii=False)+'\n')
def main():
 ap=argparse.ArgumentParser(); ap.add_argument('--include-rejected',action='store_true'); ap.add_argument('--start',type=int,default=1); a=ap.parse_args()
 review=read(REVIEW); rejected=read(REJECT) if a.include_rejected else []; rows=review+rejected
 if not rows: raise SystemExit('No candidates to review. Run validate_gold_candidates.py first.')
 decisions=[]; DEC.parent.mkdir(parents=True,exist_ok=True)
 i=max(0,a.start-1)
 while i<len(rows):
  r=rows[i]; show(r,i+1,len(rows)); ans=input('\n[g]ood  [b]ad  [e]dit-needed  [s]kip  [p]revious  [q]uit > ').strip().lower()[:1]
  if ans=='q': break
  if ans=='p': i=max(0,i-1); continue
  if ans in ('g','b','e'):
   mapping={'g':'accept','b':'reject','e':'edit'}; note=input('optional note > ').strip(); v=r.setdefault('validation',{}); v['humanReviewed']=True; v['humanDecision']=mapping[ans];
   if note:v['humanNote']=note
   decisions.append({'curriculumId':r.get('curriculumId'),'decision':mapping[ans],'note':note})
  i+=1
 # Persist decisions into their originating queues so promote_reviewed.py can enforce the human gate.
 review_ids={x.get('curriculumId'):x for x in rows}
 for x in review:
  if x.get('curriculumId') in review_ids: x.update(review_ids[x.get('curriculumId')])
 for x in rejected:
  if x.get('curriculumId') in review_ids: x.update(review_ids[x.get('curriculumId')])
 write_rows(REVIEW,review)
 if a.include_rejected: write_rows(REJECT,rejected)
 if decisions:
  with DEC.open('a') as f:
   for d in decisions:f.write(json.dumps(d,ensure_ascii=False)+'\n')
 print(f'\nSaved {len(decisions)} decision(s). Gold promotion still requires explicit accept on validator-review records.')
if __name__=='__main__':main()

#!/usr/bin/env python3
from pathlib import Path
import json,re,hashlib,collections
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'curation'/'queues'/'dnd_dm_v3.review.jsonl'
OUT=ROOT/'curation'/'queues'/'dnd_dm_v3.portable.jsonl'
REPORT=ROOT/'curation'/'reports'/'portable-behavior-report.json'

# V1.3.6 deliberately classifies only conversational/action evidence. System prompts,
# tool schemas and generic foreign-runtime instructions are excluded from theme detection.
FOREIGN=re.compile(r'<[^>]+>|\b(?:roll_dmg|roll_damage|update_hp|reset_resources|reset speed|end turn|start turn|grid coordinates?|movement coordinates?|tool call|function call)\b',re.I)
THEMES={
 'agency':(re.compile(r'\b(?:what do you|what would you|your choice|you decide|choose|player choice|player intent|decide what)\b',re.I),'Preserve player agency: present the situation and let the human choose voluntary actions.'),
 'unresolved_result':(re.compile(r'\b(?:attack|check|saving throw|save|damage|hit|miss|roll)\b',re.I),'Do not narrate an unresolved mechanical outcome; declare intent and yield to the appropriate resolution lifecycle.'),
 'turn_handoff':(re.compile(r'\b(?:your turn|their turn|next turn|initiative|round|what do you do)\b',re.I),'After authoritative turn state changes, narrate succinctly and hand control to the correct participant without foreign end-turn protocols.'),
 'target_constraints':(re.compile(r'\b(?:target|range|line of sight|visible|visibility|cover|distance|reach)\b',re.I),'Respect authoritative target, visibility, range and legality constraints; do not narrate an illegal or successful action before resolution.'),
 'resource_authority':(re.compile(r'\b(?:spell slot|resource|charge|speed|movement|reaction|bonus action|action economy|resistance|immunity|condition)\b',re.I),'Treat resources and mechanical state as deterministic engine authority; narration must not spend, reset, or invent them.'),
 'human_roll_boundary':(re.compile(r'\b(?:your|player|character)\b.{0,90}\b(?:roll|check|saving throw|save|attack)\b|\b(?:roll|check|saving throw|save|attack)\b.{0,90}\b(?:your|player|character)\b',re.I),'For a human-controlled actor, yield to the pending roll UI; the human initiates the digital die or enters a raw die and the engine resolves it.'),
 'npc_intent_engine_resolution':(re.compile(r'\b(?:goblin|orc|monster|enemy|npc|creature)\b.{0,100}\b(?:attack|move|cast|target|turn|action)\b',re.I),'The AI DM may choose an AI-controlled actor’s fictional intent/tactics; the deterministic engine resolves legality, dice, modifiers, resources and outcome.'),
 'continuity':(re.compile(r'\b(?:earlier|previous|already|remember|returned|again|promise|known|established)\b',re.I),'Maintain continuity with established events and facts; do not erase, contradict, or silently replace prior consequences.'),
 'failure_forward':(re.compile(r'\b(?:fail|failed|failure|unsuccessful|cannot|can\'t|blocked)\b',re.I),'Respect failure while keeping play moving through consequences or changed circumstances; do not manufacture success or a replacement clue.'),
 'pacing':(re.compile(r'\b(?:continue|proceed|move on|next|brief|quick|prompt|waiting)\b',re.I),'Keep the exchange moving: resolve only what is authoritative, narrate succinctly, and prompt the next meaningful player decision.'),
}
TOOL_THEME={
 'roll_dmg':'unresolved_result','roll_damage':'unresolved_result','roll_attack':'unresolved_result','roll_check':'unresolved_result','check_resist':'unresolved_result',
 'update_hp':'resource_authority','update_resource':'resource_authority','move_actor':'target_constraints','move_creature':'target_constraints','end_turn':'turn_handoff','start_turn':'turn_handoff'
}

def conversation_text(msgs):
 parts=[]
 for m in msgs if isinstance(msgs,list) else []:
  if not isinstance(m,dict): continue
  role=str(m.get('role','')).lower()
  # System/developer/tool schema text caused V1.3.4's every-theme-on-every-record collapse.
  if role in ('system','developer','tool','function'): continue
  c=m.get('content','')
  if isinstance(c,str) and c.strip(): parts.append(c)
 return '\n'.join(parts)

def snippet(text,rx,limit=220):
 m=rx.search(text)
 if not m:return None
 a=max(0,m.start()-80);b=min(len(text),m.end()+100)
 return re.sub(r'\s+',' ',text[a:b]).strip()[:limit]

def main():
 if not SRC.exists():raise SystemExit('Missing dnd_dm_v3.review.jsonl; run curate_candidates.py first')
 rows=[]; theme_counts=collections.Counter(); primary_counts=collections.Counter(); theme_cardinality=collections.Counter(); contaminated=0; fallback=0
 for line in SRC.read_text(errors='replace').splitlines():
  if not line.strip():continue
  x=json.loads(line); msgs=x.get('payload',{}).get('messages',[]); text=conversation_text(msgs)
  calls=[str(v) for v in x.get('review',{}).get('actualForeignToolCalls',[]) if v]
  scores=collections.Counter(); evidence={}
  for name,(rx,lesson) in THEMES.items():
   hits=list(rx.finditer(text));
   if hits:
    scores[name]+=min(3,len(hits)); evidence[name]=snippet(text,rx)
  for call in calls:
   low=call.lower()
   for token,theme in TOOL_THEME.items():
    if token in low:scores[theme]+=2
  if not scores:
   fallback+=1; scores['authority_discipline']=1; evidence['authority_discipline']='No specific portable theme could be safely inferred from conversational evidence.'
  ranked=sorted(scores,key=lambda k:(-scores[k],k))[:3]
  primary=ranked[0]; primary_counts[primary]+=1; theme_cardinality[len(ranked)]+=1
  lessons=[]
  for name in ranked:
   lesson=THEMES[name][1] if name in THEMES else 'Separate DM interpretation and narration from deterministic engine mechanics and persistent state.'
   lessons.append({'dimension':name,'lesson':lesson,'evidenceSignal':evidence.get(name,'foreign action signal only')})
   theme_counts[name]+=1
  bad=bool(FOREIGN.search(text) or calls); contaminated+=int(bad)
  seed={'sourceId':x['id'],'source':'dnd_dm_v3','category':x.get('review',{}).get('category','other'),'primaryBehaviorTheme':primary,'portableLessons':lessons,
        'sourceSignals':{'hadForeignRuntimeSemantics':bad,'actualForeignToolCallCount':len(calls),'conversationCharsExamined':len(text)},
        'forbiddenSemantics':['foreign tool/API names','XML-like runtime tags','coordinates/grid protocol','source-specific turn reset/end-turn procedure','foreign HP/resource mutation lifecycle','teacher-authored die results or engine outcomes'],
        'provenance':x.get('provenance',{})}
  seed['seedHash']=hashlib.sha256(json.dumps(seed,sort_keys=True).encode()).hexdigest()[:16];rows.append(seed)
 OUT.parent.mkdir(parents=True,exist_ok=True)
 with OUT.open('w') as f:
  for r in rows:f.write(json.dumps(r,ensure_ascii=False)+'\n')
 rep={'version':'1.3.6.1','built':len(rows),'themeCounts':dict(theme_counts),'primaryThemeCounts':dict(primary_counts),'lessonsPerRecord':dict(theme_cardinality),'fallbackAuthorityDiscipline':fallback,'sourceRecordsContainingForeignRuntimeSignals':contaminated,
      'policy':'Theme detection excludes system/tool-schema text. Each source receives only 1-3 evidence-supported portable lessons; raw dnd_dm_v3 messages and tool calls never enter teacher prompts.'}
 REPORT.parent.mkdir(parents=True,exist_ok=True);REPORT.write_text(json.dumps(rep,indent=2)+'\n');print(json.dumps(rep,indent=2))
if __name__=='__main__':main()

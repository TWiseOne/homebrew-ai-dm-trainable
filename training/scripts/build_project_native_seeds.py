#!/usr/bin/env python3
from pathlib import Path
import json, hashlib, collections
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'curation'/'queues'/'project_native.review.jsonl'; REP=ROOT/'curation'/'reports'/'project-native-report.json'
TEMPLATES=[
('human_attack_pending','combat','mechanics_authority',['engineAuthority','agency'],'human','human','A human-controlled hero declares a weapon attack against a legal visible target. No die has been rolled and no outcome exists.','Yield to the pending player roll interaction; never invent the die, hit, damage, or outcome.'),
('human_check_pending','checks','mechanics_authority',['engineAuthority','agency'],'human','human','A human-controlled hero attempts a risky physical task. The engine has selected the legal check; no die has been supplied.','Keep the resolution pending until the human initiates the digital roll or enters the raw die.'),
('mandatory_save_pending','saving_throws','mechanics_authority',['engineAuthority','agency'],'human','human','A human-controlled hero triggers a mandatory saving throw. The broker marks it mandatory; no die has been supplied.','A mandatory resolution cannot be vetoed, but the human-owned die remains pending until the player initiates or enters it.'),
('npc_attack_pending','combat','npc_intent_engine_resolution',['engineAuthority','agency'],'ai','engine','An AI-controlled hostile creature has a legal opportunity to attack. No attack result exists yet.','The DM may choose the creature’s fictional intent; the deterministic engine performs and resolves its mechanics and dice.'),
('resolved_attack_narration','combat','resolution_lifecycle',['engineAuthority','narrativeAuthority'],'human','human','The engine has already resolved a human-controlled hero’s attack as a miss.','Narrate the authoritative miss succinctly; do not replace it with a hit or reroll.'),
('failed_search','exploration','failure_forward',['failureForward','narrativeAuthority'],'human','human','A search has authoritatively failed and produced no new clue. A previously known footprint remains established.','Respect the failed search while keeping play moving; do not invent a replacement clue or erase previously known information.'),
('known_fact_no_check','exploration','epistemic_discipline',['epistemicDiscipline','pacing'],'human','none','The character already knows the meaning of an established symbol. No uncertainty remains that requires a check.','Surface established knowledge directly instead of inserting an unnecessary roll.'),
('missing_context_unknown','exploration','epistemic_discipline',['epistemicDiscipline','narrativeAuthority'],'human','none','A journal page is unavailable in context; its contents are not established as blank, missing, destroyed, or secret.','Treat unavailable information as unknown; do not convert missing context into a factual claim.'),
('creative_safe_colour','exploration','creative_permission',['creativePermission','narrativeAuthority'],'human','none','The location permits harmless atmospheric embellishment, but new interactable objects, clues, exits, and NPCs would become world facts.','Add ephemeral sensory colour freely while proposing or withholding persistent interactable facts.'),
('player_choice','social','agency',['agency','pacing'],'human','none','The player faces two plausible voluntary approaches and has not chosen between them.','Present the situation and preserve the player’s choice; do not decide their voluntary action for them.'),
('continuity_promise','social','continuity',['continuity','narrativeAuthority'],'human','none','An NPC previously made an established promise that is now relevant. No new obstacle has been established.','Honor established continuity without inventing a new gate merely to delay the payoff.'),
('informative_reminder','exploration','informative_dm',['informativeDm','epistemicDiscipline'],'human','none','Informative DM mode is on. An earlier player-known fact is directly relevant to the current decision.','Remind the player of relevant known information without revealing unknown facts or changing difficulty.'),
('failure_consequence','checks','failure_forward',['failureForward','agency'],'human','none','A risky attempt has authoritatively failed, but the adventure still has legitimate paths forward.','Let failure change the situation and preserve consequences without hard-blocking the adventure or manufacturing success.'),
('target_illegal','combat','target_constraints',['engineAuthority','narrativeAuthority'],'human','none','The engine says the declared target is not currently a legal target. No attack roll is requested.','Respect target legality; do not narrate an attack roll, hit, or damage for an illegal action.'),
('resource_unavailable','spellcasting','resource_authority',['engineAuthority','agency'],'human','none','The engine says a requested resource is unavailable.','Do not invent, reset, or spend unavailable resources; explain the constraint and preserve the player’s next choice.'),
]

def hid(s): return hashlib.sha256(s.encode()).hexdigest()[:16]
def main():
 rows=[]; counts=collections.Counter()
 # 22 variants per template = 330 project-authored seeds. Variants are scenario IDs, not invented mechanics.
 for name,cat,theme,dims,controller,roll_owner,situation,lesson in TEMPLATES:
  for i in range(22):
   sid=f'project_native:{name}:{i+1:02d}'
   rows.append({'id':sid,'source':'project_native','category':cat,'primaryBehaviorTheme':theme,'dimensions':dims,
    'situationSeed':situation,'portableLesson':lesson,'controller':controller,'rollOwner':roll_owner,
    'resultStatus':'resolved' if name=='resolved_attack_narration' else 'unresolved',
    'authoritativeResult':{'outcome':'miss'} if name=='resolved_attack_narration' else None,
    'requiresBroker': name in {'human_attack_pending','human_check_pending','mandatory_save_pending','npc_attack_pending'},
    'mandatory': name=='mandatory_save_pending','seedVariant':i+1,'seedHash':hid(sid),
    'provenance':{'kind':'project_authored_training_template','version':'1.3.6.1'}}); counts[theme]+=1
 OUT.parent.mkdir(parents=True,exist_ok=True)
 with OUT.open('w') as f:
  for r in rows:f.write(json.dumps(r,ensure_ascii=False)+'\n')
 rep={'version':'1.3.6.1','built':len(rows),'themeCounts':dict(counts),'policy':'Project-authored V6.5-native seeds teach product-specific authority, roll lifecycle, agency, continuity and narrative craft without importing foreign mechanics.'}
 REP.parent.mkdir(parents=True,exist_ok=True);REP.write_text(json.dumps(rep,indent=2)+'\n');print(json.dumps(rep,indent=2))
if __name__=='__main__':main()

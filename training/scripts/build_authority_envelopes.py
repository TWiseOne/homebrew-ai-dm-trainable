#!/usr/bin/env python3
from pathlib import Path
import argparse,json,hashlib,collections,re
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'gold'/'prompts'/'curriculum.jsonl'; OUT=ROOT/'gold'/'prompts'/'authority-envelopes.jsonl'; REPORT=ROOT/'gold'/'reports'/'authority-envelope-report.json'

def hid(s): return hashlib.sha256(s.encode()).hexdigest()[:12]
def option_for(cat,sid):
    req='mandatory' if cat in ('saving_throws','death') else 'optional'
    return {'id':f'res_{cat}_{hid(sid)}','requirement':req,'description':f'Engine-owned {cat} resolution grounded in supplied source evidence.'}

def classify_srd(question):
    q=' '.join((question or '').lower().split())
    # Anchor-pair records are questions about rules unless they explicitly describe a player/actor
    # attempting an in-fiction action now. Topic words such as attack, movement, spell or save do not
    # themselves make a lookup a game resolution.
    action_patterns=(
      r'^(?:i|we|my character|the player|the character)\s+(?:try|tries|attempt|attempts|use|uses|cast|casts|attack|attacks|move|moves|drink|drinks|make|makes|take|takes)\b',
      r'\bwhat (?:check|save|saving throw|roll) (?:do|does|should|would) (?:i|the player|the character) make\b',
      r'\b(?:can|may) (?:i|the player|the character) (?:try|attempt|use|cast|attack|move)\b.*\b(?:now|here|this turn|this round)\b'
    )
    return 'mechanical_scenario' if any(re.search(p,q) for p in action_patterns) else 'informational_rules'

def portable_behavior(evidence):
    # V1.3.6.1 security boundary: the classifier may retain verbatim evidenceSignal
    # internally for audit/review, but NO source excerpt from dnd_dm_v3 is teacher-visible.
    # Only the normalized portable lesson text crosses into the authority envelope.
    lessons=[]
    for item in evidence.get('portableLessons',[]):
        if not isinstance(item,dict):
            continue
        lessons.append({'dimension':item.get('dimension','authority_discipline'),
                        'lesson':item.get('lesson','Separate DM narration from deterministic engine authority.')})
    return {'primaryBehaviorTheme':evidence.get('primaryBehaviorTheme','authority_discipline'),
            'portableLessons':lessons,
            'forbiddenSemantics':evidence.get('forbiddenSemantics',[]),
            'sourceSignals':evidence.get('sourceSignals',{})}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--limit',type=int,default=0); a=ap.parse_args()
    rows=[]; counts=collections.Counter(); kinds=collections.Counter(); roll_counts=collections.Counter()
    for line in SRC.read_text(errors='replace').splitlines():
        if not line.strip(): continue
        x=json.loads(line); ev=x['sourceEvidence']; src=ev.get('source'); cat=ev.get('category','other'); sid=ev['sourceId']
        if src=='srd_anchor_pairs':
            rule={'question':ev.get('ruleQuestion',''),'passage':ev.get('rulePassage','')}; kind=classify_srd(rule['question'])
            behavior=[]
        elif src=='dnd_dm_v3':
            rule={'question':'','passage':''}; kind='behavioral_scenario'; behavior=portable_behavior(ev)
        else:
            rule={'question':'','passage':''}; kind='project_native_scenario'; behavior={'primaryBehaviorTheme':ev.get('primaryBehaviorTheme'),'portableLesson':ev.get('portableLesson'),'situationSeed':ev.get('situationSeed'),'controller':ev.get('controller'),'rollOwner':ev.get('rollOwner')}
        if kind=='project_native_scenario' and ev.get('requiresBroker'):
            options=[{'id':f"res_native_{hid(sid)}",'requirement':'mandatory' if ev.get('mandatory') else 'optional','description':'Project-authored V6.5-native resolution option.'}]
        else:
            options=[] if kind in ('informational_rules','behavioral_scenario','project_native_scenario') else [option_for(cat,sid)]
        # Calibration examples that actually require a human PC roll are authored by the teacher only
        # when the envelope supplies a mechanical option. The human-roll contract is nevertheless
        # present on every envelope so behavioral examples can teach not to fabricate player rolls.
        roll_policy={
          'humanControlledActorDefault':'human',
          'humanRollMethods':['user_initiated_digital','manual_raw_die_input'],
          'aiMayGenerateHumanRoll':False,
          'engineAppliesModifiers':True,
          'engineDeterminesOutcome':True,
          'npcMonsterDefault':'engine',
          'pendingState':'awaiting_player_roll',
          'resolvedState':'resolved'
        }
        env={'id':x['id'],'sourceId':sid,'source':src,'category':cat,'dimensions':x.get('dimensions',[]),
          'authorityEnvelope':{
            'interactionKind':kind,
            'sourceRuleEvidence':rule,
            'sourceBehaviorEvidence':behavior,
            'foreignRuntimeSemantics':'non_authoritative_behavioral_inspiration_only' if src=='dnd_dm_v3' else None,
            'actualForeignToolCalls':[],
            'brokerOptions':options,
            'authoritativeResult':ev.get('authoritativeResult') if src=='project_native' else None,'resultStatus':ev.get('resultStatus','unresolved') if src=='project_native' else 'unresolved','rulesMayBeInvented':False,'engineResultMayBeInvented':False,
            'unknownFactsRemainUnknown':True,
            'scenarioFactAuthorities':['established','engine','flexible'],
            'mechanicsBearingFlexibleFactsAllowed':False,
            'sourceIdentityMustBePreserved':True,
            'rollPolicy':roll_policy
          }}
        rows.append(env); counts[src]+=1; kinds[kind]+=1; roll_counts['human_roll_contract']+=1
        if a.limit and len(rows)>=a.limit: break
    OUT.parent.mkdir(parents=True,exist_ok=True)
    with OUT.open('w') as f:
        for r in rows:f.write(json.dumps(r,ensure_ascii=False)+'\n')
    rep={'version':'1.3.6.1','built':len(rows),'sourceCounts':dict(counts),'interactionKinds':dict(kinds),'rollPolicyCoverage':dict(roll_counts),
      'invariants':['broker_ids_precomputed','rules_lookups_default_informational','external_authoritative_result_unresolved','project_native_resolved_result_must_be_pre_authored','teacher_cannot_author_rules','teacher_cannot_author_engine_result','unknown_facts_remain_unknown','mechanics_bearing_flexible_facts_forbidden','source_identity_preserved','raw_foreign_runtime_excluded_from_teacher_prompts','portable_behavior_seed_only','behavior_themes_evidence_supported_1_to_3','source_aware_curriculum_composition','foreign_behavior_theme_caps_enforced','project_native_behavior_coverage','pending_human_roll_yields_to_ui','ai_selects_npc_intent_engine_resolves_mechanics','human_controlled_rolls_are_human_initiated_or_input','ai_cannot_generate_human_roll','engine_applies_modifiers_and_resolves_outcome']}
    REPORT.write_text(json.dumps(rep,indent=2)+'\n'); print(json.dumps(rep,indent=2))
if __name__=='__main__': main()

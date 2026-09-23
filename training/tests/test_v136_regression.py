#!/usr/bin/env python3
import unittest, importlib.util, pathlib, json, tempfile, subprocess, sys, re
ROOT=pathlib.Path(__file__).resolve().parents[2]
SCRIPTS=ROOT/'training'/'scripts'
def load(name):
 spec=importlib.util.spec_from_file_location(name,SCRIPTS/f'{name}.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
bc=load('build_curriculum'); be=load('build_authority_envelopes'); san=load('sanitize_dm_behavior'); gen=load('generate_gold_candidates')
class V136Regression(unittest.TestCase):
 def test_srd_lookup_stays_informational(self):
  for q in ['What is the range of Fireball?','How does a saving throw work?','What is the Attack action?']:
   self.assertEqual(be.classify_srd(q),'informational_rules')
 def test_explicit_current_action_can_be_mechanical(self):
  self.assertEqual(be.classify_srd('I try to attack now'),'mechanical_scenario')
 def test_system_tool_text_excluded_from_behavior_detection(self):
  msgs=[{'role':'system','content':'attack roll damage target end turn resource'}, {'role':'user','content':'I remember the old promise.'}]
  txt=san.conversation_text(msgs)
  self.assertNotIn('attack roll damage',txt); self.assertIn('promise',txt)
 def test_foreign_theme_caps_bound_external_behavior(self):
  dm=[]
  for theme in bc.DM_THEME_CAPS:
   for i in range(500):dm.append({'sourceId':f'{theme}:{i}','source':'dnd_dm_v3','primaryBehaviorTheme':theme})
  chosen,used=bc.select_dm(dm,9999)
  self.assertTrue(all(used[t] <= cap for t,cap in bc.DM_THEME_CAPS.items()))
  self.assertEqual(len(chosen),sum(bc.DM_THEME_CAPS.values()))
 def test_known_v135_distribution_cannot_be_forced_to_400(self):
  counts={'unresolved_result':1367,'turn_handoff':119,'resource_authority':19,'failure_forward':13,'npc_intent_engine_resolution':48,'continuity':42,'target_constraints':4,'agency':14,'pacing':6,'human_roll_boundary':1}
  dm=[]
  for theme,n in counts.items():
   for i in range(n):dm.append({'sourceId':f'{theme}:{i}','source':'dnd_dm_v3','primaryBehaviorTheme':theme})
  chosen,used=bc.select_dm(dm,400)
  self.assertLess(len(chosen),400)
  self.assertLessEqual(used['unresolved_result'],120)
  self.assertGreater(len(chosen),250)
 def test_project_native_has_broad_coverage(self):
  src=(SCRIPTS/'build_project_native_seeds.py').read_text()
  themes=set(re.findall(r"\('[^']+','[^']+','([^']+)'",src))
  self.assertGreaterEqual(len(themes),10)
 def test_stratified_sampling_includes_sources(self):
  rows=[]
  for src,n in [('srd_anchor_pairs',65),('dnd_dm_v3',20),('project_native',15)]:
   for i in range(n):rows.append({'id':f'{src}:{i}','source':src,'authorityEnvelope':{'sourceBehaviorEvidence':{'primaryBehaviorTheme':f't{i%5}'}}})
  got=gen.sample_rows(rows,50,'stratified'); c={s:sum(r['source']==s for r in got) for s in ('srd_anchor_pairs','dnd_dm_v3','project_native')}
  self.assertEqual(sum(c.values()),50)
  self.assertEqual(c['dnd_dm_v3'],10)
  self.assertIn(c['srd_anchor_pairs'],(32,33)); self.assertIn(c['project_native'],(7,8))
 def test_human_roll_contract_present_in_generator_prompt(self):
  s=gen.SYSTEM
  self.assertIn('awaiting_player_roll',s);self.assertIn('AI DM NEVER invents',s);self.assertIn("digital die",s)
 def test_foreign_runtime_forbidden_in_generator_prompt(self):
  self.assertIn('Never recreate or guess the original runtime',gen.SYSTEM)
 def test_npc_intent_engine_boundary_present(self):
  self.assertIn('AI DM may choose fictional intent',gen.SYSTEM);self.assertIn('deterministic engine owns dice',gen.SYSTEM)
 def test_teacher_visible_portable_behavior_strips_verbatim_evidence(self):
  raw={'primaryBehaviorTheme':'turn_handoff','portableLessons':[{'dimension':'turn_handoff','lesson':'Hand control to the correct participant.','evidenceSignal':'say <End Turn/> then <DM/>last turn: Goblin 1 at [3, 8, -1]'}], 'forbiddenSemantics':['XML-like runtime tags'],'sourceSignals':{'hadForeignRuntimeSemantics':True}}
  got=be.portable_behavior(raw)
  blob=json.dumps(got)
  self.assertNotIn('evidenceSignal',blob)
  self.assertNotRegex(blob,re.compile(r'<End Turn|<DM|last turn:|\[\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*\]',re.I))
  self.assertIn('Hand control to the correct participant.',blob)
 def test_final_authority_envelope_leak_scanner_patterns(self):
  # These are the concrete integration leaks found against the real V1.3.6 corpus.
  leak=re.compile(r'<\s*(?:End\s*Turn|DM|Call)\b|\blast\s+turn\s*:|\b(?:roll_dmg|roll_damage|update_hp|reset_resources)\b|\b(?:movement|grid)\s+coordinates?\b|\[\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*\]',re.I)
  bad='{"sourceBehaviorEvidence":{"evidenceSignal":"say <End Turn/> <DM/>last turn: Goblin at [3,8,-1]"}}'
  good=json.dumps(be.portable_behavior({'primaryBehaviorTheme':'turn_handoff','portableLessons':[{'dimension':'turn_handoff','lesson':'Hand control to the correct participant.','evidenceSignal':'say <End Turn/>'}]}))
  self.assertRegex(bad,leak); self.assertNotRegex(good,leak)
if __name__=='__main__':unittest.main(verbosity=2)

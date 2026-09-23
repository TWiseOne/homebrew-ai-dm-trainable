#!/usr/bin/env python3
from pathlib import Path
import subprocess,sys,json,tempfile,shutil,os,re
ROOT=Path(__file__).resolve().parents[2]
def run(cmd):
 print('+',' '.join(map(str,cmd))); return subprocess.run(cmd,cwd=ROOT,check=True,text=True,capture_output=False)
def main():
 run([sys.executable,'-m','compileall','-q','training/scripts','training/tests'])
 run([sys.executable,'-m','unittest','discover','-s','training/tests','-p','test_*.py','-v'])
 # Generate project-native seeds and assert schema/coverage.
 run([sys.executable,'training/scripts/build_project_native_seeds.py'])
 p=ROOT/'training/curation/queues/project_native.review.jsonl'; rows=[json.loads(x) for x in p.read_text().splitlines() if x.strip()]
 assert len(rows)==330 and len({r['primaryBehaviorTheme'] for r in rows})>=10
 assert all(r['provenance']['version']=='1.3.6.1' for r in rows)
 # If a real authority envelope exists, scan the final teacher-visible artifact as an integration gate.
 leak=re.compile(r'<\s*(?:End\s*Turn|DM|Call)\b|\blast\s+turn\s*:|\b(?:roll_dmg|roll_damage|update_hp|reset_resources)\b|\b(?:movement|grid)\s+coordinates?\b|\[\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*\]',re.I)
 env=ROOT/'training/gold/prompts/authority-envelopes.jsonl'
 if env.exists():
  hits=[(i,l[:500]) for i,l in enumerate(env.read_text(errors='replace').splitlines(),1) if leak.search(l)]
  assert not hits, f'Foreign runtime leakage in final authority envelopes: {hits[:5]}'
 print('V1.3.6.1 regression PASS: compile + unit + project-native generation + final-envelope leak gate')
if __name__=='__main__':main()

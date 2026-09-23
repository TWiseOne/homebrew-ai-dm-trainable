#!/usr/bin/env python3
import argparse, hashlib, json, random
from pathlib import Path

SYSTEM = "You are the fiction and judgment layer of an AI Dungeon Master. Respect engine authority, player-visible knowledge, established canon, player agency, and narrative authority. Be succinct and engaging. Do not invent decision-relevant facts outside explicitly flexible space."

def dump_jsonl(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as f:
        for row in rows: f.write(json.dumps(row, ensure_ascii=False) + '\n')

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--source', default='training/datasets/source/preferences-v1.json'); ap.add_argument('--out', default='training/datasets/exports'); ap.add_argument('--seed', type=int, default=6501); ap.add_argument('--validation-fraction', type=float, default=.2); args=ap.parse_args()
    src=Path(args.source); out=Path(args.out); prefs=json.loads(src.read_text(encoding='utf-8'))
    # Split by example ID before rendering. Never read evals/ or eval result files here.
    ids=[p['id'] for p in prefs]; rng=random.Random(args.seed); rng.shuffle(ids)
    n=max(1, round(len(ids)*args.validation_fraction)); val=set(ids[:n])
    def sft(p): return {'id':p['id'],'messages':[{'role':'system','content':SYSTEM},{'role':'user','content':p['scenario']},{'role':'assistant','content':p['good']}],'dimensions':p['dimensions'],'provenance':p['provenance']}
    def pref(p): return {'id':p['id'],'prompt':[{'role':'system','content':SYSTEM},{'role':'user','content':p['scenario']}],'chosen':p['good'],'rejected':p['bad'],'dimensions':p['dimensions'],'provenance':p['provenance']}
    train=[p for p in prefs if p['id'] not in val]; valid=[p for p in prefs if p['id'] in val]
    files={'sft-train.jsonl':[sft(p) for p in train], 'sft-validation.jsonl':[sft(p) for p in valid], 'preference-train.jsonl':[pref(p) for p in train], 'preference-validation.jsonl':[pref(p) for p in valid]}
    for name,rows in files.items(): dump_jsonl(out/name, rows)
    manifest={'datasetVersion':'training-v1','seed':args.seed,'source':str(src),'sourceSha256':sha(src),'total':len(prefs),'train':len(train),'validation':len(valid),'validationIds':sorted(val),'benchmarkExcluded':True,'files':{n:sha(out/n) for n in files}}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8'); print(json.dumps(manifest,indent=2))
if __name__=='__main__': main()

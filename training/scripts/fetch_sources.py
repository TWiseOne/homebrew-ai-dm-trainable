#!/usr/bin/env python3
from pathlib import Path
import argparse, hashlib, json, shutil, subprocess, sys, urllib.request

ROOT=Path(__file__).resolve().parents[1]
REG=json.loads((ROOT/'sources/source-registry.json').read_text())
CACHE=ROOT/'cache'

def sha_file(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()

def sha_tree(p):
    h=hashlib.sha256()
    for f in sorted(x for x in p.rglob('*') if x.is_file() and '.git' not in x.parts):
        h.update(str(f.relative_to(p)).encode()); h.update(b'\0')
        with f.open('rb') as fh:
            for b in iter(lambda:fh.read(1024*1024),b''): h.update(b)
    return h.hexdigest()

def fetch_url(s):
    suffix=s.get('cacheSuffix') or ('.jsonl' if s['download'].endswith('.jsonl') else '.bin')
    p=CACHE/(s['id']+suffix)
    urllib.request.urlretrieve(s['download'],p)
    return p

def fetch_hf_dataset(s):
    try:
        from datasets import load_dataset
    except ImportError as e:
        raise RuntimeError("Hugging Face source requires the 'datasets' package; run: pip install -r training/requirements.txt") from e
    dataset_id=s['datasetId']
    split=s.get('split','train')
    ds=load_dataset(dataset_id, split=split)
    p=CACHE/(s['id']+'.parquet')
    ds.to_parquet(str(p))
    return p

def fetch_git(s):
    if shutil.which('git') is None:
        raise RuntimeError("Git source requires 'git' on PATH")
    p=CACHE/s['id']
    if p.exists(): shutil.rmtree(p)
    # Let Git discover the repository's default branch; do not assume main/master.
    subprocess.run(['git','clone','--depth','1',s['repo'],str(p)],check=True)
    return p

def describe(s,p):
    if p.is_dir():
        files=sum(1 for x in p.rglob('*') if x.is_file() and '.git' not in x.parts)
        size=sum(x.stat().st_size for x in p.rglob('*') if x.is_file() and '.git' not in x.parts)
        digest=sha_tree(p); kind='directory'; cached=p.name
    else:
        files=1; size=p.stat().st_size; digest=sha_file(p); kind='file'; cached=p.name
    return {'id':s['id'],'cache':cached,'cacheKind':kind,'files':files,'bytes':size,'sha256':digest,
            'license':s['license'],'status':s['status'],'sourceUrl':s['url'],'fetchMode':s.get('fetchMode','url')}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--include-quarantine',action='store_true')
    ap.add_argument('--source',action='append')
    a=ap.parse_args()
    CACHE.mkdir(exist_ok=True)
    manifest=[]; failures=[]
    selected={s['id'] for s in REG['sources'] if (not a.source or s['id'] in a.source)}
    unknown=set(a.source or [])-{s['id'] for s in REG['sources']}
    if unknown:
        print('ERROR unknown source(s):',', '.join(sorted(unknown)),file=sys.stderr); return 2
    for s in REG['sources']:
        if s['id'] not in selected: continue
        if s['status']=='quarantine' and not a.include_quarantine:
            print('SKIP quarantine',s['id']); continue
        mode=s.get('fetchMode','url')
        print('FETCH',s['id'],mode,s.get('datasetId') or s.get('repo') or s.get('download'))
        try:
            if mode=='huggingface_dataset': p=fetch_hf_dataset(s)
            elif mode=='git': p=fetch_git(s)
            elif mode=='url': p=fetch_url(s)
            else: raise RuntimeError(f'unsupported fetchMode: {mode}')
            item=describe(s,p); manifest.append(item)
            print('OK',s['id'],item['bytes'],'bytes',item['sha256'][:12])
        except Exception as e:
            failures.append({'id':s['id'],'error':f'{type(e).__name__}: {e}'})
            print('FAIL',s['id'],failures[-1]['error'],file=sys.stderr)
    doc={'sources':manifest,'failures':failures,'requested':sorted(selected)}
    (CACHE/'download-manifest.json').write_text(json.dumps(doc,indent=2)+'\n')
    print('WROTE',CACHE/'download-manifest.json')
    print(f'SUMMARY ok={len(manifest)} failed={len(failures)}')
    if failures:
        print('FAILED:',', '.join(x['id'] for x in failures),file=sys.stderr); return 1
    return 0

if __name__=='__main__': raise SystemExit(main())

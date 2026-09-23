#!/usr/bin/env python3
from pathlib import Path
import json, collections
ROOT=Path(__file__).resolve().parents[1]; REG=json.loads((ROOT/'sources/source-registry.json').read_text())
print('AI RPG Training Source Pool')
for s in REG['sources']: print(f"{s['status'].upper():10} {s['id']:18} {s['license']}")
print('\nPolicy: external records are candidates, not automatic SFT. Quarantine never enters training exports.')

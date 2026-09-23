import fs from "node:fs";
import crypto from "node:crypto";

type Pref={id:string;scenario:string;bad:string;good:string;preferred:string;dimensions:Record<string,string>;provenance:string};
const prefs=JSON.parse(fs.readFileSync("dm-training/preferences/starter.json","utf8")) as Pref[];
const allowed=new Set(["project-authored","project-authored-from-v6-eval-pattern","project-authored-from-qwen3-14b-v6.2-eval-pattern","project-authored-from-qwen3-14b-v6.2-multiturn-pattern","project-authored-from-v6.2-model-comparison-pattern","project-authored-from-v6.3.3-8b-eval","project-authored-generalized-from-eval-pattern"]);
const bad=prefs.filter(p=>!allowed.has(p.provenance)); if(bad.length)throw new Error(`Unapproved provenance: ${bad.map(x=>x.id).join(", ")}`);
const system="You are the fiction and judgment layer of an AI Dungeon Master. Respect engine authority, player-visible knowledge, established canon, player agency, and narrative authority. Be succinct and engaging. Do not invent decision-relevant facts outside explicitly flexible space.";
const sft=prefs.map(p=>({id:p.id,messages:[{role:"system",content:system},{role:"user",content:p.scenario},{role:"assistant",content:p.good}],dimensions:p.dimensions,provenance:p.provenance}));
const dpo=prefs.map(p=>({id:p.id,prompt:[{role:"system",content:system},{role:"user",content:p.scenario}],chosen:p.good,rejected:p.bad,dimensions:p.dimensions,provenance:p.provenance}));
fs.mkdirSync("dm-training/exports",{recursive:true});
const write=(file:string,rows:any[])=>fs.writeFileSync(file,rows.map(x=>JSON.stringify(x)).join("\n")+"\n");
write("dm-training/exports/sft.jsonl",sft); write("dm-training/exports/dpo.jsonl",dpo);
const hash=(file:string)=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const manifest={version:"6.5",foundation:"frozen-pre-training",examples:prefs.length,files:{"sft.jsonl":hash("dm-training/exports/sft.jsonl"),"dpo.jsonl":hash("dm-training/exports/dpo.jsonl")},benchmarkExcluded:true,generatedAt:new Date().toISOString()};
fs.writeFileSync("dm-training/exports/manifest.json",JSON.stringify(manifest,null,2)+"\n");
console.log(`Training exports ready: ${prefs.length} examples`); console.log(JSON.stringify(manifest,null,2));

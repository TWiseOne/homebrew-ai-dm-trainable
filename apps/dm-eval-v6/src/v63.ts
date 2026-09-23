import fs from "node:fs"; import path from "node:path";
type Requirement="mandatory"|"optional"; type Opt={id:string;label:string;engine:string;requirement?:Requirement;applicability?:string};
type Fact={id:string;text:string;protection:"protected"|"established"|"flexible";visibility:"player"|"dm_only";provenance:string};
type Scenario={id:string;category:string;scene:string;player:string;facts:Fact[];options:Opt[];expectedMode:"narrate"|"resolve"|"reject";expectedChoice?:string;requiredAny?:string[];forbiddenTerms?:string[];maxProposals?:number};
type Proposal={text:string;kind:"sensory"|"flexible_world_fact";basisFactIds:string[]};
type Common={factProposals:Proposal[];reason:string;narration:string};
type R=({mode:"narrate"}|{mode:"reject"}|{mode:"resolve";resolutionChoice:string})&Common;
const arg=(n:string,d:string)=>{const i=process.argv.indexOf(n);return i>=0&&process.argv[i+1]?process.argv[i+1]:d}; const model=arg("--model",process.env.DM_MODEL||"qwen3:8b"),runs=Math.max(1,+arg("--runs","1")); const base=(process.env.OLLAMA_BASE_URL||"http://127.0.0.1:11434/v1").replace(/\/$/,""); const timeout=Math.max(1000,+arg("--timeout-ms",process.env.DM_REQUEST_TIMEOUT_MS||"180000"));
const proposalSchema={type:"object",additionalProperties:false,required:["text","kind","basisFactIds"],properties:{text:{type:"string"},kind:{type:"string",enum:["sensory","flexible_world_fact"]},basisFactIds:{type:"array",items:{type:"string"}}}};
const commonProps={factProposals:{type:"array",items:proposalSchema,maxItems:3},reason:{type:"string"},narration:{type:"string"}};
const schema={oneOf:[
  {type:"object",additionalProperties:false,required:["mode","factProposals","reason","narration"],properties:{mode:{const:"narrate"},...commonProps}},
  {type:"object",additionalProperties:false,required:["mode","resolutionChoice","factProposals","reason","narration"],properties:{mode:{const:"resolve"},resolutionChoice:{type:"string",minLength:1},...commonProps}},
  {type:"object",additionalProperties:false,required:["mode","factProposals","reason","narration"],properties:{mode:{const:"reject"},...commonProps}}
]};
const system=`You are the fiction/judgment layer of an AI Dungeon Master. The engine owns mechanics and the FACT LEDGER owns established truth.
RESPONSE CONTRACT:
- narrate/reject responses MUST NOT contain resolutionChoice.
- resolve responses MUST contain exactly one supplied resolutionChoice.
RESOLUTION BROKER:
- Mandatory options are triggered by authoritative state. If a mandatory option is present and triggered, select it; player narration cannot waive it.
- Optional options may be selected only when their applicability matches the player's actual approach. Availability does not imply applicability. Never silently substitute a different action.
FACT DISCIPLINE:
- protected/established facts may be narrated but never contradicted, strengthened, or extended into new evidence.
- dm_only facts must never be revealed to the player.
- Missing context means UNKNOWN TO YOU, not absent from the world. Never turn "not supplied" into blank, empty, missing, harmless, impossible, or nonexistent.
- Epistemic discipline: distinguish ESTABLISHED facts from INFERENCE, SPECULATION, and ESTABLISHED-UNKNOWN. Informative mode should remind established facts and known uncertainty; do not volunteer speculative theories unless the player explicitly asks for hypotheses.
- You may add disposable sensory presentation directly only when it cannot reasonably become an interactable object, clue, route, location feature, NPC, relationship, rule, or consequence.
- Any NEW persistent or decision-relevant world fact must go in factProposals, not be asserted as true in narration. Proposals must cite basisFactIds and may only elaborate FLEXIBLE facts. Never propose changes to protected facts.
- Do not invent letters' contents or absence of contents, clues, keys, doors/windows, architecture, hazards, NPC motives, signatures, magic, destinations, rewards, complications, or consequences merely to make a scene interesting.
- Pay off established promises directly when the promised help is relevant; do not add a replacement obstacle or new price unless established.
Return JSON only. Be succinct and engaging.`;
const low=(x:any)=>String(x??"").toLowerCase(); const parse=(x:string)=>{try{return JSON.parse(x) as R}catch{return null}};
function score(s:Scenario,r:R|null){
 const protocol:string[]=[],broker:string[]=[],authority:string[]=[],craft:string[]=[];
 if(!r)return{protocol:["invalid_json"],broker,authority,craft,pass:false};
 const ids=s.options.map(o=>o.id),mandatory=s.options.filter(o=>o.requirement==="mandatory");
 const choice=r.mode==="resolve"?r.resolutionChoice:undefined;
 if(r.mode!==s.expectedMode)broker.push(`mode:${r.mode}!=${s.expectedMode}`);
 if(choice&&!ids.includes(choice))broker.push(`invented_choice:${choice}`);
 if(s.expectedChoice&&choice!==s.expectedChoice)broker.push(`choice:${choice??"none"}!=${s.expectedChoice}`);
 if(mandatory.length===1&&choice!==mandatory[0].id)broker.push(`mandatory_not_selected:${mandatory[0].id}`);
 const narr=low(r.narration);
 if(s.requiredAny?.length&&!s.requiredAny.some(x=>narr.includes(low(x))))craft.push(`missing:${s.requiredAny.join("|")}`);
 for(const x of s.forbiddenTerms??[])if(narr.includes(low(x)))authority.push(`unsupported:${x}`);
 const visible=new Set(s.facts.filter(f=>f.visibility==="player").map(f=>f.id));
 const flexible=new Set(s.facts.filter(f=>f.protection==="flexible"&&f.visibility==="player").map(f=>f.id));
 for(const p of r.factProposals??[]){
   if(!p.basisFactIds.length)authority.push("proposal_without_basis");
   for(const id of p.basisFactIds){if(!visible.has(id))authority.push(`proposal_hidden_or_unknown_basis:${id}`);if(p.kind==="flexible_world_fact"&&!flexible.has(id))authority.push(`proposal_nonflexible_basis:${id}`);}
 }
 if((r.factProposals??[]).length>(s.maxProposals??3))authority.push("too_many_proposals");
 if(r.narration.length>520)craft.push("overlong");
 return{protocol,broker,authority,craft,pass:![...protocol,...broker,...authority,...craft].length}
}
async function call(s:Scenario){const opts=s.options.length?s.options.map(o=>`- ${o.id} (${o.requirement??"optional"}): ${o.label} [${o.engine}]${o.applicability?` | applicability: ${o.applicability}`:""}`).join("\n"):"(none)";const facts=s.facts.map(f=>`- ${f.id} [${f.protection}; ${f.visibility}; ${f.provenance}]: ${f.text}`).join("\n")||"(none)";const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);try{const resp=await fetch(`${base}/chat/completions`,{method:"POST",signal:c.signal,headers:{"content-type":"application/json","authorization":`Bearer ${process.env.OLLAMA_API_KEY||"ollama"}`},body:JSON.stringify({model,temperature:0.2,response_format:{type:"json_schema",json_schema:{name:"dm_v633",strict:true,schema}},messages:[{role:"system",content:system},{role:"user",content:`CURRENT SCENE:\n${s.scene}\n\nFACT LEDGER:\n${facts}\n\nENGINE RESOLUTION OPTIONS:\n${opts}\n\nPLAYER:\n${s.player}\n\nRespond using only supplied authority. New persistent facts require proposals.`}]})});if(!resp.ok)throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);const j:any=await resp.json();return String(j.choices?.[0]?.message?.content??"")}finally{clearTimeout(timer)}}
const scenarios=JSON.parse(fs.readFileSync(path.resolve("evals/v6/v6.3-scenarios.json"),"utf8")) as Scenario[];const results:any[]=[];for(const s of scenarios)for(let run=1;run<=runs;run++){const st=Date.now();try{const raw=await call(s),response=parse(raw),axes=score(s,response);results.push({scenario:s.id,category:s.category,run,pass:axes.pass,axes,latencyMs:Date.now()-st,response,raw});process.stdout.write(axes.pass?".":axes.broker.length?"b":axes.authority.length?"a":"F")}catch(e:any){results.push({scenario:s.id,category:s.category,run,pass:false,axes:{protocol:["transport"],broker:[],authority:[],craft:[]},error:String(e),latencyMs:Date.now()-st});process.stdout.write("T")}}
const valid=results.filter(x=>x.response),passed=results.filter(x=>x.pass).length;const axis=(k:string)=>{const p=valid.filter(x=>x.axes[k].length===0).length;return{passed:p,total:valid.length,percent:valid.length?+(p/valid.length*100).toFixed(1):0}};const avg=Math.round(results.reduce((a,x)=>a+x.latencyMs,0)/Math.max(1,results.length));const summary={overall:{passed,total:results.length,percent:+(passed/results.length*100).toFixed(1)},protocol:{passed:valid.length,total:results.length,percent:+(valid.length/results.length*100).toFixed(1)},broker:axis("broker"),authority:axis("authority"),craft:axis("craft"),avgLatencyMs:avg};console.log(`\nV6.3.3 Fact Ledger | ${model} | ${passed}/${results.length} (${summary.overall.percent}%) | avg ${avg}ms`);for(const r of results.filter(x=>!x.pass))console.log(`- ${r.scenario}: ${JSON.stringify(r.axes)} | ${String(r.raw||r.error).replace(/\s+/g," ").slice(0,350)}`);fs.mkdirSync("data/eval-results",{recursive:true});const out=`data/eval-results/dm-eval-v6.3.3-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;fs.writeFileSync(out,JSON.stringify({version:"6.3.3",architecture:"fact-ledger+resolution-broker",model,runs,summary,results},null,2));console.log(`Saved: ${out}`);process.exitCode=passed===results.length?0:2;

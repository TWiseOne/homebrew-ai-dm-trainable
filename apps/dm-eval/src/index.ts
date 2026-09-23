import fs from "node:fs";
import path from "node:path";

type Scenario={id:string;category:string;state:string;player:string;expected:string;ability?:string;skill?:string;forbidden?:string[];forbiddenTerms?:string[];requiredAny?:string[];note:string};
type Decision={decision:string;capability?:string|null;ability?:string|null;skill?:string|null;reason?:string;narration?:string};
type Axis={pass:boolean;issues:string[]};
type Principle={id:string;tags:string[];principle:string};
type Pair={id:string;tags:string[];situation:string;bad:string;good:string;why:string};
const arg=(name:string,def:string)=>{const i=process.argv.indexOf(name);return i>=0&&process.argv[i+1]?process.argv[i+1]:def};
const runs=Math.max(1,Number(arg("--runs",process.env.DM_EVAL_RUNS||"3")));
const model=arg("--model",process.env.DM_MODEL||"qwen3:8b");
const base=(process.env.OLLAMA_BASE_URL||"http://127.0.0.1:11434/v1").replace(/\/$/,"");
const temperature=Number(arg("--temperature",process.env.DM_EVAL_TEMPERATURE||"0.2"));
const requestTimeoutMs=Math.max(1000,Number(arg("--timeout-ms",process.env.DM_REQUEST_TIMEOUT_MS||"180000")));
const maxAttempts=Math.max(1,Number(arg("--attempts",process.env.DM_REQUEST_ATTEMPTS||"2")));
const protocolAttempts=Math.max(1,Number(arg("--protocol-attempts",process.env.DM_PROTOCOL_ATTEMPTS||"2")));
const structuredOutput=!process.argv.includes("--no-structured-output") && (process.env.DM_STRUCTURED_OUTPUT||"1")!=="0";
const filter=arg("--scenario","");
const guidance=process.argv.includes("--guidance");
const suite=arg("--suite","core");
const core=JSON.parse(fs.readFileSync(path.resolve("evals/dm-scenarios.json"),"utf8")) as Scenario[];
const holdout=JSON.parse(fs.readFileSync(path.resolve("evals/dm-holdout-scenarios.json"),"utf8")) as Scenario[];
const behavioral=JSON.parse(fs.readFileSync(path.resolve("evals/dm-behavioral-scenarios.json"),"utf8")) as Scenario[];
const protocolSuite=JSON.parse(fs.readFileSync(path.resolve("evals/dm-protocol-scenarios.json"),"utf8")) as Scenario[];
const all=suite==="holdout"?holdout:suite==="behavioral"?behavioral:suite==="protocol"?protocolSuite:suite==="all"?[...core,...holdout,...behavioral,...protocolSuite]:core;
const scenarios=filter?all.filter(s=>s.id===filter||s.category===filter):all;
const principles=JSON.parse(fs.readFileSync(path.resolve("dm-experience/principles/core.json"),"utf8")) as Principle[];
const pairs=JSON.parse(fs.readFileSync(path.resolve("dm-experience/preference-pairs/core.json"),"utf8")) as Pair[];
if(!scenarios.length) throw new Error(`No scenarios matched ${filter}`);
function guidanceFor(s:Scenario){
 if(!guidance)return "";
 const p=principles.filter(x=>x.tags.includes(s.category)||x.tags.includes("contract")).slice(0,4);
 const e=pairs.filter(x=>x.tags.includes(s.category)).slice(0,2);
 return `\n\nRELEVANT DM CRAFT GUIDANCE (principles, not scenario answers):\n${p.map(x=>`- ${x.principle}`).join("\n")}\n${e.length?`\nANALOGOUS PREFERENCE EXAMPLES:\n${e.map(x=>`- Situation: ${x.situation}\n  Avoid: ${x.bad}\n  Prefer: ${x.good}\n  Why: ${x.why}`).join("\n")}`:""}`;
}

const capabilityCatalog=`AVAILABLE ENGINE CAPABILITIES (use these exact names when mechanics/state changes are required):
- request_check: { ability: strength|dexterity|constitution|intelligence|wisdom|charisma, skill?: full lowercase skill name }
- request_saving_throw: { ability: strength|dexterity|constitution|intelligence|wisdom|charisma }
- request_attack: attack resolution; do not roll or calculate the result yourself
- request_state_action: persistent non-combat state change such as destroying/using/moving an owned object

DECISION TAXONOMY (use these exact values):
- narrate: routine/automatic fiction requiring no engine resolution
- request_check
- request_saving_throw
- request_attack
- request_state_action
- explain_rejection: engine/state/rules say an otherwise possible action is currently unavailable
- explain_impossible: action is impossible in the established fiction
- protect_canon: reject a proposed fact that conflicts with protected canon
- respect_knowledge: answer/roleplay without leaking knowledge the speaker does not possess
- narrate_failure: narrate an already-authoritative failed result
- narrate_success: narrate an already-authoritative successful result
- narrate_state: describe already-authoritative mechanical state without changing it`;
const decisionSchema={type:"object",additionalProperties:false,required:["decision","capability","ability","skill","reason","narration"],properties:{decision:{type:"string",enum:["narrate","request_check","request_saving_throw","request_attack","request_state_action","explain_rejection","explain_impossible","protect_canon","respect_knowledge","narrate_failure","narrate_success","narrate_state"]},capability:{anyOf:[{type:"string",enum:["request_check","request_saving_throw","request_attack","request_state_action"]},{type:"null"}]},ability:{anyOf:[{type:"string",enum:["strength","dexterity","constitution","intelligence","wisdom","charisma"]},{type:"null"}]},skill:{anyOf:[{type:"string"},{type:"null"}]},reason:{type:"string"},narration:{type:"string"}}};
const system=`You are the decision layer of an AI Dungeon Master connected to an authoritative deterministic RPG engine.
Never roll dice, invent a die result, change HP/resources/inventory, override an engine result, leak DM-only knowledge, or create protected canon. Do not demand a check when an action is routine, automatic, impossible, or already resolved. When mechanics or persistent state changes are needed, request an engine capability.

${capabilityCatalog}

Return ONLY JSON with exactly this shape: {"decision":"...","capability":null,"ability":null,"skill":null,"reason":"brief","narration":"brief"}.
For request_check/request_saving_throw/request_attack/request_state_action, capability MUST exactly equal decision. For non-mechanical decisions capability MUST be null. Use lowercase full 5e ability and skill names when applicable.`;

function extract(text:string):Decision|null{try{const v=JSON.parse(text);return v&&typeof v==="object"&&!Array.isArray(v)?v as Decision:null}catch{return null}}
function protocolScore(raws:string[],d:Decision|null):{pass:boolean;firstPass:boolean;recovered:boolean;issues:string[]}{
 const first=extract(raws[0]??"")!==null;
 const pass=d!==null;
 return {pass,firstPass:first,recovered:!first&&pass,issues:pass?[]:["invalid_json"]};
}
const norm=(v:unknown)=>String(v??"").trim().toLowerCase().replace(/[_-]+/g," ").replace(/\s+/g," ");
const semanticDecision=(v:string)=>{
 const n=norm(v);
 const map:Record<string,string>={
  "narrate success":"narrate_success","automatic success":"narrate","allow":"narrate","narrate":"narrate",
  "explain impossible":"explain_impossible","impossible":"explain_impossible",
  "explain rejection":"explain_rejection","reject":"explain_rejection","deny":"explain_rejection",
  "protect canon":"protect_canon","respect canon":"protect_canon",
  "respect knowledge":"respect_knowledge","withhold knowledge":"respect_knowledge",
  "request check":"request_check","check":"request_check",
  "request saving throw":"request_saving_throw","saving throw":"request_saving_throw","save":"request_saving_throw",
  "request attack":"request_attack","attack":"request_attack",
  "request state action":"request_state_action","state action":"request_state_action",
  "narrate failure":"narrate_failure","narrate state":"narrate_state"
 }; return map[n]||v;
};
function badRoll(raw:string){return /\b(i rolled|you rolled|roll is|rolled a|result is)\s*\d+|\b(d20|die)\s*(?:=|was|is)\s*\d+/i.test(raw)}
function forbiddenIssue(s:Scenario,d:Decision,raw:string){const issues:string[]=[];const forb=s.forbidden||[];if(forb.includes("invent_result")&&badRoll(raw))issues.push("invented_roll");if(forb.includes("request_check")&&semanticDecision(d.decision)==="request_check")issues.push("unnecessary_check");if(forb.includes("request_saving_throw")&&semanticDecision(d.decision)==="request_saving_throw")issues.push("unnecessary_save");if(forb.includes("request_attack")&&semanticDecision(d.decision)==="request_attack")issues.push("unnecessary_attack");return issues}
function semanticScore(s:Scenario,d:Decision|null,raw:string):Axis{const issues:string[]=[];if(!d)return {pass:false,issues:["invalid_json"]};
 const got=semanticDecision(d.decision); let expected=s.expected;
 // Semantic equivalences: success narration is fine for automatic narration; unavailable/impossible labels are equivalent for resource/action rejection.
 if(expected==="narrate"&&(got==="narrate"||got==="narrate_success")){} else if(expected==="explain_rejection"&&(got==="explain_rejection"||got==="explain_impossible")){} else if(got!==expected)issues.push(`decision_semantics:${got}!=${expected}`);
 if(s.ability&&norm(d.ability)!==s.ability){ // infer ability from capability only for semantic scoring
   const c=norm(d.capability); if(!c.includes(s.ability))issues.push(`ability_semantics:${d.ability}!=${s.ability}`);
 }
 if(s.skill&&norm(d.skill)!==s.skill){const c=norm(d.capability);if(!c.includes(s.skill))issues.push(`skill_semantics:${d.skill}!=${s.skill}`)}
 issues.push(...forbiddenIssue(s,d,raw)); return {pass:issues.length===0,issues};}
function contractScore(s:Scenario,d:Decision|null):Axis{const issues:string[]=[];if(!d)return {pass:false,issues:["invalid_json"]};
 if(d.decision!==s.expected)issues.push(`decision:${d.decision}!=${s.expected}`);
 if(s.expected.startsWith("request_")&&d.capability!==s.expected)issues.push(`capability:${d.capability}!=${s.expected}`);
 if(!s.expected.startsWith("request_")&&d.capability!=null)issues.push(`capability_should_be_null:${d.capability}`);
 if(s.ability&&norm(d.ability)!==s.ability)issues.push(`ability:${d.ability}!=${s.ability}`);
 if(s.skill&&norm(d.skill)!==s.skill)issues.push(`skill:${d.skill}!=${s.skill}`);
 // Exact field hygiene matters at the application boundary: irrelevant mechanical fields must be null.
 if((s.expected==="request_attack"||s.expected==="request_state_action"||!s.expected.startsWith("request_"))&&d.ability!=null)issues.push(`ability_should_be_null:${d.ability}`);
 if((s.expected==="request_attack"||s.expected==="request_state_action"||s.expected==="request_saving_throw"||!s.expected.startsWith("request_"))&&d.skill!=null)issues.push(`skill_should_be_null:${d.skill}`);
 return {pass:issues.length===0,issues};}
function safetyScore(s:Scenario,d:Decision|null,raw:string):Axis{const issues:string[]=[];if(!d)return {pass:false,issues:["invalid_json"]};
 const out=`${d.reason??""} ${d.narration??""}`.toLowerCase();
 for(const term of s.forbiddenTerms||[]){if(out.includes(term.toLowerCase()))issues.push(`forbidden_term:${term}`)}
 if(s.requiredAny?.length&&!s.requiredAny.some(x=>out.includes(x.toLowerCase())))issues.push(`missing_required_any:${s.requiredAny.join("|")}`);
 issues.push(...forbiddenIssue(s,d,raw));
 return {pass:issues.length===0,issues:[...new Set(issues)]};}
function experienceScore(s:Scenario,d:Decision|null,raw:string,safety:Axis):Axis{const issues=[...safety.issues];if(!d)return {pass:false,issues};const narration=String(d.narration??"").trim();if(!narration)issues.push("missing_narration");if(narration.length>500)issues.push("overlong_narration");if(/you (?:rolled|roll) \d+/i.test(narration))issues.push("narration_invents_roll");if(/\bwhat do you do\?\s*what do you do\?/i.test(narration))issues.push("repetitive_prompt");return {pass:issues.length===0,issues:[...new Set(issues)]};}

const results:any[]=[];
const runId=new Date().toISOString().replace(/[:.]/g,"-");
fs.mkdirSync("data/eval-results",{recursive:true});
const outfile=`data/eval-results/dm-eval-v5-${runId}.json`;
function writeCheckpoint(final=false){
 const completed=results.filter(x=>!x.transportError).length;
 const transportErrors=results.filter(x=>x.transportError).length;
 const protocolXs=results.filter(x=>!x.transportError);
 const parsed=protocolXs.filter(x=>x.protocol?.pass);
 const summaryOf=(axis:"semantic"|"contract"|"safety"|"experience")=>{const passed=parsed.filter(x=>x[axis]?.pass).length;return {passed,total:parsed.length,percent:parsed.length?+(passed/parsed.length*100).toFixed(1):0};};
 const firstProtocol=protocolXs.filter(x=>x.protocol?.firstPass).length;
 const effectiveProtocol=protocolXs.filter(x=>x.protocol?.pass).length;
 const recoveredProtocol=protocolXs.filter(x=>x.protocol?.recovered).length;
 const latencies=protocolXs.map(x=>x.latencyMs).filter((x:number)=>Number.isFinite(x));
 const avgLatencyMs=latencies.length?Math.round(latencies.reduce((a:number,x:number)=>a+x,0)/latencies.length):0;
 fs.writeFileSync(outfile,JSON.stringify({version:5,createdAt:new Date().toISOString(),final,model,temperature,runs,suite,guidance,requestTimeoutMs,maxAttempts,protocolAttempts,structuredOutput,capabilityCatalog,summary:{protocol:{firstPass:{passed:firstProtocol,total:protocolXs.length,percent:protocolXs.length?+(firstProtocol/protocolXs.length*100).toFixed(1):0},effective:{passed:effectiveProtocol,total:protocolXs.length,percent:protocolXs.length?+(effectiveProtocol/protocolXs.length*100).toFixed(1):0},recovered:recoveredProtocol},decision:summaryOf("semantic"),contract:summaryOf("contract"),safety:summaryOf("safety"),experience:summaryOf("experience"),avgLatencyMs,completed,transportErrors},results},null,2));
}
async function oneRequest(s:Scenario){
 let last:any=null;
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  const started=Date.now();
  try{
   const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),requestTimeoutMs);
   try{
    const body:any={model,temperature,messages:[{role:"system",content:system+guidanceFor(s)},{role:"user",content:`GAME STATE:\n${s.state}\n\nPLAYER:\n${s.player}\n\nChoose the next DM decision.`}]};
    if(structuredOutput)body.response_format={type:"json_schema",json_schema:{name:"dm_decision",strict:true,schema:decisionSchema}};
    const r=await fetch(`${base}/chat/completions`,{method:"POST",signal:controller.signal,headers:{"content-type":"application/json","authorization":`Bearer ${process.env.OLLAMA_API_KEY||"ollama"}`},body:JSON.stringify(body)});
    if(!r.ok)throw new Error(`Ollama HTTP ${r.status}: ${await r.text()}`);
    const j:any=await r.json(); return {raw:String(j.choices?.[0]?.message?.content??""),latencyMs:Date.now()-started,transportAttempt:attempt};
   } finally {clearTimeout(timer);}
  }catch(e:any){
   const msg=String(e?.cause?.code||e?.code||e?.name||e?.message||e); const timeout=/timeout|aborted|UND_ERR_HEADERS_TIMEOUT/i.test(msg+" "+String(e?.message||""));
   last={kind:timeout?"model_timeout":"transport_error",message:String(e?.message||e),code:e?.cause?.code||e?.code||null,latencyMs:Date.now()-started,attempt};
   if(attempt<maxAttempts){process.stdout.write("r");await new Promise(res=>setTimeout(res,1000));}
  }
 }
 return {error:last};
}
async function callModel(s:Scenario){
 const raws:string[]=[]; let totalLatency=0; let lastTransportAttempt=0;
 for(let pAttempt=1;pAttempt<=protocolAttempts;pAttempt++){
  const response:any=await oneRequest(s);
  if(response.error)return {error:response.error,raws,totalLatency};
  raws.push(response.raw); totalLatency+=response.latencyMs; lastTransportAttempt=response.transportAttempt;
  const d=extract(response.raw);
  if(d)return {raw:response.raw,raws,decision:d,latencyMs:totalLatency,protocolAttempt:pAttempt,transportAttempt:lastTransportAttempt};
  if(pAttempt<protocolAttempts)process.stdout.write("j");
 }
 return {raw:raws[raws.length-1]??"",raws,decision:null,latencyMs:totalLatency,protocolAttempt:protocolAttempts,transportAttempt:lastTransportAttempt};
}
for(const s of scenarios){for(let n=1;n<=runs;n++){
 const response:any=await callModel(s);
 if(response.error){const e=response.error;results.push({scenario:s.id,category:s.category,run:n,transportError:{kind:e.kind,message:e.message,code:e.code,attempts:e.attempt},protocol:{pass:false,firstPass:false,recovered:false,issues:["transport_error"]},latencyMs:e.latencyMs,rawAttempts:response.raws});process.stdout.write("T");writeCheckpoint(false);continue;}
 const raw=response.raw;const d=response.decision as Decision|null;const protocol=protocolScore(response.raws,d);
 if(!d){results.push({scenario:s.id,category:s.category,run:n,attempts:response.transportAttempt,protocolAttemptsUsed:response.protocolAttempt,protocol,latencyMs:response.latencyMs,decision:null,raw,rawAttempts:response.raws});process.stdout.write("J");writeCheckpoint(false);continue;}
 const semantic=semanticScore(s,d,raw);const contract=contractScore(s,d);const safety=safetyScore(s,d,raw);const experience=experienceScore(s,d,raw,safety);
 results.push({scenario:s.id,category:s.category,run:n,attempts:response.transportAttempt,protocolAttemptsUsed:response.protocolAttempt,protocol,semantic,contract,safety,experience,latencyMs:response.latencyMs,decision:d,raw,rawAttempts:response.raws});
 process.stdout.write(protocol.recovered?"p":semantic.pass?(contract.pass?(safety.pass?".":"s"):"c"):"F");writeCheckpoint(false);
}}
console.log("\nLegend: .=all behavioral axes pass, c=decision pass/contract fail, s=safety failure, F=decision failure, j=invalid JSON retry, p=protocol recovered, J=protocol failed after retries, r=transport retry, T=transport failure");
const nonTransport=results.filter(x=>!x.transportError);const scored=nonTransport.filter(x=>x.protocol?.pass);
function summary(axis:"semantic"|"contract"|"safety"|"experience"){const passed=scored.filter(x=>x[axis]?.pass).length;return {passed,total:scored.length,percent:scored.length?+(passed/scored.length*100).toFixed(1):0}}
const sem=summary("semantic"),con=summary("contract"),safe=summary("safety"),exp=summary("experience");
const pFirst=nonTransport.filter(x=>x.protocol?.firstPass).length,pEffective=scored.length,pRecovered=nonTransport.filter(x=>x.protocol?.recovered).length;
const avgLatency=nonTransport.length?Math.round(nonTransport.reduce((a,x)=>a+x.latencyMs,0)/nonTransport.length):0;const transportErrors=results.length-nonTransport.length;
console.log(`\nDM Lab V5 | model=${model} temp=${temperature} runs=${runs} suite=${suite} guidance=${guidance?"on":"off"} structured=${structuredOutput?"on":"off"}`);
console.log(`  Protocol first-pass      ${pFirst}/${nonTransport.length} (${nonTransport.length?(pFirst/nonTransport.length*100).toFixed(1):"0.0"}%)`);
console.log(`  Protocol effective       ${pEffective}/${nonTransport.length} (${nonTransport.length?(pEffective/nonTransport.length*100).toFixed(1):"0.0"}%) | recovered=${pRecovered}`);
console.log(`  DM decision              ${sem.passed}/${sem.total} (${sem.percent.toFixed(1)}%)`);console.log(`  Engine contract          ${con.passed}/${con.total} (${con.percent.toFixed(1)}%)`);console.log(`  Safety / authority       ${safe.passed}/${safe.total} (${safe.percent.toFixed(1)}%)`);console.log(`  Experience               ${exp.passed}/${exp.total} (${exp.percent.toFixed(1)}%)`);console.log(`  Mean response latency    ${avgLatency} ms`);console.log(`  Transport/timeouts       ${transportErrors}/${results.length} | timeout=${requestTimeoutMs}ms attempts=${maxAttempts}`);
const cats=[...new Set(scored.map(x=>x.category))];console.log("\nBy category (decision / contract / safety):");for(const c of cats){const xs=scored.filter(x=>x.category===c);const sp=xs.filter(x=>x.semantic.pass).length,cp=xs.filter(x=>x.contract.pass).length,sfp=xs.filter(x=>x.safety.pass).length;console.log(`  ${c.padEnd(12)} ${String(sp).padStart(2)}/${String(xs.length).padEnd(2)} decision | ${String(cp).padStart(2)}/${String(xs.length).padEnd(2)} contract | ${String(sfp).padStart(2)}/${String(xs.length).padEnd(2)} safety`)}
const failed=results.filter(x=>x.transportError||!x.protocol?.pass||(x.semantic&&(!x.semantic.pass||!x.contract.pass||!x.safety.pass||!x.experience.pass)));if(failed.length){console.log("\nDiagnostics:");for(const f of failed.slice(0,60)){const bits=[];if(f.transportError)bits.push(`TRANS[${f.transportError.kind}]`);if(!f.protocol?.pass)bits.push(`PROTO[${f.protocol?.issues?.join(", ")||"failed"}]`);if(f.semantic&&!f.semantic.pass)bits.push(`DEC[${f.semantic.issues.join(", ")}]`);if(f.contract&&!f.contract.pass)bits.push(`CON[${f.contract.issues.join(", ")}]`);if(f.safety&&!f.safety.pass)bits.push(`SAFE[${f.safety.issues.join(", ")}]`);if(f.experience&&!f.experience.pass)bits.push(`EXP[${f.experience.issues.join(", ")}]`);console.log(`- ${f.scenario} run ${f.run}: ${bits.join(" ")} | ${String(f.raw??"").replace(/\s+/g," ").slice(0,240)}`)}}
writeCheckpoint(true);console.log(`\nSaved/checkpointed: ${outfile}`);
process.exitCode=transportErrors===0&&pEffective===nonTransport.length&&sem.passed===sem.total&&con.passed===con.total&&safe.passed===safe.total?0:2;

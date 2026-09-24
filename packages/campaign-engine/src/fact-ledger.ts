export type { FactConfidence, FactProtection, FactRecord, FactSource, FactVisibility } from "../../domain/src/index.js";
import type { FactRecord } from "../../domain/src/index.js";
export interface FactQuery { viewer:string; terms:string[]; limit?:number }
const words=(s:string)=>new Set(s.toLowerCase().match(/[a-z0-9]+/g)??[]);
export class FactLedger {
  private facts=new Map<string,FactRecord>();
  add(f:FactRecord){ if(this.facts.has(f.id)) throw new Error(`Fact already exists: ${f.id}`); this.facts.set(f.id,structuredClone(f)); }
  get(id:string){ const f=this.facts.get(id); return f?structuredClone(f):undefined; }
  visibleTo(f:FactRecord,viewer:string){ return f.visibility.includes("player")||f.visibility.includes(`actor:${viewer}`)||viewer==="dm"; }
  relevant(q:FactQuery){ const qt=words(q.terms.join(" ")); return [...this.facts.values()].filter(f=>this.visibleTo(f,q.viewer)).map(f=>{const ft=words(`${f.subject} ${f.predicate} ${f.value} ${(f.tags??[]).join(" ")}`); let overlap=0; for(const w of qt)if(ft.has(w))overlap++; if(overlap===0)return {f,score:0}; let score=overlap; if(f.protection==="protected")score+=0.25; if(f.confidence==="explicit")score+=0.1; return {f,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.f.id.localeCompare(b.f.id)).slice(0,q.limit??8).map(x=>structuredClone(x.f)); }
}

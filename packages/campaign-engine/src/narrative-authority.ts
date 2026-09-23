import type {FactRecord} from './fact-ledger.js';
export type NarrativeClaimKind='presentation'|'inference'|'persistent_fact'|'knowledge_claim';
export type NarrativeDisposition='allow'|'proposal_required'|'deny'|'missing_context';
export interface NarrativeClaim {text:string;kind:NarrativeClaimKind;basisFactIds:string[]}
export interface NarrativeReview {disposition:NarrativeDisposition;reason:string}
/** Deterministic authority gate. It does not judge prose quality; it decides what authority a claim may rely on. */
export function reviewNarrativeClaim(claim:NarrativeClaim,facts:FactRecord[]):NarrativeReview{
 const byId=new Map(facts.map(f=>[f.id,f]));
 const basis=claim.basisFactIds.map(id=>byId.get(id)).filter((x):x is FactRecord=>!!x);
 if(claim.basisFactIds.length!==basis.length)return{disposition:'deny',reason:'unknown_fact_basis'};
 if(claim.kind==='presentation')return{disposition:'allow',reason:'ephemeral_presentation'};
 if(!basis.length)return{disposition:'missing_context',reason:'factual_claim_without_basis'};
 if(claim.kind==='persistent_fact')return basis.every(f=>f.protection==='flexible')?{disposition:'proposal_required',reason:'flexible_world_extension'}:{disposition:'deny',reason:'cannot_extend_nonflexible_fact'};
 if(claim.kind==='knowledge_claim'&&basis.some(f=>f.visibility.includes('dm_only')))return{disposition:'deny',reason:'knowledge_leak'};
 return{disposition:'allow',reason:'grounded_claim'};
}

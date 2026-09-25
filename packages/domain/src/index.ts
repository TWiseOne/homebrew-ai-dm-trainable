export type Id=string; export type ActorId=Id; export type ParticipantId=Id; export type ControllerId=Id;
export type GameDifficulty="easy"|"normal"|"hard"|"advanced";
export type DmAssistanceMode="standard"|"informative";
export interface DmPreferences { assistanceMode:DmAssistanceMode; narration:"succinct"|"balanced"; humour:"off"|"opportunistic"; failureStyle:"strict"|"failure-forward"; }
export interface Participant { id:ParticipantId; name:string; kind:"human"|"ai"; controllerId:ControllerId; actorIds:ActorId[]; }
export interface Controller { id:ControllerId; kind:"human"|"ai-dm"|"system"; participantId?:ParticipantId; }
export type ActorKind="player-character"|"npc"|"creature"|"companion"|"summon";
export interface ResourcePool { id:string; current:number; maximum:number; resetsOn?:"short-rest"|"long-rest"; }
export interface InventoryEntry { itemId:string; quantity:number; equipped?:boolean; }
export interface ActiveEffect { id:string; sourceId?:string; label:string; tags:string[]; expires?:{kind:"turn-end"|"round-end"|"duration"; value?:number}; data?:Record<string,unknown>; }
export interface Actor<T=unknown> { id:ActorId; name:string; kind:ActorKind; rulesetId:string; controllerId?:ControllerId; rulesData:T; inventory:InventoryEntry[]; resources:ResourcePool[]; effects:ActiveEffect[]; }
export interface KnowledgeFact { id:string; text:string; protected?:boolean; source:"campaign"|"runtime"; }
export type FactSource="authored_canon"|"engine_result"|"player_action"|"dm_improvisation";
export type FactVisibility="player"|"dm_only"|`actor:${string}`;
export type FactProtection="protected"|"established"|"flexible";
export type FactConfidence="explicit"|"inferred";
export interface FactRecord { id:string; subject:string; predicate:string; value:string; source:FactSource; visibility:FactVisibility[]; protection:FactProtection; confidence:FactConfidence; provenance:string; tags?:string[] }
export interface PendingRoll { purpose:"check"|"attack"|"initiative"; optionId:string; actorId:string; prompt:string; playerText?:string; earlierRolls?:TraceRoll[] }
export interface TraceRoll { owner:"human"|"engine"; method:"manual_raw_die"|"digital_button"|"engine"|"none"; natural:number; modifier:number; total:number; dc?:number; success?:boolean; purpose:string }
export type KnowledgeLevel="knows"|"suspects"|"unknown";
export interface KnowledgeGrant { factId:string; subjectType:"participant"|"actor"|"dm"; subjectId?:string; level:KnowledgeLevel; learnedAt:string; }
export interface Scene { id:string; name:string; description:string; exits:string[]; }
export interface CampaignDefinition { id:string; title:string; rulesetId:string; rulesVersion:string; startSceneId:string; scenes:Scene[]; canon:KnowledgeFact[]; }
export interface InitiativeEntry { actorId:ActorId; die:number; modifier:number; total:number; }
export interface EncounterState { id:string; active:boolean; round:number; turnIndex:number; initiative:InitiativeEntry[]; actorIds:ActorId[]; }
export type GameEventType="GAME_STARTED"|"CHECK_REQUESTED"|"CHECK_RESOLVED"|"SAVE_REQUESTED"|"SAVE_RESOLVED"|"ENCOUNTER_STARTED"|"TURN_STARTED"|"TURN_ENDED"|"ATTACK_RESOLVED"|"DAMAGE_APPLIED"|"ACTOR_DEFEATED"|"ENCOUNTER_ENDED"|"SCENE_ENTERED"|"FACT_REVEALED"|"ITEM_GAINED"|"ITEM_LOST"|"REST_COMPLETED";
export interface GameEvent<T=unknown>{id:string;type:GameEventType;at:string;payload:T}
export interface GameState { schemaVersion:1; id:string; campaignId:string; rulesetId:string; rulesVersion:string; currentSceneId:string; difficulty:GameDifficulty; dmPreferences?:DmPreferences; participants:Participant[]; controllers:Controller[]; actors:Actor[]; facts:KnowledgeFact[]; ledger:FactRecord[]; knowledge:KnowledgeGrant[]; flags:Record<string,boolean|number|string>; encounter?:EncounterState; events:GameEvent[]; pendingRoll?:PendingRoll }
export function actorById(state:GameState,id:ActorId):Actor { const a=state.actors.find(x=>x.id===id); if(!a) throw new Error(`Unknown actor '${id}'`); return a; }

import type { CampaignDefinition, FactRecord } from "../../domain/src/index.js";
import { create5eActor, type Dnd5eWeapon } from "../../rules-dnd5e/src/index.js";

const sword: Dnd5eWeapon = { id: "longsword", name: "Longsword", ability: "str", damageDice: { count: 1, sides: 8 }, damageType: "slashing", proficient: true };
const scimitar: Dnd5eWeapon = { id: "scimitar", name: "Scimitar", ability: "dex", damageDice: { count: 1, sides: 6 }, damageType: "slashing", proficient: true };

export const campaign: CampaignDefinition = {
  id: "storehouse-lantern",
  title: "The Storehouse Lantern",
  rulesetId: "dnd-5e-2024",
  rulesVersion: "srd-5.2.1",
  startSceneId: "yard",
  scenes: [
    { id: "yard", name: "Toll Yard", description: "A packed-earth yard behind a toll shed. Warden Colm waits by a cold brazier. The storehouse door is to the east.", exits: ["door"] },
    { id: "door", name: "Barred Door", description: "A low storehouse door. An oak bar holds it shut.", exits: ["yard", "storehouse"] },
    { id: "storehouse", name: "Storehouse", description: "Crates crowd a dim room. A lantern hangs from a hook.", exits: ["yard"] },
  ],
  canon: [],
};

export const seedFacts: FactRecord[] = [
  { id: "f-colm", subject: "Colm", predicate: "wants", value: "the storehouse lantern brought back to the yard", source: "authored_canon", visibility: ["player"], protection: "established", confidence: "explicit", provenance: "campaign:storehouse-lantern", tags: ["yard"] },
  { id: "f-door", subject: "Storehouse door", predicate: "is", value: "barred with an oak beam", source: "authored_canon", visibility: ["player"], protection: "established", confidence: "explicit", provenance: "campaign:storehouse-lantern", tags: ["door", "yard"] },
  { id: "f-lantern", subject: "Lantern", predicate: "hangs", value: "from a hook inside the storehouse", source: "authored_canon", visibility: ["player"], protection: "established", confidence: "explicit", provenance: "campaign:storehouse-lantern", tags: ["storehouse", "yard"] },
  { id: "f-goblin", subject: "Storehouse", predicate: "hides", value: "one hostile goblin", source: "authored_canon", visibility: ["dm_only"], protection: "protected", confidence: "explicit", provenance: "campaign:storehouse-lantern", tags: ["storehouse"] },
];

export function createParty() {
  const aria = create5eActor({ id: "aria", name: "Aria", controllerId: "human", level: 1, abilities: { str: 16, dex: 14, con: 14 }, armorClass: 16, hp: 12, weapons: [sword] });
  const colm = create5eActor({ id: "colm", name: "Warden Colm", kind: "npc", controllerId: "dm", abilities: { wis: 12, cha: 12 }, armorClass: 12, hp: 9 });
  const goblin = create5eActor({ id: "goblin", name: "Goblin", kind: "creature", controllerId: "dm", abilities: { dex: 14, str: 8 }, armorClass: 13, hp: 7, weapons: [scimitar] });
  return { aria, colm, goblin };
}

export const DOOR_DC = 12;
export const DOOR_FAIL_DAMAGE = 2;

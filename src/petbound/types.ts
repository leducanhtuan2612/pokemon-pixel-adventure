export type Element = "Nature" | "Flame" | "Tide" | "Storm" | "Stone" | "Gale" | "Frost" | "Light" | "Shadow";
export type Rarity = "common" | "uncommon" | "rare" | "mythic";
export type PetRole = "striker" | "guardian" | "support";
export type SkillKind = "attack" | "heal" | "shield" | "boost";

export interface PetStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface PetSpecies {
  id: string;
  name: string;
  title: string;
  element: Element;
  rarity: Rarity;
  role: PetRole;
  base: PetStats;
  skills: [string, string, string, string];
  silhouette: "round" | "quadruped" | "winged" | "long" | "crystal" | "spirit";
  palette: [string, string, string];
  lore: string;
}

export interface PetInstance {
  uid: string;
  speciesId: string;
  level: number;
  xp: number;
  hp: number;
  bond: number;
  skills: string[];
  shiny: boolean;
}

export interface SkillDef {
  id: string;
  name: string;
  element: Element;
  kind: SkillKind;
  power: number;
  accuracy: number;
  cooldown: number;
  description: string;
}

export interface WorldSave {
  version: 1;
  playerName: string;
  gold: number;
  crystals: number;
  essence: number;
  gachaPity: number;
  pets: PetInstance[];
  party: string[];
  stage: number;
  highestStage: number;
  claimedStages: number[];
  unlockedZones: string[];
  questStep: number;
  questRewards: string[];
  inventory: { herb: number; tonic: number; trainingManual: number };
  settings: { music: boolean; effects: boolean };
  lastSeen: number;
}

export interface BattlePet {
  instance: PetInstance;
  currentHp: number;
  shield: number;
  cooldowns: Record<string, number>;
  boost: number;
}

export interface BattleState {
  player: BattlePet;
  foe: BattlePet;
  playerTeam: BattlePet[];
  foeTeam: BattlePet[];
  playerIndex: number;
  foeIndex: number;
  turn: number;
  log: string[];
  over: boolean;
  won: boolean;
  source: "wild" | "stage" | "boss";
  stage?: number;
}

export interface BattleResult {
  won: boolean;
  xp: number;
  gold: number;
  crystals: number;
  stage?: number;
}

import { makeCreature, type Creature } from "../data/pokemon";
export type SaveData={party:Creature[];balls:number;potions:number;defeated:string[];badge:boolean;steps:number};
const KEY="pixel-adventure-save-v1";
export function loadSave():SaveData{
 try{const raw=localStorage.getItem(KEY);if(raw){const d=JSON.parse(raw) as SaveData;if(Array.isArray(d.party)&&d.party.length)return d;}}
 catch{/* recover with a fresh game */}
 return{party:[makeCreature("bulbasaur",5)],balls:5,potions:3,defeated:[],badge:false,steps:0};
}
export function saveGame(data:SaveData){try{localStorage.setItem(KEY,JSON.stringify(data));}catch{/* storage can be disabled */}}

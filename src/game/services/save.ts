import { makeCreature, type Creature } from "../data/pokemon";
export type SaveData={party:Creature[];box:Creature[];balls:number;potions:number;defeated:string[];badge:boolean;steps:number;position:{x:number;y:number}};
const KEY="pixel-adventure-save-v1";
export function loadSave():SaveData{
 try{
  const raw=localStorage.getItem(KEY);
  if(raw){
   const d=JSON.parse(raw) as Partial<SaveData>;
   if(Array.isArray(d.party)&&d.party.length){
    return {...d,box:Array.isArray(d.box)?d.box:[],position:d.position??{x:8,y:12},balls:d.balls??5,potions:d.potions??3,defeated:d.defeated??[],badge:d.badge??false,steps:d.steps??0} as SaveData;
   }
  }
 }catch{/* recover with a fresh game */}
 return{party:[makeCreature("bulbasaur",5)],box:[],balls:10,potions:5,defeated:[],badge:false,steps:0,position:{x:8,y:12}};
}
export function saveGame(data:SaveData){try{localStorage.setItem(KEY,JSON.stringify(data));}catch{/* storage can be disabled */}}

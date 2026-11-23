export type Species = { id: string; name: string; type: string; maxHp: number; attack: number; color: number; catchRate: number; xp: number };
export const SPECIES: Species[] = [
 {id:"bulbasaur",name:"Bulbasaur",type:"Grass",maxHp:34,attack:8,color:0x62b879,catchRate:0.48,xp:18},
 {id:"charmander",name:"Charmander",type:"Fire",maxHp:30,attack:10,color:0xf28b54,catchRate:0.5,xp:20},
 {id:"squirtle",name:"Squirtle",type:"Water",maxHp:36,attack:7,color:0x68aee8,catchRate:0.52,xp:18},
 {id:"pikachu",name:"Pikachu",type:"Electric",maxHp:28,attack:12,color:0xf3d34a,catchRate:0.32,xp:28},
 {id:"pidgey",name:"Pidgey",type:"Flying",maxHp:22,attack:6,color:0xc7ad8b,catchRate:0.72,xp:12},
 {id:"caterpie",name:"Caterpie",type:"Bug",maxHp:24,attack:5,color:0x86c65c,catchRate:0.78,xp:10},
 {id:"oddish",name:"Oddish",type:"Grass",maxHp:29,attack:7,color:0x6386d8,catchRate:0.62,xp:15},
 {id:"vulpix",name:"Vulpix",type:"Fire",maxHp:27,attack:9,color:0xd98a55,catchRate:0.42,xp:22},
 {id:"psyduck",name:"Psyduck",type:"Water",maxHp:33,attack:8,color:0xe9cf64,catchRate:0.48,xp:20},
 {id:"snorlax",name:"Snorlax",type:"Normal",maxHp:65,attack:13,color:0x6484a9,catchRate:0.08,xp:70}
];
export function getSpecies(id:string):Species{return SPECIES.find(p=>p.id===id)??SPECIES[0];}
export type Creature = {speciesId:string;level:number;hp:number;xp:number};
export function makeCreature(speciesId:string,level=3):Creature{const s=getSpecies(speciesId);return{speciesId,level,hp:s.maxHp+level*2,xp:0};}

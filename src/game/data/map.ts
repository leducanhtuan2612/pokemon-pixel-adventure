export const MAP = { width:42,height:30,tile:32 };
export type Point={x:number;y:number};
export const SOLID:Point[]=[
 ...Array.from({length:42},(_,x)=>({x,y:0})),...Array.from({length:42},(_,x)=>({x,y:29})),
 ...Array.from({length:30},(_,y)=>({x:0,y})),...Array.from({length:30},(_,y)=>({x:41,y})),
 // lake shore and water
 ...Array.from({length:7},(_,i)=>({x:25+i,y:8})),...Array.from({length:7},(_,i)=>({x:25+i,y:14})),
 ...Array.from({length:5},(_,i)=>({x:25,y:9+i})),...Array.from({length:5},(_,i)=>({x:31,y:9+i})),
 // homes, shop, clinic, fencing
 ...Array.from({length:7},(_,i)=>({x:6+i,y:5})),...Array.from({length:7},(_,i)=>({x:6+i,y:9})),
 ...Array.from({length:5},(_,i)=>({x:6,y:5+i})),...Array.from({length:5},(_,i)=>({x:12,y:5+i})),
 ...Array.from({length:6},(_,i)=>({x:15+i,y:5})),...Array.from({length:6},(_,i)=>({x:15+i,y:9})),
 ...Array.from({length:5},(_,i)=>({x:15,y:5+i})),...Array.from({length:5},(_,i)=>({x:20,y:5+i})),
 ...Array.from({length:8},(_,i)=>({x:4+i,y:16})),...Array.from({length:8},(_,i)=>({x:4+i,y:20})),
 ...Array.from({length:5},(_,i)=>({x:4,y:16+i})),...Array.from({length:5},(_,i)=>({x:11,y:16+i})),
 // rocks and trees along the route (leave walkable lanes)
 {x:3,y:3},{x:4,y:3},{x:3,y:4},{x:22,y:4},{x:23,y:4},{x:36,y:5},{x:37,y:5},{x:36,y:6},
 {x:22,y:12},{x:23,y:12},{x:22,y:13},{x:34,y:17},{x:35,y:17},{x:34,y:18},
 {x:14,y:24},{x:15,y:24},{x:16,y:24},{x:28,y:23},{x:29,y:23},{x:30,y:23}
];
export const GRASS:Point[]=[
 ...Array.from({length:8},(_,i)=>({x:14+i,y:12})),...Array.from({length:8},(_,i)=>({x:14+i,y:13})),
 ...Array.from({length:8},(_,i)=>({x:3+i,y:23})),...Array.from({length:8},(_,i)=>({x:3+i,y:24})),
 ...Array.from({length:8},(_,i)=>({x:32+i,y:19})),...Array.from({length:8},(_,i)=>({x:32+i,y:20})),
 ...Array.from({length:6},(_,i)=>({x:18+i,y:25})),...Array.from({length:6},(_,i)=>({x:18+i,y:26})),
];
export const NPCS=[
 {id:"healer",name:"Nurse Maple",x:9,y:11,kind:"healer",line:"Welcome to Greenleaf Clinic! I can restore your team."},
 {id:"guide",name:"Ranger Oak",x:17,y:7,kind:"guide",line:"Tall grass hides wild Pokémon. Walk through it to encounter them!"},
 {id:"trainer1",name:"Bug Catcher Finn",x:18,y:15,kind:"trainer",line:"My tiny team is ready!"},
 {id:"trainer2",name:"Lass Willow",x:29,y:17,kind:"trainer",line:"Let's see how strong your partner is!"},
 {id:"trainer3",name:"Hiker Moss",x:9,y:22,kind:"trainer",line:"A true trainer never gives up."},
 {id:"boss",name:"Forest Guardian",x:37,y:10,kind:"boss",line:"You reached the Forest Trial. Show me your bond with Pokémon!"}
] as const;

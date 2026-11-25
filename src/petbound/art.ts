import Phaser from "phaser";
import { getPet, ELEMENT_COLORS } from "./catalog";
import type { Element } from "./types";

const darken = (hex: string, factor = 0.58) => {
  const n = Number.parseInt(hex.slice(1),16);
  return "#" + [n>>16,(n>>8)&255,n&255].map((v: number)=>Math.max(0,Math.floor(v*factor)).toString(16).padStart(2,"0")).join("");
};
const lighten = (hex: string, amount = 0.38) => {
  const n = Number.parseInt(hex.slice(1),16);
  return "#" + [n>>16,(n>>8)&255,n&255].map(v=>Math.min(255,Math.floor(v+(255-v)*amount)).toString(16).padStart(2,"0")).join("");
};
function poly(c:CanvasRenderingContext2D,pts:number[][],fill:string,stroke=darken(fill),w=1){
  c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.closePath();c.fillStyle=fill;c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}
}
function oval(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,fill:string,stroke=darken(fill),w=1){
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}
}
function pixel(c:CanvasRenderingContext2D,x:number,y:number,color:string,w=1,h=1){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
function crest(c:CanvasRenderingContext2D,element:Element,light:string){
  if(element==="Flame"){
    poly(c,[[12,10],[10,6],[13,7],[16,1],[18,8],[21,5],[20,11]],light,"#9c4937",1);
    pixel(c,15,6,"#fff3ba",2,2);
  } else if(element==="Tide"){
    poly(c,[[12,8],[14,3],[16,1],[19,6],[22,8],[17,11]],"#d9faff","#477b9a",1);
    pixel(c,16,4,"#ffffff",2,2);
  } else if(element==="Nature"){
    poly(c,[[12,9],[8,2],[14,5],[17,0],[20,5],[23,2],[21,10]],light,"#46774c",1);
    pixel(c,15,4,"#efffba");
  } else if(element==="Storm"){
    poly(c,[[13,9],[17,2],[16,7],[22,4],[18,12]],"#fff5a6","#927331",1);
  } else if(element==="Stone"){
    poly(c,[[11,10],[12,3],[16,0],[20,4],[22,10]],light,"#62584c",1);
    pixel(c,15,4,"#ffffff",2,2);
  } else if(element==="Gale"){
    poly(c,[[10,11],[4,3],[13,6],[17,1],[20,6],[27,3],[22,12]],light,"#508a81",1);
  } else if(element==="Frost"){
    poly(c,[[13,10],[11,5],[15,1],[17,4],[20,0],[22,6],[19,11]],"#f4ffff","#6bacc2",1);
  } else if(element==="Light"){
    oval(c,16,5,5,5,"#fff3b0","#c59a47",1);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;poly(c,[[16+Math.cos(a)*6,5+Math.sin(a)*6],[16+Math.cos(a)*9,5+Math.sin(a)*9],[16+Math.cos(a+0.22)*6,5+Math.sin(a+0.22)*6]],"#fff1ad","",0);}
  } else {
    poly(c,[[11,10],[10,4],[14,7],[16,1],[18,7],[23,3],[21,11]],"#aa9ad8","#4f416f",1);
    pixel(c,14,6,"#f4eaff",2,1);
  }
}
export function drawCompanion(speciesId:string,pose:"idle"|"battle"="idle"){
  const pet=getPet(speciesId), c=document.createElement("canvas");c.width=64;c.height=64;
  const g=c.getContext("2d")!;g.imageSmoothingEnabled=false;g.scale(2,2);
  const [main,accent,shadow]=pet.palette, light=lighten(main,.36), dark=darken(shadow,.78), ink="#24323a";
  oval(g,16,28,10,2.1,shadow,"",0);
  // Tail and back ornaments are drawn before the body for a layered silhouette.
  if(pet.silhouette==="quadruped"||pet.silhouette==="long"){
    poly(g,[[8,21],[3,18],[1,13],[5,15],[11,18]],accent,ink,1);
    pixel(g,2,14,light,2,2);
  }
  if(pet.silhouette==="winged"){
    poly(g,[[10,19],[2,11],[1,5],[8,9],[14,15]],accent,ink,1);
    poly(g,[[20,19],[27,11],[30,5],[23,9],[17,15]],main,ink,1);
    poly(g,[[5,11],[2,6],[8,10]],light,"",0);
    poly(g,[[25,11],[29,6],[23,10]],light,"",0);
  }
  if(pet.silhouette==="crystal"){
    poly(g,[[8,18],[3,11],[7,6],[12,10]],accent,ink,1);
    poly(g,[[23,18],[28,11],[24,6],[20,10]],light,ink,1);
  }
  // Legs differ by body silhouette.
  if(pet.silhouette==="quadruped"||pet.silhouette==="long"){
    for(const x of [9,20]){oval(g,x,26,2.2,3,dark,ink,.8);pixel(g,x-1,26,light,2,1);}
  } else if(pet.silhouette==="winged"){
    oval(g,12,26,2.1,2.8,dark,ink,.7);oval(g,20,26,2.1,2.8,dark,ink,.7);
  } else {
    pixel(g,11,26,dark,3,3);pixel(g,19,26,dark,3,3);
  }
  // Distinct silhouettes.
  if(pet.silhouette==="crystal"){
    poly(g,[[7,22],[5,15],[10,10],[16,8],[23,12],[27,19],[24,26],[9,27]],main,ink,1.4);
    poly(g,[[8,16],[13,10],[17,12],[12,19]],light,ink,.6);
    poly(g,[[17,12],[23,15],[24,23],[17,25]],accent,ink,.7);
    pixel(g,15,15,"#ffffff",2,2);
  } else if(pet.silhouette==="spirit"){
    poly(g,[[7,25],[5,19],[7,12],[12,9],[18,9],[24,14],[25,21],[22,25],[18,22],[15,26],[11,22]],main,ink,1.3);
    poly(g,[[9,23],[12,27],[15,23],[18,27],[22,23],[22,28],[17,30],[13,28]],accent,ink,.7);
    oval(g,16,10,5,4,light,ink,.8);
  } else if(pet.silhouette==="winged"){
    oval(g,16,21,7.8,7.4,main,ink,1.2);
    poly(g,[[11,21],[4,16],[7,10],[13,15]],light,ink,.8);
    poly(g,[[21,21],[28,16],[25,10],[19,15]],accent,ink,.8);
    pixel(g,12,17,light,2,2);
  } else if(pet.silhouette==="long"){
    oval(g,16,23,11,4.8,main,ink,1.2);
    oval(g,25,18,5,4.8,light,ink,1.1);
    poly(g,[[23,14],[22,9],[27,13]],accent,ink,.8);
    pixel(g,8,21,light,3,1);
  } else if(pet.silhouette==="quadruped"){
    oval(g,15,22,10,6.3,main,ink,1.2);
    oval(g,23,18,5.5,5.5,light,ink,1.1);
    if(pet.element==="Flame"||pet.element==="Shadow")poly(g,[[20,14],[18,8],[23,12],[27,8],[27,15]],accent,ink,.8);
    else {poly(g,[[20,14],[19,9],[23,13]],accent,ink,.8);poly(g,[[27,16],[28,11],[30,16]],main,ink,.8);}
    pixel(g,10,18,light,4,2);
  } else {
    oval(g,16,21,9.4,8,main,ink,1.2);
    oval(g,20,14,6.2,5.8,light,ink,1);
    poly(g,[[16,12],[14,6],[19,10]],accent,ink,.8);
  }
  crest(g,pet.element,light);
  // Elemental mark and eye highlights, kept crisp at native pixel scale.
  if(pet.element==="Nature"){pixel(g,12,20,"#d8f2a6",2,2);pixel(g,16,23,"#a9d977",2,2);}
  if(pet.element==="Flame"){pixel(g,12,21,"#ffd18a",3,1);pixel(g,19,24,"#ffca76",2,1);}
  if(pet.element==="Tide"){oval(g,11,22,2,2,"#d9faff","#4b8fb0",.5);pixel(g,20,25,"#b8f7fa",2,1);}
  if(pet.element==="Storm"){poly(g,[[11,19],[14,16],[13,20],[16,19],[12,23]],"#fff3a1","#a58b42",.5);}
  if(pet.element==="Frost"){pixel(g,11,19,"#ffffff",2,2);pixel(g,21,22,"#e7fcff",2,2);}
  if(pet.element==="Light"){pixel(g,12,21,"#fff8ca",3,2);}
  if(pet.element==="Shadow"){pixel(g,12,20,"#d5c5ff",2,1);}
  const headX=pet.silhouette==="long"?25:pet.silhouette==="quadruped"?23:16;
  pixel(g,headX-2,17,ink,1,2);pixel(g,headX+1,17,ink,1,2);
  pixel(g,headX-1,17,"#ffffff",1,1);pixel(g,headX+2,17,"#ffffff",1,1);
  if(pose==="battle"){
    oval(g,16,30,12,1.4,"rgba(255,255,255,.10)","",0);
  }
  // Rare glints and a bonded crystal on the chest.
  poly(g,[[16,24],[18,26],[16,28],[14,26]],pet.rarity==="mythic"?"#fff3a8":light,"#65727a",.5);
  if(pet.rarity==="mythic"){pixel(g,5,18,"#fff5bc",2,2);pixel(g,27,24,"#fff5bc");}
  return c;
}
export function companionDataUrl(speciesId:string,pose:"idle"|"battle"="idle"){
  return drawCompanion(speciesId,pose).toDataURL("image/png");
}
export function ensureCompanionTexture(scene:Phaser.Scene,speciesId:string){
  const key="pb-pet-"+speciesId;
  if(!scene.textures.exists(key)){
    const texture=scene.textures.addCanvas(key,drawCompanion(speciesId));
    texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  return key;
}
export const petElementColor=(id:string)=>ELEMENT_COLORS[getPet(id).element];

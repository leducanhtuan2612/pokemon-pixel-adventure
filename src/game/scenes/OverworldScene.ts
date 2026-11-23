import Phaser from "phaser";
import { MAP, SOLID, GRASS, NPCS } from "../data/map";
import { getSpecies, makeCreature, SPECIES, type Creature } from "../data/pokemon";
import { loadSave, saveGame, type SaveData } from "../services/save";

type Npc = typeof NPCS[number];
type Battle = { foe: Creature; trainer?: Npc; boss: boolean; wild: boolean };

const TILE = MAP.tile;
const keyOf = (x:number,y:number)=>`${x},${y}`;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export class OverworldScene extends Phaser.Scene {
  private px=8; private py=12; private face={x:0,y:1}; private moving=false;
  private cursors!:Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!:Record<string,Phaser.Input.Keyboard.Key>;
  private save!:SaveData; private solid=new Set(SOLID.map(p=>keyOf(p.x,p.y)));
  private grass=new Set(GRASS.map(p=>keyOf(p.x,p.y)));
  private npcTiles=new Set(NPCS.map(n=>keyOf(n.x,n.y)));
  private player!:Phaser.GameObjects.Container; private mapLayer!:Phaser.GameObjects.Container;
  private battle:Battle|null=null; private battleLayer:Phaser.GameObjects.Container|null=null;
  private toastText:Phaser.GameObjects.Text|null=null; private toastTimer?:Phaser.Time.TimerEvent;
  private battleAction=0; private battleButtons:Phaser.GameObjects.Text[]=[];

  constructor(){super("OverworldScene");}
  create(){
    this.save=loadSave(); this.px=clamp(this.save.position?.x??8,1,40); this.py=clamp(this.save.position?.y??12,1,28);
    this.drawWorld(); this.drawPlayer();
    this.cursors=this.input.keyboard!.createCursorKeys();
    this.keys=this.input.keyboard!.addKeys("W,A,S,D,ENTER,SPACE,ESC,ONE,TWO,THREE,FOUR") as Record<string,Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-ENTER",()=>this.interact());
    this.input.keyboard!.on("keydown-SPACE",()=>this.interact());
    this.input.keyboard!.on("keydown-ESC",()=>this.battle?this.battleMenu():this.showToast("Đi đến Nurse Maple để hồi phục Pokémon."));
    this.cameras.main.setBounds(0,0,MAP.width*TILE,MAP.height*TILE);
    this.cameras.main.startFollow(this.player,true,.12,.12); this.cameras.main.setZoom(1.05);
    this.showToast("Greenleaf Village — khám phá, bắt Pokémon và vượt Forest Trial!");
    window.addEventListener("game:start",this.onStart);
    this.events.once("shutdown",()=>window.removeEventListener("game:start",this.onStart));
  }
  private onStart=()=>this.showToast("Nhiệm vụ: đánh bại 3 Trainer rồi thách đấu Forest Guardian.");

  private drawWorld(){
    this.mapLayer=this.add.container(0,0);
    const g=this.add.graphics();
    // Rich pixel-ground base: tiny color flecks create a hand-painted tile texture.
    for(let y=0;y<MAP.height;y++)for(let x=0;x<MAP.width;x++){
      const px=x*TILE,py=y*TILE,seed=(x*37+y*71+x*y*13)%17;
      const base=seed<3?0x4b9657:seed<7?0x56a65f:seed<12?0x60ad66:0x68b16b;
      g.fillStyle(base,1).fillRect(px,py,TILE,TILE);
      g.fillStyle(seed%3===0?0x85c878:0x347b49,0.38);
      g.fillRect(px+4+(seed%7)*3,py+5+(seed%5)*4,3,2);
      g.fillRect(px+18+(seed%4)*2,py+22-(seed%6)*2,2,4);
      g.fillStyle(0x2c6940,.18).fillRect(px,py+TILE-2,TILE,2);
    }
    // Layered dirt routes with pixel edging and worn footprints.
    const paths=[[7,10,5,14],[10,11,14,3],[17,13,3,13],[18,24,22,3],[36,10,5,17]];
    for(const [x,y,w,h] of paths){
      g.fillStyle(0x8e744b,1).fillRect(x*TILE-2,y*TILE-2,w*TILE+4,h*TILE+4);
      g.fillStyle(0xd4bd83,1).fillRect(x*TILE,y*TILE,w*TILE,h*TILE);
      g.fillStyle(0xe4d39d,.6);
      for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
        if((xx*3+yy*5)%6===0)g.fillRect(xx*TILE+5+(yy%3)*5,yy*TILE+7+(xx%4)*4,7,3);
      }
      g.fillStyle(0x9b8053,.55);
      for(let xx=x;xx<x+w;xx+=2)g.fillRect(xx*TILE+2,(y+h-1)*TILE+26,13,3);
    }
    // Tall grass clumps, each tuft is drawn as crisp stepped blades.
    for(const p of GRASS){
      const x=p.x*TILE,y=p.y*TILE;
      g.fillStyle(0x367c43,1).fillRect(x+2,y+5,28,25);
      g.fillStyle(0x4a9c50,1);
      g.fillRect(x+4,y+11,6,15);g.fillRect(x+12,y+5,5,21);g.fillRect(x+20,y+9,6,17);
      g.fillStyle(0x85d66c,1);g.fillRect(x+5,y+8,3,8);g.fillRect(x+13,y+3,3,8);g.fillRect(x+22,y+6,3,8);
      g.fillStyle(0x285d38,1);g.fillRect(x+3,y+26,25,3);
    }
    // Lake with pixel shoreline, shallow-water highlights and ripples.
    g.fillStyle(0x6b9c58,1).fillRect(24*TILE,7*TILE,9*TILE,9*TILE);
    g.fillStyle(0xd5c17c,1).fillRect(25*TILE,8*TILE,7*TILE,7*TILE);
    g.fillStyle(0x398cb9,1).fillRect(25*TILE+4,8*TILE+4,7*TILE-8,7*TILE-8);
    g.fillStyle(0x55b3d0,1);
    for(let i=0;i<8;i++){const xx=26*TILE+(i*23)%150,yy=9*TILE+(i*31)%150;g.fillRect(xx,yy,18,3);g.fillRect(xx+6,yy+4,8,2);}
    g.fillStyle(0x9de0df,1);g.fillRect(25*TILE+12,8*TILE+12,22,3);g.fillRect(29*TILE,12*TILE,32,3);
    g.fillStyle(0x286b9b,1).fillRect(25*TILE+4,14*TILE-8,7*TILE-8,7);
    // Rocky cliff bands at the northern and eastern boundary, with stratified pixels.
    g.fillStyle(0x624b67,1).fillRect(1*TILE,2*TILE,2*TILE,7*TILE);
    g.fillStyle(0x9b718e,1).fillRect(2*TILE,2*TILE,10,7*TILE);
    g.fillStyle(0x755778,1).fillRect(3*TILE,2*TILE,8,7*TILE);
    for(let i=0;i<14;i++){g.fillStyle(i%2?0xc08ba7:0x4d405e,1);g.fillRect(1*TILE+(i%3)*9,2*TILE+i*15,6,10);}
    g.fillStyle(0x66506b,1).fillRect(32*TILE,2*TILE,2*TILE,17*TILE);
    g.fillStyle(0x9a7793,1).fillRect(32*TILE,2*TILE,9,17*TILE);
    g.fillStyle(0x745a7e,1).fillRect(33*TILE,2*TILE,9,17*TILE);
    // Buildings: warm timber foundations, roof tiles, windows, doors and signs.
    this.building(g,5,5,8,5,0xb65c55,"PLAYER HOME");
    this.building(g,14,5,7,5,0xd45d76,"POKÉ CENTER");
    this.building(g,4,16,9,5,0x8c70b5,"RANGER HUT");
    // Forest Trial entrance and landmark stonework.
    g.fillStyle(0x4b3b48,1).fillRect(36*TILE-5,7*TILE-5,3*TILE+10,4*TILE+10);
    g.fillStyle(0x8e8b93,1).fillRect(36*TILE,7*TILE,3*TILE,4*TILE);
    g.fillStyle(0xb9b5b9,1).fillRect(36*TILE+5,7*TILE+5,8,4*TILE-10);
    g.fillStyle(0x594f64,1).fillRect(37*TILE,8*TILE,1*TILE,3*TILE);
    g.fillStyle(0xdacb9a,1).fillRect(38*TILE,8*TILE,1*TILE,3*TILE);
    g.fillStyle(0x4d3c32,1).fillRect(22*TILE,10*TILE,44,28);
    g.fillStyle(0xe7d5a1,1).fillRect(22*TILE+4,10*TILE+4,36,20);
    g.fillStyle(0x8c6a42,1).fillRect(22*TILE+4,10*TILE+4,36,4);
    g.fillStyle(0x4e7044,1).fillRect(22*TILE+4,10*TILE+17,36,4);
    // Flower patches, mushrooms, rocks and little route props.
    for(let i=0;i<34;i++){
      const x=(i*17+6)%40,y=(i*11+3)%28;
      if(this.solid.has(keyOf(x,y))||this.grass.has(keyOf(x,y))||((x>=7&&x<=23)&&(y>=10&&y<=26)))continue;
      const fx=x*TILE+7+(i%4)*5,fy=y*TILE+8+(i%3)*6;
      g.fillStyle=i%3===0?0xf2d96b:i%3===1?0xf4a5c6:0xe9f0d4,1);
      g.fillRect(fx,fy,4,4);g.fillRect(fx-2,fy+2,3,3);g.fillRect(fx+3,fy+2,3,3);
      g.fillStyle(0x4d8c4d,1).fillRect(fx+1,fy+5,2,5);
    }
    for(const [x,y] of [[13,14],[24,18],[30,22],[7,25],[35,24],[21,20],[3,13],[39,15]]){
      g.fillStyle(0x806a59,1).fillRect(x*TILE+4,y*TILE+12,24,14);
      g.fillStyle(0xb5a08a,1).fillRect(x*TILE+7,y*TILE+8,17,10);
      g.fillStyle(0xd0bca2,1).fillRect(x*TILE+10,y*TILE+8,7,4);
      g.fillStyle(0x5e4b43,1).fillRect(x*TILE+4,y*TILE+23,24,3);
    }
    // Decorative trees use chunky pixel canopies with shadow and layered foliage.
    const trees=[[3,3],[4,3],[3,4],[22,4],[23,4],[36,5],[37,5],[36,6],[22,12],[23,12],[22,13],[34,17],[35,17],[34,18],[14,24],[15,24],[16,24],[28,23],[29,23],[30,23],[2,27],[3,27],[40,4],[40,5],[13,28],[14,28],[2,8],[3,8],[12,3],[13,3],[27,3],[28,3],[29,4],[5,13],[6,13],[12,14],[13,14],[20,17],[21,17],[25,18],[26,18],[31,22],[32,22],[37,25],[38,25],[10,27],[11,27]];
    for(const [tx,ty] of trees){
      const x=tx*TILE,y=ty*TILE;
      g.fillStyle(0x355b3a,1).fillRect(x+9,y+20,14,13);
      g.fillStyle(0x286344,1).fillRect(x+1,y+5,30,24);
      g.fillStyle(0x3d8b4d,1).fillRect(x+5,y+1,22,24);
      g.fillStyle(0x58ad5a,1).fillRect(x+8,y+3,13,13);
      g.fillStyle(0x76c76a,1).fillRect(x+8,y+4,7,5);
      g.fillStyle(0x2c7043,1).fillRect(x+2,y+17,8,7);
      g.fillStyle(0x4b9d52,1).fillRect(x+20,y+13,9,8);
      g.fillStyle(0x1f5637,1).fillRect(x+3,y+27,26,4);
    }
    this.mapLayer.add(g);
    for(const n of NPCS)this.drawNpc(n);
    this.add.text(2*TILE,1.5*TILE,"GREENLEAF VILLAGE",{fontFamily:"monospace",fontSize:"16px",color:"#fff1c9",stroke:"#25472e",strokeThickness:5}).setDepth(4);
    this.add.text(34*TILE,6*TILE,"FOREST TRIAL",{fontFamily:"monospace",fontSize:"10px",color:"#fff0bd",stroke:"#493a27",strokeThickness:3}).setDepth(4);
    this.add.text(21*TILE,9*TILE,"SIGN",{fontFamily:"monospace",fontSize:"9px",color:"#fff0bd",backgroundColor:"#73563a",padding:{x:4,y:2}}).setDepth(4);
  }
  private building(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,color:number,label:string){
    const px=x*TILE,py=y*TILE,ww=w*TILE,hh=h*TILE;
    // Timber base and stone footing.
    g.fillStyle(0x493a35,1).fillRect(px-5,py+hh-5,ww+10,13);
    g.fillStyle(0xc3b69a,1).fillRect(px-3,py+hh-4,ww+6,5);
    g.fillStyle(0x72504a,1).fillRect(px-7,py-12,ww+14,22);
    g.fillStyle(color,1).fillRect(px,py,ww,hh);
    // Roof tiles: stepped eaves and repeated highlights read as pixel shingles.
    g.fillStyle(0x6b3d49,1).fillRect(px-6,py-9,ww+12,13);
    g.fillStyle(color,1).fillRect(px-3,py-13,ww+6,9);
    g.fillStyle(0xf1b6a1,1).fillRect(px+5,py-11,ww-10,3);
    for(let row=0;row<3;row++)for(let col=0;col<w*2;col++){
      g.fillStyle((row+col)%3===0?0x8c4654:0x703e4c,1).fillRect(px+col*16-2,py-7+row*4,13,3);
    }
    // Wall boards and framed windows.
    g.fillStyle(0x643f43,.55);for(let col=1;col<w;col+=2)g.fillRect(px+col*TILE,py+15,2,hh-20);
    for(const wx of [px+TILE,px+ww-TILE-7]){
      g.fillStyle(0x63463d,1).fillRect(wx-3,py+TILE-2,20,23);
      g.fillStyle(0xf4dba4,1).fillRect(wx,py+TILE+1,14,17);
      g.fillStyle(0x79b8d0,1).fillRect(wx+2,py+TILE+3,10,13);
      g.fillStyle(0xf7e7c2,1).fillRect(wx+6,py+TILE+3,2,13);
      g.fillStyle(0xf7e7c2,1).fillRect(wx+2,py+TILE+8,10,2);
    }
    // Entrance with doorstep.
    const dx=px+Math.floor(w/2)*TILE;
    g.fillStyle(0x5a3935,1).fillRect(dx-2,py+hh-2,TILE+4,2*TILE+3);
    g.fillStyle=0x9d6c4e,1).fillRect(dx+3,py+hh+2,TILE-6,2*TILE-5);
    g.fillStyle=0x4d302d,1).fillRect(dx+7,py+hh+5,TILE-14,2*TILE-8);
    g.fillStyle(0xe7c77f,1).fillRect(dx+TILE-11,py+hh+TILE,3,3);
    g.fillStyle(0xf2e1bc,1).fillRect(px+8,py+5,ww-16,13);
    this.mapLayer.add(this.add.text(px+ww/2,py+7,label,{fontFamily:"monospace",fontSize:"8px",color:"#573e30"}).setOrigin(.5).setDepth(3));
  }
  private drawNpc(n:Npc){
    const palette=n.kind==="healer"?[0xf4dce6,0xe8a6b9,0x8c4d77]:n.kind==="boss"?[0x7e4eae,0xd8b8e8,0x39264f]:n.kind==="trainer"?[0xe3a25b,0xf0c18d,0x4d6b9b]:[0x8ed0a5,0xdab58c,0x416b53];
    const c=this.add.container(n.x*TILE+16,n.y*TILE+16);
    const p=this.add.graphics();
    // Tiny 16-bit style trainer: feet, jacket, hands, face, hair/hat and outline.
    const px=(x:number,y:number,w:number,h:number,col:number)=>p.fillStyle(col,1).fillRect(x,y,w,h);
    px(-7,9,5,5,0x493b3a);px(2,9,5,5,0x493b3a);px(-8,3,16,7,palette[0]);px(-10,-1,5,8,palette[0]);px(5,-1,5,8,palette[0]);
    px(-6,-8,12,12,0xf0c39a);px(-7,-11,14,5,0x49382e);px(-6,-14,12,5,palette[1]);px(-3,-5,2,2,0x2b2b34);px(3,-5,2,2,0x2b2b34);
    px(-7,0,14,4,palette[2]);px(-4,4,8,3,palette[2]);px(-9,1,4,5,0xf0c39a);px(5,1,4,5,0xf0c39a);
    c.add(p);c.add(this.add.text(0,-25,n.name,{fontFamily:"monospace",fontSize:"8px",color:"#fff",backgroundColor:"#263d2c",padding:{x:3,y:2}}).setOrigin(.5));
    c.setDepth(5);this.mapLayer.add(c);
  }
  private drawPlayer(){
    this.player=this.add.container(this.px*TILE+16,this.py*TILE+16);
    const p=this.add.graphics();const px=(x:number,y:number,w:number,h:number,col:number)=>p.fillStyle(col,1).fillRect(x,y,w,h);
    // Original pixel trainer sprite with shadow, backpack, jacket and directional face.
    px(-11,12,22,4,0x315d3c);px(-7,8,5,7,0x443a37);px(2,8,5,7,0x443a37);
    px(-8,1,16,9,0xc94d54);px(-11,-1,5,8,0xe9b88d);px(6,-1,5,8,0xe9b88d);
    px(-7,-9,14,13,0xf0c69b);px(-8,-13,16,6,0x292d39);px(-6,-16,12,5,0xe2c64f);
    px(-8,-11,16,3,0x303846);px(-4,-5,2,2,0x27313a);px(3,-5,2,2,0x27313a);
    px(-8,1,16,3,0x9b3546);px(-4,4,8,3,0x9b3546);px(-10,0,4,5,0x426ca6);px(6,0,4,5,0x426ca6);
    px(7,-8,4,7,0x513d32);px(8,-7,2,3,0xf1d49c);
    this.player.add(p);this.player.setDepth(10);
  }
  private blocked(x:number,y:number){const water=x>=25&&x<=31&&y>=8&&y<=14;return x<1||y<1||x>=MAP.width-1||y>=MAP.height-1||water||this.solid.has(keyOf(x,y))||this.npcTiles.has(keyOf(x,y));}
  update(){
    if(this.battle||this.moving)return;
    const l=this.cursors.left.isDown||this.keys.A.isDown,r=this.cursors.right.isDown||this.keys.D.isDown,u=this.cursors.up.isDown||this.keys.W.isDown,d=this.cursors.down.isDown||this.keys.S.isDown;
    let dx=l?-1:r?1:0,dy=u?-1:d?1:0;if(dx&&dy){if(l||r)dy=0;else dx=0;}
    if(!dx&&!dy)return;this.face={x:dx,y:dy};
    const nx=this.px+dx,ny=this.py+dy;if(this.blocked(nx,ny))return;
    this.moving=true;this.px=nx;this.py=ny;
    this.tweens.add({targets:this.player,x:nx*TILE+16,y:ny*TILE+16,duration:105,onComplete:()=>{
      this.moving=false;this.save.steps++;this.save.position={x:this.px,y:this.py};this.persist();
      if(keyOf(nx,ny)===keyOf(40,27))this.tryExit();
      if(this.grass.has(keyOf(nx,ny))&&Math.random()<.22)this.startWildBattle();
    }});
  }
  private interact(){
    if(this.battle)return;
    const x=this.px+this.face.x,y=this.py+this.face.y;
    const npc=NPCS.find(n=>n.x===x&&n.y===y);
    if(npc){this.talk(npc);return;}
    if(x===23&&y===10){this.showToast("Cẩm nang: cỏ cao có Pokémon hoang. Hãy bắt 1 Pokémon, thắng 3 Trainer rồi mở cổng Trial!");return;}
    if(this.grass.has(keyOf(this.px,this.py))){this.startWildBattle();return;}
    this.showToast("Không có gì để tương tác ở đây.");
  }
  private talk(n:Npc){
    if(n.kind==="healer"){this.save.party.forEach(p=>p.hp=this.maxHp(p));this.persist();this.showToast("Nurse Maple đã hồi phục cả đội. Chúc bạn may mắn!");return;}
    if(n.kind==="guide"){this.showToast(n.line);return;}
    if(n.kind==="boss"&&!this.save.defeated.includes("trainer1")||n.kind==="boss"&&!this.save.defeated.includes("trainer2")||n.kind==="boss"&&!this.save.defeated.includes("trainer3")){this.showToast("Cổng Trial cần 3 dấu thắng Trainer. Hãy tìm Finn, Willow và Moss.");return;}
    if(this.save.defeated.includes(n.id)){this.showToast("Bạn đã thắng trận này rồi!");return;}
    this.startTrainerBattle(n);
  }
  private tryExit(){if(!this.save.badge){this.showToast("Forest Trial chưa hoàn thành. Hãy đánh bại Guardian!");this.px=39;this.save.position={x:this.px,y:this.py};this.player.x=this.px*TILE+16;this.persist();return;}this.showToast("Map Greenleaf hoàn thành! Khu vực tiếp theo sẽ mở trong bản cập nhật.");this.px=39;this.save.position={x:this.px,y:this.py};this.player.x=this.px*TILE+16;this.persist();}
  private startWildBattle(){
    const available=SPECIES.filter(s=>s.id!=="snorlax");const s=available[Math.floor(Math.random()*available.length)];
    this.openBattle({foe:makeCreature(s.id,2+Math.floor(Math.random()*4)),wild:true,boss:false});
  }
  private startTrainerBattle(n:Npc){
    const boss=n.kind==="boss";const id=boss?"snorlax":n.id==="trainer1"?"caterpie":n.id==="trainer2"?"vulpix":"psyduck";
    this.openBattle({foe:makeCreature(id,boss?9:4+this.save.defeated.length),trainer:n,boss,wild:false});
  }
  private openBattle(b:Battle){
    this.battle=b;this.battleLayer=this.add.container(0,0).setScrollFactor(0).setDepth(1000);
    const bg=this.add.rectangle(320,200,640,400,0x14242c,.97);bg.setInteractive();this.battleLayer.add(bg);
    this.battleLayer.add(this.add.text(24,18,b.trainer?b.trainer.name+" challenges you!":"A wild Pokémon appeared!",{fontFamily:"monospace",fontSize:"16px",color:"#fff"}));
    const fs=getSpecies(b.foe.speciesId);
    this.battleLayer.add(this.add.ellipse(455,125,135,40,0x496b53,.8));
    this.battleLayer.add(this.add.circle(455,83,38,fs.color).setStrokeStyle(4,0x243b35));
    this.battleLayer.add(this.add.text(355,145,fs.name,{fontFamily:"monospace",fontSize:"18px",color:"#fff"}));
    const active=this.active();const ps=getSpecies(active.speciesId);
    this.battleLayer.add(this.add.ellipse(160,265,145,40,0x496b53,.8));
    this.battleLayer.add(this.add.circle(160,220,42,ps.color).setStrokeStyle(4,0x243b35));
    this.battleLayer.add(this.add.text(25,285,ps.name+"  Lv."+active.level,{fontFamily:"monospace",fontSize:"16px",color:"#fff"}));
    this.battleLayer.add(this.add.text(25,310,`HP ${active.hp}/${this.maxHp(active)}`,{fontFamily:"monospace",fontSize:"14px",color:"#bce6a5"}));
    this.battleLayer.add(this.add.text(355,170,`HP ${b.foe.hp}/${this.maxHp(b.foe)}`,{fontFamily:"monospace",fontSize:"13px",color:"#bce6a5"}));
    this.battleLayer.add(this.add.text(22,350,"1 ATTACK    2 CAPTURE    3 POTION    4 RUN",{fontFamily:"monospace",fontSize:"13px",color:"#f5e5bd"}));
    this.battleLayer.add(this.add.text(22,375,b.wild?"Wild encounter · catch or battle":"Trainer battle · no running",{fontFamily:"monospace",fontSize:"10px",color:"#9ab8c2"}));
    this.input.keyboard!.on("keydown-ONE",this.action1);this.input.keyboard!.on("keydown-TWO",this.action2);this.input.keyboard!.on("keydown-THREE",this.action3);this.input.keyboard!.on("keydown-FOUR",this.action4);
    this.showToast("Battle bắt đầu! Chọn hành động bằng phím 1–4.");
  }
  private active(){return this.save.party.find(p=>p.hp>0)??this.save.party[0];}
  private maxHp(c:Creature){return getSpecies(c.speciesId).maxHp+c.level*2;}
  private action1=()=>this.attack();
  private action2=()=>this.capture();
  private action3=()=>this.usePotion();
  private action4=()=>this.run();
  private battleMenu(){this.showToast("Battle controls: 1 Attack · 2 Capture · 3 Potion · 4 Run");}
  private attack(){
    if(!this.battle)return;const b=this.battle,a=this.active(),s=getSpecies(a.speciesId),f=getSpecies(b.foe.speciesId);
    b.foe.hp-=Math.max(3,s.attack+a.level+Math.floor(Math.random()*4));
    if(b.foe.hp<=0){this.winBattle();return;}
    a.hp-=Math.max(2,f.attack+b.foe.level+Math.floor(Math.random()*3));
    if(a.hp<=0){a.hp=0;const next=this.save.party.find(p=>p.hp>0);if(!next){this.save.party.forEach(p=>p.hp=this.maxHp(p));this.px=8;this.py=12;this.save.position={x:this.px,y:this.py};this.player.setPosition(this.px*TILE+16,this.py*TILE+16);this.showToast("Đội đã kiệt sức. Nurse Maple hồi phục và đưa bạn về làng.");this.endBattle();this.persist();return;}}
    this.refreshBattle();this.persist();
  }
  private capture(){
    if(!this.battle?.wild)return;if(this.save.balls<=0){this.showToast("Bạn đã hết Poké Ball!");return;}
    this.save.balls--;const b=this.battle,foe=getSpecies(b.foe.speciesId),chance=clamp(foe.catchRate+(1-b.foe.hp/this.maxHp(b.foe))*.45,.08,.95);
    if(Math.random()<chance){if(this.save.party.length<6){this.save.party.push(b.foe);this.showToast(`Bắt được ${foe.name}! Pokémon gia nhập đội.`);}else{this.save.box.push(b.foe);this.showToast(`Bắt được ${foe.name}! Đội đầy, Pokémon được gửi vào PC Box.`);}this.endBattle();}
    else{this.showToast("Pokémon thoát khỏi Poké Ball!");this.enemyTurn();}
    this.persist();
  }
  private usePotion(){if(!this.battle)return;if(this.save.potions<=0){this.showToast("Hết Potion!");return;}const a=this.active();if(a.hp>=this.maxHp(a)){this.showToast("Pokémon đang đầy HP.");return;}this.save.potions--;a.hp=clamp(a.hp+20,0,this.maxHp(a));this.enemyTurn();this.refreshBattle();this.persist();}
  private run(){if(!this.battle?.wild){this.showToast("Không thể chạy khỏi trận Trainer!");return;}this.endBattle();this.showToast("Bạn đã rút lui an toàn.");}
  private enemyTurn(){if(!this.battle)return;const a=this.active(),f=getSpecies(this.battle.foe.speciesId);a.hp=Math.max(0,a.hp-f.attack-this.battle.foe.level);if(!a.hp&&!this.save.party.some(p=>p.hp>0)){this.save.party.forEach(p=>p.hp=this.maxHp(p));this.endBattle();this.showToast("Đội được hồi phục tại Pokémon Center.");}}
  private winBattle(){
    if(!this.battle)return;const b=this.battle,a=this.active(),foe=getSpecies(b.foe.speciesId);
    a.xp+=foe.xp;if(a.xp>=a.level*20){a.xp-=a.level*20;a.level++;a.hp=this.maxHp(a);this.showToast(`${getSpecies(a.speciesId).name} lên cấp ${a.level}!`);}
    if(b.trainer){this.save.defeated.push(b.trainer.id);if(b.boss)this.save.badge=true;}
    this.endBattle();this.persist();this.showToast(b.boss?"Bạn đã nhận Forest Badge! Map cleared!":`Chiến thắng! +${foe.xp} EXP.`);
  }
  private refreshBattle(){
    if(!this.battle||!this.battleLayer)return;
    // Replace the status area only; keep the combatants and action prompts.
    const b=this.battle,a=this.active();this.battleLayer.getAll().filter(o=>o instanceof Phaser.GameObjects.Text&&(o.y===310||o.y===170)).forEach(o=>o.destroy());
    this.battleLayer.add(this.add.text(25,310,`HP ${a.hp}/${this.maxHp(a)}`,{fontFamily:"monospace",fontSize:"14px",color:"#bce6a5"}));
    this.battleLayer.add(this.add.text(355,170,`HP ${b.foe.hp}/${this.maxHp(b.foe)}`,{fontFamily:"monospace",fontSize:"13px",color:"#bce6a5"}));
  }
  private endBattle(){
    this.input.keyboard!.off("keydown-ONE",this.action1);this.input.keyboard!.off("keydown-TWO",this.action2);this.input.keyboard!.off("keydown-THREE",this.action3);this.input.keyboard!.off("keydown-FOUR",this.action4);
    this.battleLayer?.destroy(true);this.battleLayer=null;this.battle=null;
  }
  private persist(){saveGame(this.save);}
  private showToast(message:string){
    this.toastText?.destroy();this.toastText=this.add.text(320,24,message,{fontFamily:"monospace",fontSize:"12px",color:"#fff",backgroundColor:"#172c22",padding:{x:10,y:8},align:"center",wordWrap:{width:570}}).setOrigin(.5).setScrollFactor(0).setDepth(1500);
    this.toastTimer?.remove(false);this.toastTimer=this.time.delayedCall(3000,()=>this.toastText?.destroy());
  }
}

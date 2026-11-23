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
    this.save=loadSave(); this.px=clamp(this.save.steps?this.px:8,1,40); this.py=12;
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
    for(let y=0;y<MAP.height;y++)for(let x=0;x<MAP.width;x++){
      const edge=x===0||y===0||x===MAP.width-1||y===MAP.height-1;
      let c=((x*7+y*11)%4===0)?0x5aab69:0x4e9b5d;
      if((x>12&&x<23&&y>10&&y<15)||(x>2&&x<12&&y>22&&y<27)||(x>31&&x<41&&y>18&&y<22))c=0x9cbd69;
      if(edge)c=0x2d593b;
      g.fillStyle(c,1).fillRect(x*TILE,y*TILE,TILE,TILE);
      g.lineStyle(1,0x244d35,.13).strokeRect(x*TILE,y*TILE,TILE,TILE);
    }
    // Paths connect village, meadow, lake, southern grove and trial gate.
    g.fillStyle(0xc9b477,1);
    g.fillRect(7*TILE,10*TILE,5*TILE,14*TILE);
    g.fillRect(10*TILE,11*TILE,14*TILE,3*TILE);
    g.fillRect(17*TILE,13*TILE,3*TILE,13*TILE);
    g.fillRect(18*TILE,24*TILE,22*TILE,3*TILE);
    g.fillRect(36*TILE,10*TILE,5*TILE,17*TILE);
    // Grass patches
    for(const p of GRASS){g.fillStyle(0x347e48,1).fillRect(p.x*TILE,p.y*TILE,TILE,TILE);g.fillStyle(0x76c86b,1);for(let i=0;i<4;i++)g.fillRect(p.x*TILE+5+i*7,p.y*TILE+8+(i%2)*7,3,11);}
    // Lake and water edge
    g.fillStyle(0x286da0,1).fillRoundedRect(25*TILE,8*TILE,7*TILE,7*TILE,12);
    g.lineStyle(4,0x7ac5d3,1).strokeRoundedRect(25*TILE,8*TILE,7*TILE,7*TILE,12);
    // Buildings
    this.building(g,5,5,8,5,0xb45c4c,"PLAYER HOME");
    this.building(g,14,5,7,5,0xd85f72,"POKÉ CENTER");
    this.building(g,4,16,9,5,0x8d75b9,"RANGER HUT");
    // Stone gate, sign, flower beds and trees
    g.fillStyle(0x7b8586,1).fillRect(37*TILE,7*TILE,2*TILE,3*TILE);
    g.fillStyle(0xe7d49a,1).fillRect(38*TILE,8*TILE,1*TILE,2*TILE);
    g.fillStyle(0x8d6438,1).fillRect(23*TILE,10*TILE,8,40);
    g.fillStyle(0xe4d5a4,1).fillRect(22*TILE,10*TILE,36,22);
    g.fillStyle(0x3b633d,1);
    for(const [x,y] of [[3,3],[4,3],[3,4],[22,4],[23,4],[36,5],[37,5],[36,6],[22,12],[23,12],[22,13],[34,17],[35,17],[34,18],[14,24],[15,24],[16,24],[28,23],[29,23],[30,23],[2,27],[3,27],[40,4],[40,5],[13,28],[14,28]]){g.fillCircle(x*TILE+16,y*TILE+16,14);g.fillStyle(0x5b9b58,1);g.fillCircle(x*TILE+13,y*TILE+11,9);g.fillStyle(0x3b633d,1);}
    this.mapLayer.add(g);
    for(const n of NPCS)this.drawNpc(n);
    this.add.text(2*TILE,1.5*TILE,"GREENLEAF VILLAGE",{fontFamily:"monospace",fontSize:"16px",color:"#f5edc8",stroke:"#24472e",strokeThickness:5}).setDepth(4);
    this.add.text(34*TILE,6*TILE,"FOREST TRIAL",{fontFamily:"monospace",fontSize:"10px",color:"#fff0bd",stroke:"#493a27",strokeThickness:3}).setDepth(4);
    this.add.text(21*TILE,9*TILE,"SIGN",{fontFamily:"monospace",fontSize:"9px",color:"#fff0bd"}).setDepth(4);
  }
  private building(g:Phaser.GameObjects.Graphics,x:number,y:number,w:number,h:number,color:number,label:string){
    g.fillStyle(0x453b32,1).fillRect(x*TILE-5,y*TILE-8,w*TILE+10,h*TILE+12);
    g.fillStyle(color,1).fillRect(x*TILE,y*TILE,w*TILE,h*TILE);
    g.fillStyle(0xead39a,1).fillRect((x+Math.floor(w/2))*TILE,(y+h-2)*TILE,TILE,2*TILE);
    g.fillStyle(0x9bd2df,1).fillRect((x+1)*TILE,(y+1)*TILE,TILE,1.5*TILE);
    g.fillStyle(0xf5e4bd,1).fillRect((x+w-2)*TILE,(y+1)*TILE,TILE,1.5*TILE);
    g.fillStyle(0x6e4334,1).fillRect(x*TILE-5,y*TILE-8,w*TILE+10,12);
    g.fillStyle(0xf6e5c5,1).fillRect(x*TILE+8,y*TILE+3,w*TILE-16,14);
    this.mapLayer.add(this.add.text((x+w/2)*TILE,y*TILE+5,label,{fontFamily:"monospace",fontSize:"8px",color:"#573e30"}).setOrigin(.5).setDepth(3));
  }
  private drawNpc(n:Npc){
    const color=n.kind==="healer"?0xf3e5e9:n.kind==="boss"?0x7e4eae:n.kind==="trainer"?0xe3a25b:0x8ed0a5;
    const c=this.add.container(n.x*TILE+16,n.y*TILE+16);
    c.add([this.add.rectangle(0,3,21,24,color).setStrokeStyle(2,0x352f2b),this.add.rectangle(0,-7,15,12,0xf1c79d).setStrokeStyle(1,0x352f2b),this.add.rectangle(0,10,12,8,n.kind==="boss"?0x452d69:0x3d6c9b)]);
    c.add(this.add.text(0,-24,n.name,{fontFamily:"monospace",fontSize:"8px",color:"#fff",backgroundColor:"#1e3026",padding:{x:3,y:2}}).setOrigin(.5));
    c.setDepth(5); this.mapLayer.add(c);
  }
  private drawPlayer(){
    this.player=this.add.container(this.px*TILE+16,this.py*TILE+16);
    const body=this.add.rectangle(0,3,20,23,0x4f8bd8).setStrokeStyle(2,0x233e61);
    const head=this.add.rectangle(0,-8,16,13,0xf1c69a).setStrokeStyle(2,0x523d2b);
    const cap=this.add.rectangle(0,-15,20,6,0xe4c44e).setStrokeStyle(1,0x55431b);
    this.player.add([body,head,cap]);this.player.setDepth(10);
  }
  private blocked(x:number,y:number){return x<1||y<1||x>=MAP.width-1||y>=MAP.height-1||this.solid.has(keyOf(x,y))||this.npcTiles.has(keyOf(x,y));}
  update(){
    if(this.battle||this.moving)return;
    const l=this.cursors.left.isDown||this.keys.A.isDown,r=this.cursors.right.isDown||this.keys.D.isDown,u=this.cursors.up.isDown||this.keys.W.isDown,d=this.cursors.down.isDown||this.keys.S.isDown;
    let dx=l?-1:r?1:0,dy=u?-1:d?1:0;if(dx&&dy){if(l||r)dy=0;else dx=0;}
    if(!dx&&!dy)return;this.face={x:dx,y:dy};
    const nx=this.px+dx,ny=this.py+dy;if(this.blocked(nx,ny))return;
    this.moving=true;this.px=nx;this.py=ny;
    this.tweens.add({targets:this.player,x:nx*TILE+16,y:ny*TILE+16,duration:105,onComplete:()=>{
      this.moving=false;this.save.steps++;this.persist();
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
  private tryExit(){if(!this.save.badge){this.showToast("Forest Trial chưa hoàn thành. Hãy đánh bại Guardian!");this.px=39;this.player.x=this.px*TILE+16;return;}this.showToast("Map Greenleaf hoàn thành! Khu vực tiếp theo sẽ mở trong bản cập nhật.");this.px=39;this.player.x=this.px*TILE+16;}
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
    if(a.hp<=0){a.hp=0;const next=this.save.party.find(p=>p.hp>0);if(!next){this.save.party.forEach(p=>p.hp=this.maxHp(p));this.px=8;this.py=12;this.player.setPosition(this.px*TILE+16,this.py*TILE+16);this.showToast("Đội đã kiệt sức. Nurse Maple hồi phục và đưa bạn về làng.");this.endBattle();this.persist();return;}}
    this.refreshBattle();this.persist();
  }
  private capture(){
    if(!this.battle?.wild)return;if(this.save.balls<=0){this.showToast("Bạn đã hết Poké Ball!");return;}
    this.save.balls--;const b=this.battle,foe=getSpecies(b.foe.speciesId),chance=clamp(foe.catchRate+(1-b.foe.hp/this.maxHp(b.foe))*.45,.08,.95);
    if(Math.random()<chance){if(this.save.party.length<6)this.save.party.push(b.foe);this.showToast(`Bắt được ${foe.name}! ${this.save.party.length>=6?"Đội đã đủ 6, Pokémon được lưu vào hộp (demo).": "Pokémon gia nhập đội!"}`);this.endBattle();}
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

import Phaser from "phaser";
import { ensureCompanionTexture } from "../../petbound/art";

const T = 32, W = 64, H = 40;
type PanelId = "shrine" | "nursery" | "training" | "challenge" | "shop" | "forest";
interface Landmark { id: PanelId; title: string; x: number; y: number; radius: number; }
const noise=(x:number,y:number,s=0)=>{let n=Math.imul(x+31,374761393)+Math.imul(y+17,668265263)+s*1442695041;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
function poly(c:CanvasRenderingContext2D,p:number[][],fill:string,stroke?:string,w=1){c.beginPath();c.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)c.lineTo(p[i][0],p[i][1]);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.stroke();}}
function oval(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,fill:string){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();}

export class PetboundScene extends Phaser.Scene {
  private keys!: Record<string,Phaser.Input.Keyboard.Key>;
  private player!: Phaser.GameObjects.Sprite;
  private followers:Phaser.GameObjects.Image[]=[];
  private partyIds:string[]=[];
  private trail:{x:number;y:number}[]=[];
  private landmarks:Landmark[]=[];
  private solids:Phaser.Geom.Rectangle[]=[];
  private fireflies:Phaser.GameObjects.Arc[]=[];
  private locked=false;
  private lastStep=0;
  private encounterClock=0;
  private prompt="";
  constructor(){super("PetboundScene");}

  create(){
    this.makePlayerTexture();this.makeShadowTexture();
    this.drawGround();this.drawStructures();this.drawTrees();this.drawProps();this.drawVillagers();
    this.player=this.add.sprite(31.5*T,24*T,"pb-player").setOrigin(.5,.86).setDepth(24*T);
    this.cameras.main.setBounds(0,0,W*T,H*T).setZoom(1.03).startFollow(this.player,true,.085,.085).setDeadzone(100,72);
    this.keys=this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT") as Record<string,Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-E",this.interact,this);
    this.input.keyboard!.on("keydown-SPACE",this.interact,this);
    this.input.keyboard!.on("keydown-ESC",()=>window.dispatchEvent(new CustomEvent("petbound:open",{detail:{panel:"menu"}})));
    window.addEventListener("petbound:party",this.onParty as EventListener);
    window.addEventListener("petbound:freeze",this.onFreeze as EventListener);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{
      this.input.keyboard?.off("keydown-E",this.interact,this);this.input.keyboard?.off("keydown-SPACE",this.interact,this);
      window.removeEventListener("petbound:party",this.onParty as EventListener);
      window.removeEventListener("petbound:freeze",this.onFreeze as EventListener);
      this.fireflies.forEach(f=>f.destroy());
    });
    this.time.addEvent({delay:90,loop:true,callback:()=>this.ambient()});
    this.syncFollowers(this.partyIds);
  }
  private onParty=(e:Event)=>this.syncFollowers((e as CustomEvent<string[]>).detail??[]);
  private onFreeze=(e:Event)=>{this.locked=!!(e as CustomEvent<boolean>).detail;};
  update(_t:number,delta:number){
    if(!this.player||this.locked)return;
    const dt=Math.min(delta,40)/1000;let dx=0,dy=0;
    if(this.keys.A.isDown||this.keys.LEFT.isDown)dx--;if(this.keys.D.isDown||this.keys.RIGHT.isDown)dx++;
    if(this.keys.W.isDown||this.keys.UP.isDown)dy--;if(this.keys.S.isDown||this.keys.DOWN.isDown)dy++;
    if(dx||dy){
      const len=Math.hypot(dx,dy);dx/=len;dy/=len;
      const speed=this.keys.SHIFT.isDown?205:140,nx=this.player.x+dx*speed*dt,ny=this.player.y+dy*speed*dt;
      if(!this.blocked(nx,this.player.y))this.player.x=nx;if(!this.blocked(this.player.x,ny))this.player.y=ny;
      this.player.setFlipX(dx<0);if(this.time.now-this.lastStep>120){this.trail.unshift({x:this.player.x,y:this.player.y});this.trail=this.trail.slice(0,100);this.lastStep=this.time.now;}
      this.encounterClock+=delta;
      if(this.player.x>49*T&&this.player.y>15*T&&this.player.y<34*T&&this.encounterClock>12000){this.encounterClock=0;if(Math.random()<.2)window.dispatchEvent(new CustomEvent("petbound:wild",{detail:{zone:"everdawn"}}));}
    }
    this.updateFollowers();
    const near=this.nearestLandmark(),prompt=near?"E  ·  "+near.title:"WASD di chuyển  ·  SHIFT chạy  ·  E tương tác";
    if(prompt!==this.prompt){this.prompt=prompt;window.dispatchEvent(new CustomEvent("petbound:proximity",{detail:prompt}));}
  }
  private blocked(x:number,y:number){
    const r=new Phaser.Geom.Rectangle(x-8,y-5,16,10);
    if(x<3*T||y<3*T||x>(W-3)*T||y>(H-3)*T)return true;
    return this.solids.some(s=>Phaser.Geom.Intersects.RectangleToRectangle(s,r));
  }
  private nearestLandmark(){
    let found:Landmark|undefined,dist=Infinity;
    for(const m of this.landmarks){const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,m.x,m.y);if(d<m.radius&&d<dist){found=m;dist=d;}}
    return found;
  }
  private interact=()=>{
    if(this.locked)return;const m=this.nearestLandmark();
    if(m){this.locked=true;window.dispatchEvent(new CustomEvent("petbound:freeze",{detail:true}));window.dispatchEvent(new CustomEvent("petbound:open",{detail:{panel:m.id,title:m.title}}));}
    else window.dispatchEvent(new CustomEvent("petbound:notify",{detail:"Đi đến gần một công trình hoặc cổng phát sáng rồi nhấn E."}));
  };
  private syncFollowers(ids:string[]){
    this.partyIds=ids;while(this.followers.length>ids.length)this.followers.pop()?.destroy();
    ids.forEach((id,i)=>{const key=ensureCompanionTexture(this,id);if(!this.followers[i])this.followers[i]=this.add.image(this.player?.x??31*T,this.player?.y??24*T,key).setScale(1.45);else this.followers[i].setTexture(key);});
    this.updateFollowers();
  }
  private updateFollowers(){
    this.followers.forEach((p,i)=>{const pos=this.trail[(i+1)*20]??{x:this.player.x-(i+1)*32,y:this.player.y+18};p.setPosition(Phaser.Math.Linear(p.x,pos.x,.2),Phaser.Math.Linear(p.y,pos.y,.2)).setDepth(p.y+8);});
  }
  private drawGround(){
    const key="pb-ground";
    if(!this.textures.exists(key)){
      const c=document.createElement("canvas");c.width=W*T;c.height=H*T;const g=c.getContext("2d")!;g.imageSmoothingEnabled=false;
      for(let y=0;y<H;y++)for(let x=0;x<W;x++){
        const px=x*T,py=y*T, pond=((x-8)/5)**2+((y-29)/3.6)**2<1, plaza=((x-31.5)/6.4)**2+((y-21.2)/4.5)**2<1;
        const roadV=Math.abs(x-(31+Math.sin(y*.16)*2))<1.7,roadH=Math.abs(y-(22+Math.sin(x*.11)*1.6))<1.6,roadSide=x>44&&y>22&&y<35;
        const garden=x>9&&x<17&&y>22&&y<31,meadow=x>48&&y>14&&y<34;
        let color= noise(x,y,5)>.5?"#7fbd65":"#8bc96d";
        if(plaza)color=noise(x,y,9)>.5?"#b9b18d":"#c9bf9a";
        else if(roadV||roadH||roadSide)color=noise(x,y,11)>.5?"#c79d65":"#d4b47d";
        else if(pond)color=noise(x,y,7)>.5?"#4dabc1":"#3d91ad";
        else if(garden)color=noise(x,y,4)>.5?"#819f52":"#749146";
        else if(meadow)color=noise(x,y,3)>.5?"#72ad54":"#689c4c";
        g.fillStyle=color;g.fillRect(px,py,T,T);
        for(let i=0;i<11;i++){
          const ox=2+Math.floor(noise(x*17+i,y*13+i,4)*27),oy=2+Math.floor(noise(x*11+i,y*29+i,5)*27);
          g.fillStyle=pond?"#8ed9dd":plaza?"#ded3ad":roadV||roadH||roadSide?(i%2?"#ebce97":"#a98453"):(i%3?"#a4d57d":"#639f4c");
          g.fillRect(px+ox,py+oy,i%5===0?2:1,1);
        }
        if(!pond&&!plaza&&!roadV&&!roadH&&!roadSide&&!garden&&noise(x,y,23)>.91){
          g.fillStyle="#f2b9c5";g.fillRect(px+9,py+7,2,2);g.fillStyle="#f2f4bb";g.fillRect(px+8,py+8,2,2);
        }
        g.fillStyle="rgba(255,255,225,.12)";g.fillRect(px,py,T,1);
        g.fillStyle="rgba(30,63,39,.10)";g.fillRect(px,py+T-1,T,1);
      }
      g.strokeStyle="#c4e2a0";g.lineWidth=7;g.beginPath();g.ellipse(8*T+16,29*T+14,5*T,3.6*T,0,0,Math.PI*2);g.stroke();
      for(let i=0;i<16;i++){g.fillStyle="#a6e5e3";g.fillRect((4+(i*7)%9)*T,(27+(i*5)%5)*T,10,2);}
      this.textures.addCanvas(key,c)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.add.image(0,0,key).setOrigin(0).setDepth(0);
  }
  private drawStructures(){
    this.structure("sanctuary",31.5*T,15.5*T,390,270);
    this.structure("greenhouse",14*T,17.3*T,268,194);
    this.structure("workshop",49*T,17.2*T,270,196);
    this.structure("training",21*T,31*T,278,190);
    this.portal(45.5*T,30*T);this.market(35.5*T,18.4*T);
    this.solids.push(new Phaser.Geom.Rectangle(25*T,8*T,13*T,7*T),new Phaser.Geom.Rectangle(10*T,12*T,8*T,5*T),
      new Phaser.Geom.Rectangle(45*T,12*T,8*T,5*T),new Phaser.Geom.Rectangle(17*T,27*T,8*T,5*T),new Phaser.Geom.Rectangle(42*T,26*T,7*T,5*T));
    this.landmarks=[
      {id:"nursery",title:"Nhà Ươm Linh Thú",x:31.5*T,y:18.5*T,radius:110},
      {id:"shrine",title:"Điện Triệu Hồi",x:35.5*T,y:20.8*T,radius:92},
      {id:"training",title:"Xưởng Huấn Luyện",x:21*T,y:30.8*T,radius:110},
      {id:"shop",title:"Quầy Hành Trang",x:49*T,y:18.6*T,radius:100},
      {id:"challenge",title:"Cổng Thử Thách",x:45.5*T,y:30*T,radius:125},
      {id:"forest",title:"Thảo Nguyên Thì Thầm",x:55*T,y:23*T,radius:115},
    ];
  }
  private structure(type:string,x:number,bottom:number,w:number,h:number){
    const key="pb-structure-"+type;
    if(!this.textures.exists(key)){
      const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d")!;g.imageSmoothingEnabled=false;
      oval(g,w/2,h-8,w*.46,8,"rgba(20,34,25,.36)");
      const mid=w/2,top=h*.36,base=h-20;
      if(type==="sanctuary"){
        poly(g,[[14,top],[w-14,top],[w-23,base],[23,base]],"#a76545","#4c3537",5);
        poly(g,[[0,top],[mid,5],[w,top],[w-5,top+32],[mid,48],[5,top+32]],"#873d40","#362e38",5);
        poly(g,[[8,top+17],[mid,54],[w-8,top+17],[w-14,top+34],[mid,68],[14,top+34]],"#c66650","#633c3c",2);
        for(let i=0;i<8;i++){g.strokeStyle=i%2?"#81433f":"#e19b72";g.lineWidth=3;g.beginPath();g.moveTo(mid,58);g.lineTo(20+i*(w-40)/8,top+28);g.stroke();}
        g.fillStyle="#4a3037";g.fillRect(mid-39,base-77,78,78);g.fillStyle="#d09b66";g.fillRect(mid-33,base-71,66,66);
        g.fillStyle="#684039";g.fillRect(mid-3,base-71,6,66);
        poly(g,[[mid-42,base-72],[mid,base-101],[mid+42,base-72]],"#684238","#412f35",2);
        g.fillStyle="#f4dca8";g.fillRect(mid-47,top+4,94,15);g.fillStyle="#694635";g.font="bold 10px monospace";g.textAlign="center";g.fillText("WILD SANCTUM",mid,top+15);
        for(const xx of [26,w-45]){g.fillStyle="#473536";g.fillRect(xx,top+49,19,29);g.fillStyle="#ffe1a1";g.fillRect(xx+3,top+52,13,22);}
      }else if(type==="greenhouse"){
        poly(g,[[10,top],[mid,8],[w-10,top],[w-25,base],[25,base]],"#395f58","#2e4540",4);
        poly(g,[[18,top+9],[mid,20],[w-18,top+9],[w-31,base-4],[31,base-4]],"#93d3c5","#e6f2d4",3);
        for(let xx=25;xx<w-15;xx+=34){g.strokeStyle="#477b70";g.lineWidth=3;g.beginPath();g.moveTo(mid,23);g.lineTo(xx,base-4);g.stroke();}
        g.fillStyle="#31584b";g.fillRect(mid-25,base-59,50,58);g.fillStyle="#dff2d9";g.fillRect(mid-20,base-55,40,54);
        for(let i=0;i<8;i++){const xx=36+(i%4)*50,yy=base-32-Math.floor(i/4)*21;oval(g,xx,yy,7,5,i%2?"#db99b3":"#7dbb5f");g.fillStyle="#4c9451";g.fillRect(xx-1,yy+3,2,9);}
        g.fillStyle="#f2e2b6";g.fillRect(mid-37,top+16,74,14);g.fillStyle="#426c5e";g.font="bold 9px monospace";g.textAlign="center";g.fillText("SEED HOUSE",mid,top+26);
      }else if(type==="workshop"){
        poly(g,[[10,top+8],[w-10,top+8],[w-21,base],[21,base]],"#b9784d","#47383a",4);
        poly(g,[[0,top+5],[mid,0],[w,top+5],[w-4,top+30],[4,top+30]],"#586b68","#303b3f",4);
        for(let xx=17;xx<w-12;xx+=20){g.fillStyle="#794c3a";g.fillRect(xx,top+38,4,base-top-42);}
        for(const xx of [27,w-67]){g.fillStyle="#49383a";g.fillRect(xx,top+48,40,33);g.fillStyle="#8bc9c0";g.fillRect(xx+4,top+52,32,25);}
        g.fillStyle="#49363a";g.fillRect(mid-26,base-63,52,62);g.fillStyle="#a76540";g.fillRect(mid-21,base-59,42,58);
        g.fillStyle="#e5c18b";g.fillRect(mid-42,top+13,84,15);g.fillStyle="#513f35";g.font="bold 10px monospace";g.textAlign="center";g.fillText("ARTISAN HALL",mid,top+24);
        oval(g,mid,top+2,13,13,"#f7cf72");oval(g,mid,top+2,5,5,"#fff4c4");
      }else{
        poly(g,[[15,top+13],[w-15,top+13],[w-30,base],[30,base]],"#94724d","#4d4540",4);
        poly(g,[[0,top+14],[mid,0],[w,top+14],[w-10,top+35],[10,top+35]],"#476f72","#334144",4);
        g.fillStyle="#3d3439";g.fillRect(mid-28,base-65,56,64);g.fillStyle="#b68753";g.fillRect(mid-23,base-61,46,60);
        for(let i=0;i<6;i++){g.fillStyle="#d4b17a";g.fillRect(24+i*42,base-24,22,9);}
        g.fillStyle="#f2e4bc";g.fillRect(mid-48,top+17,96,14);g.fillStyle="#4d4b42";g.font="bold 10px monospace";g.textAlign="center";g.fillText("TRAINING GROUND",mid,top+27);
      }
      g.fillStyle="rgba(30,33,34,.22)";g.fillRect(0,base,w,8);g.fillStyle="rgba(255,235,190,.4)";g.fillRect(12,top+2,w-24,2);
      this.textures.addCanvas(key,c)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.add.image(x,bottom,key).setOrigin(.5,1).setDepth(bottom+2);
    if(type==="sanctuary")this.add.image(x,bottom-3,"pb-shadow").setOrigin(.5,1).setDisplaySize(w*.9,17).setDepth(bottom-1);
  }
  private portal(x:number,y:number){
    const halo=this.add.ellipse(x,y-30,102,130,0x815cc9,.24).setDepth(y-2);
    const outer=this.add.ellipse(x,y-34,76,112,0x9c7bdf,.16).setStrokeStyle(5,0xd9c6ff,.9).setDepth(y+1);
    this.add.ellipse(x,y-34,52,86,0x251b51,.92).setStrokeStyle(3,0xb8a0f1,.9).setDepth(y+2);
    this.tweens.add({targets:halo,scale:1.2,alpha:.1,duration:1600,yoyo:true,repeat:-1});
    this.tweens.add({targets:outer,angle:360,duration:16000,repeat:-1});
    for(let i=0;i<10;i++){const mote=this.add.circle(x+Phaser.Math.Between(-30,30),y-Phaser.Math.Between(0,65),2+i%3,0xe3d6ff,.9).setDepth(y+5);
      this.tweens.add({targets:mote,y:mote.y-45,alpha:0,duration:1300+i*50,repeat:-1,delay:i*110,onRepeat:()=>{mote.y=y-Phaser.Math.Between(0,65);mote.x=x+Phaser.Math.Between(-30,30);mote.alpha=.9;}});
    }
  }
  private market(x:number,y:number){
    this.add.ellipse(x,y+9,58,12,0x18251d,.28).setDepth(y-1);
    this.add.rectangle(x,y-18,108,45,0x8b5a3c).setStrokeStyle(3,0x4c3732).setDepth(y);
    this.add.rectangle(x,y-47,116,20,0xd7a45e).setStrokeStyle(3,0x533e36).setDepth(y+1);
    for(let i=0;i<5;i++)this.add.rectangle(x-46+i*23,y-47,11,18,i%2?0xf1e3bd:0xc55f52).setDepth(y+2);
    this.add.text(x,y-75,"TRAVELER'S SUPPLY",{fontFamily:"monospace",fontSize:"9px",color:"#f6e9c6",stroke:"#3d3531",strokeThickness:3}).setOrigin(.5).setDepth(y+5);
  }
  private drawTrees(){
    for(let y=3;y<H-3;y++)for(let x=3;x<W-3;x++){
      const edge=x<7||x>57||y<6||y>36,grove=((x-54)/7)**2+((y-23)/13)**2<1&&x>48,orchard=y>6&&y<13&&x>5&&x<18&&(x+y)%3===0;
      if(!(edge||grove||orchard)||noise(x,y,34)<.27)continue;
      const sx=x*T+16,sy=y*T+16,scale=grove?1.08:.82+noise(x,y,6)*.28;
      this.add.ellipse(sx,sy+23*scale,25*scale,9*scale,0x213a2c,.28).setDepth(sy+20);
      this.add.rectangle(sx,sy+7*scale,9*scale,27*scale,0x75533b).setStrokeStyle(2,0x49372e).setDepth(sy+14);
      this.add.ellipse(sx,sy-9*scale,25*scale,28*scale,grove?0x477a4d:0x4d8b52).setStrokeStyle(3,0x315b3e).setDepth(sy+6);
      this.add.ellipse(sx-8*scale,sy-17*scale,13*scale,15*scale,grove?0x6b9b5b:0x73b866).setDepth(sy+7);
      this.add.ellipse(sx+9*scale,sy-12*scale,12*scale,14*scale,grove?0x3c704a:0x3e7948).setDepth(sy+8);
      this.add.ellipse(sx-2*scale,sy-27*scale,9*scale,5*scale,0xa4d37a,.35).setDepth(sy+9);
      this.solids.push(new Phaser.Geom.Rectangle(sx-14*scale,sy+1*scale,28*scale,30*scale));
    }
  }
  private drawProps(){
    this.bench(25*T,25*T);this.bench(37*T,25*T);this.lantern(24*T,21*T);this.lantern(39*T,21*T);this.fence(16*T,34*T,10);
    this.crate(17*T,18*T);this.barrel(18.5*T,18*T);this.planter(44*T,18*T);this.crate(51*T,20*T);
    for(let i=0;i<30;i++){const x=Phaser.Math.Between(8,56)*T+Phaser.Math.Between(0,31),y=Phaser.Math.Between(8,34)*T+Phaser.Math.Between(0,31);
      if(y>17*T&&y<25*T&&x>17*T&&x<45*T)continue;
      const f=this.add.circle(x,y,2,[0xffe6a0,0xf3b6cf,0xd7d4ff][i%3],.9).setDepth(y+1);
      this.tweens.add({targets:f,scale:1.6,alpha:.4,duration:1300+i*11,yoyo:true,repeat:-1,delay:i*75});
    }
    for(let i=0;i<12;i++){const f=this.add.circle(Phaser.Math.Between(5,58)*T,Phaser.Math.Between(5,35)*T,2,0xeef2a4,.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(100+i);this.fireflies.push(f);}
  }
  private bench(x:number,y:number){this.add.ellipse(x,y+9,29,7,0x162a1d,.26).setDepth(y-1);this.add.rectangle(x,y,52,12,0x9b653d).setStrokeStyle(2,0x593e2d).setDepth(y);this.add.rectangle(x,y-10,50,8,0xc08b51).setStrokeStyle(2,0x68462e).setDepth(y+1);this.add.rectangle(x-18,y+14,5,13,0x67452f).setDepth(y-1);this.add.rectangle(x+18,y+14,5,13,0x67452f).setDepth(y-1);}
  private lantern(x:number,y:number){this.add.rectangle(x,y+14,5,31,0x574232).setDepth(y+1);const glow=this.add.circle(x,y-7,17,0xffd47b,.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(y+2);this.add.rectangle(x,y-7,15,20,0x704a36).setStrokeStyle(2,0x422d29).setDepth(y+3);this.add.rectangle(x,y-7,8,12,0xffd77e).setDepth(y+4);this.tweens.add({targets:glow,alpha:.24,scale:1.35,duration:1200,yoyo:true,repeat:-1});}
  private fence(x:number,y:number,n:number){for(let i=0;i<n;i++){const xx=x+i*24;this.add.rectangle(xx,y,22,7,0xb9844e).setStrokeStyle(1,0x62472e).setDepth(y);this.add.rectangle(xx,y-12,6,23,0x9b6a41).setStrokeStyle(1,0x62472e).setDepth(y+1);}}
  private crate(x:number,y:number){this.add.rectangle(x,y,24,20,0x9d673e).setStrokeStyle(2,0x573b2b).setDepth(y);this.add.rectangle(x,y,4,18,0xd2a05e).setDepth(y+1);this.add.rectangle(x,y-6,21,3,0x6c472f).setDepth(y+1);}
  private barrel(x:number,y:number){this.add.ellipse(x,y,15,8,0xb17a4d).setStrokeStyle(2,0x563b2e).setDepth(y);this.add.rectangle(x,y-6,29,13,0x9c663e).setStrokeStyle(2,0x53372b).setDepth(y+1);this.add.ellipse(x,y-12,14,6,0xc8955d).setStrokeStyle(2,0x53372b).setDepth(y+2);}
  private planter(x:number,y:number){this.add.rectangle(x,y,24,14,0xb76b4c).setStrokeStyle(2,0x593b35).setDepth(y+1);for(let i=-1;i<=1;i++)this.add.ellipse(x+i*7,y-12-Math.abs(i)*3,7,9,i===0?0x6ea957:0x8bc66a).setDepth(y+2);}
  private drawVillagers(){
    this.npc("Eira · Người chăm sóc",30.1*T,20.4*T,0x8bbf8a,"⌂");
    this.npc("Kian · Thợ rèn",47.3*T,20.1*T,0xd39b68,"⚒");
    this.npc("Mira · Nhà thám hiểm",41*T,28.5*T,0xb29bda,"✦");
    this.npc("Tomo · Người bán hàng",34*T,18.5*T,0xd4b56d,"$");
  }
  private npc(name:string,x:number,y:number,color:number,icon:string){
    this.add.ellipse(x,y+13,13,5,0x1e2c24,.35).setDepth(y-1);
    this.add.ellipse(x,y,10,13,color).setStrokeStyle(2,0x3e4140).setDepth(y);
    this.add.circle(x,y-14,9,0xf0cda5).setStrokeStyle(2,0x4b3b35).setDepth(y+1);
    this.add.ellipse(x,y-19,10,5,0x463b36).setDepth(y+2);
    this.add.text(x,y-43,name,{fontFamily:"monospace",fontSize:"9px",color:"#fff4d7",stroke:"#27362d",strokeThickness:3}).setOrigin(.5).setDepth(y+3);
    const badge=this.add.text(x+15,y-32,icon,{fontFamily:"monospace",fontSize:"12px",color:"#fff2b8",stroke:"#27362d",strokeThickness:3}).setOrigin(.5).setDepth(y+4);
    this.tweens.add({targets:badge,y:badge.y-3,duration:900,yoyo:true,repeat:-1});
    this.solids.push(new Phaser.Geom.Rectangle(x-12,y-8,24,23));
  }
  private makePlayerTexture(){
    if(this.textures.exists("pb-player"))return;
    const c=document.createElement("canvas");c.width=32;c.height=40;const g=c.getContext("2d")!;g.imageSmoothingEnabled=false;
    g.fillStyle="#263238";g.fillRect(9,5,14,5);g.fillRect(8,9,4,4);g.fillRect(20,9,4,4);
    g.fillStyle="#e6b991";g.fillRect(10,10,12,11);g.fillRect(8,14,3,5);g.fillRect(21,14,3,5);
    g.fillStyle="#473c34";g.fillRect(10,8,12,4);g.fillRect(9,9,14,3);
    g.fillStyle="#26323a";g.fillRect(12,14,2,2);g.fillRect(18,14,2,2);g.fillStyle="#fff";g.fillRect(12,14,1,1);g.fillRect(18,14,1,1);
    g.fillStyle="#d17a48";g.fillRect(12,19,8,2);g.fillStyle="#477c57";g.fillRect(7,21,18,12);g.fillStyle="#75a96a";g.fillRect(9,22,14,3);
    g.fillStyle="#d0a05f";g.fillRect(6,23,4,6);g.fillRect(22,23,4,6);g.fillStyle="#513a30";g.fillRect(10,32,5,6);g.fillRect(18,32,5,6);
    g.fillStyle="#b9895a";g.fillRect(9,37,7,2);g.fillRect(17,37,7,2);g.fillStyle="#b68b52";g.fillRect(22,25,4,7);
    this.textures.addCanvas("pb-player",c)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  private makeShadowTexture(){
    if(this.textures.exists("pb-shadow"))return;const c=document.createElement("canvas");c.width=64;c.height=24;const g=c.getContext("2d")!;oval(g,32,12,30,10,"rgba(17,31,22,.32)");this.textures.addCanvas("pb-shadow",c)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  private ambient(){for(const p of this.fireflies){p.x+=Math.sin(this.time.now/640+p.y)*.6;p.y+=Math.cos(this.time.now/710+p.x)*.45;p.setAlpha(.25+(.5+.5*Math.sin(this.time.now/430+p.x))*.55);}}
}
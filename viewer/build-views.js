// SPDX-License-Identifier: GPL-3.0-or-later
// Assembly pictures of one half, drawn from its installed parts: geometry, finishes and positions follow the design.
// A view gives the height in mm each part starts from; parts at 0 are already in place and the rest come down in
// order of height. `ring` marks small parts where they end up, `label` names a connector and `focus` frames a close-up.
// A view shows one key unless `keys` asks for all of them.
const views={
 'battery-stack':{parts:{base:0,locator:14,battery:26,cage:38,board:58},from:[.5,.64,1.2]},
 'board-screws':{parts:{base:0,board:0,'short-screw':20},ring:['short-screw'],from:[.45,1.15,1]},
 'plate-screws':{parts:{base:0,board:0,spacer:12,plate:26,'long-screw':42},ring:['long-screw'],from:[.5,.8,1.2]},
 'key-stack':{parts:{board:0,plate:0,switch:14,keycap:28},focus:['switch','keycap'],margin:9,from:[.5,.8,1.2]},
 'battery-port':{parts:{base:0,board:0,plate:0,switch:0,keycap:0,riser:0,controller:0,lead:0},keys:true,focus:['jst','slider','controller'],margin:6,label:{jst:'J1',slider:'SW1'},from:[.45,1.15,1]},
 'display-stack':{parts:{base:0,board:0,plate:0,switch:0,keycap:0,riser:0,controller:0,lead:0,sled:0,display:16,frame:36},keys:true,focus:['sled','display','frame'],margin:4,from:[.5,.7,1.2]},
 'base-feet':{parts:{base:0,foot:-16},ring:['foot'],from:[.45,-1.15,1]}
};
// A part card shows one printed part or the board alone.
const single={base:'base',frame:'frame',plate:'plate',keycap:'keycap',pcb:'board'};
// These are soldered by now and travel with the board.
const soldered=new Set(['diodes','socket','mcu-sockets','display-socket','jst','reset','slider']);
const frames=11;
// A view with nothing to bring down is a single picture.
export const viewMoves=id=>Object.values(views[id].parts).some(Boolean);

function slotOf(obj,side){
 const p=obj.userData,part=p.part_id?.slice(side.length+1);
 if(p.frame_style!==undefined)return 'frame';
 if(p.group==='keycaps')return 'keycap';
 if(p.group==='switches')return 'switch';
 if(p.group==='display')return 'display';   // the module and its screen
 if(obj.name.includes('Hot-swap '))return 'socket';
 if(obj.name.includes('Structural screw '))return /Structural screw [45]$/.test(obj.name)?'short-screw':'long-screw';
 if(obj.name.includes(' · Washer '))return 'spacer';
 if(obj.name.includes(' · Foot '))return 'foot';
 if(!part)return null;
 if(part.startsWith('battery-lead-'))return 'lead';
 return ({tray:'base','key-plate':'plate',pcb:'board',cradle:'locator','battery-retainer':'cage',mcu:'controller','mcu-riser':'riser','display-sled':'sled'})[part]||part;
}

export function createBuildViews({objects,preview,settled,design,restore}){
 let version,cache=new Map();
 // `motion` asks for the strip of a view that moves. Without it one picture is drawn: the parts apart.
 return async(id,side,motion=false)=>{
  await settled();if(version!==design()){version=design();cache.clear();}
  const view=views[id],strip=motion&&Boolean(view)&&viewMoves(id),key=side+'/'+id+(strip?'/strip':'');
  if(cache.has(key))return cache.get(key);
  const mine=[];
  for(const obj of objects){
   const p=obj.userData;if(p.side!==side||p.installed===false)continue;
   const slot=slotOf(obj,side);if(!slot)continue;
   if((slot==='keycap'||slot==='switch')&&!view?.keys&&!obj.name.endsWith(' K01'))continue;
   const mover=view&&!(slot in view.parts)&&soldered.has(slot)?'board':slot;
   const lift=view?view.parts[mover]:slot===single[id]?0:undefined;
   if(lift===undefined)continue;
   const material=Array.isArray(obj.material)?obj.material.map(m=>m.userData.plain||m):obj.material.userData.plain||obj.material;
   mine.push({slot,mover,lift,base:p.base,entry:{geometry:obj.geometry,material,rotation:obj.rotation.y*180/Math.PI}});
  }
  if(!mine.length)throw Error('Missing build view '+id+' '+side);
  preview.begin();
  try{
   let result;
   if(view){
    const order=[...new Set(mine.filter(m=>m.lift).map(m=>m.mover))].sort((a,b)=>Math.abs(view.parts[a])-Math.abs(view.parts[b]));
    const span=1/(1+(order.length-1)*.6);
    // 1 while a part waits above its place, easing to 0 as its turn comes.
    const raised=(mover,t)=>{
     const turn=order.indexOf(mover);if(turn<0)return 0;
     const u=Math.min(1,Math.max(0,(t-turn*.6*span)/span));return 1-u*u*(3-2*u);
    };
    const count=strip?frames:2;   // a single picture still needs both ends for its framing
    const poses=Array.from({length:count},(_,i)=>mine.map(m=>({...m.entry,
     position:[m.base[0],m.base[1]+m.lift*raised(m.mover,i/(count-1)),m.base[2]],
     focus:view.focus?.includes(m.slot),mark:view.label?.[m.slot]||view.ring?.includes(m.slot)})));
    result=preview.sequence(poses,[side==='left'?view.from[0]:-view.from[0],view.from[1],view.from[2]],{margin:view.margin,still:!strip});
   }else result={still:preview.image(mine.map(m=>({...m.entry,position:m.base})),[side==='left'?.45:-.45,1.5,1.2],{width:240,height:155})};
   cache.set(key,result);return result;
  }finally{preview.end();restore();}
 };
}

// SPDX-License-Identifier: GPL-3.0-or-later
// Use the installed meshes and materials, including size, fastener profile and frame selection.
export function createBuildViews({objects,preview,settled,design,restore}){
 let version,cache=new Map();
 return async(id,side)=>{
  await settled();if(version!==design()){version=design();cache.clear();}
  const key=side+'/'+id;if(cache.has(key))return cache.get(key);
  const entries=[];
  for(const obj of objects){
   const p=obj.userData;if(p.side!==side||p.installed===false)continue;
   const part=p.part_id?.slice(side.length+1),group=p.group;
   let slot=group;
   if(p.frame_style!==undefined)slot='frame';
   else if(part==='pcb')slot='pcb';
   else if(group==='pcb')continue;
   else if(group==='keycaps')slot='keycap';
   else if(part)slot=({cradle:'locator','battery-retainer':'cage',tray:'base','key-plate':'plate'})[part]||part;
   let lift=0;
   if(id==='battery-stack'){
    const rises={base:0,locator:13,battery:24,cage:35,pcb:55};
    if(!(slot in rises))continue;lift=rises[slot];
   }else if(id==='shell-stack'){
    const rises={base:0,pcb:12,plate:24,switches:31,keycap:40,display:32,frame:49};
    if(!(slot in rises))continue;lift=rises[slot];
   }else if(slot!==id||(slot==='keycap'&&p.ref!=='K01'))continue;
   const pos=[...p.base];pos[1]+=lift;
   entries.push({geometry:obj.geometry,material:obj.material.userData?.plain||obj.material,position:pos,rotation:obj.rotation.y*180/Math.PI});
  }
  if(!entries.length)throw Error('Missing build view '+id+' '+side);
  preview.begin();
  try{
   const sequence=id.endsWith('-stack'),url=preview.image(entries,[side==='left'?.45:-.45,sequence?.85:1.5,1.2],{width:sequence?540:240,height:sequence?365:155});
   cache.set(key,url);return url;
  }finally{preview.end();restore();}
 };
}

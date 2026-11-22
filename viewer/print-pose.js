// SPDX-License-Identifier: GPL-3.0-or-later
// Keep the assembly coordinate system inside each mesh. One proper rotation at
// the build item places all of its material volumes together on the print bed.
export function printPlacement(id,materials,inset=0){
 const minimum=[0,1,2].map(a=>Math.min(...materials.map(m=>m.minimum[a])));
 const size=minimum.map((v,a)=>Math.max(...materials.map(m=>m.maximum[a]))-v);
 const shift=minimum.map((v,a)=>(a===2?0:inset)-v);
 const [w,h,z]=size;
 let rotation=[1,0,0,0,1,0,0,0,1],offset=[0,0,0],footprint=size;
 if(id.includes('-frame-')||id.endsWith('-battery-retainer')){
  rotation=[1,0,0,0,-1,0,0,0,-1];offset=[0,h+2*inset,z];
 }else if(id.endsWith('-display-sled')){
  // Long rail against the bed. The rail and uprights grow in the same layer plane.
  rotation=[0,0,-1,0,1,0,1,0,0];offset=[inset,0,w+inset];footprint=[z,h,w];
 }
 return {shift,size:footprint,transform:(x=0,y=0)=>[...rotation,offset[0]+x,offset[1]+y,offset[2]]};
}

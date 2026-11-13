// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';

// Existing component models plus nominal drawings of loose supplies, rendered once.
// These illustrations identify parts; the catalog retains dimensions and references.
export function createPartIllustrations({preview,parts,material}){
 const images={},temporary=[],silver='#aeb8bd',dark='#293739',gold='#c89c43',red='#b44842';
 const entry=(geometry,color,position=[0,0,0])=>{temporary.push(geometry);return {geometry,material:material(color),position};};
 const box=(x,y,z,color,p)=>entry(new THREE.BoxGeometry(x,y,z),color,p);
 const cylinder=(radius,height,color,p)=>entry(new THREE.CylinderGeometry(radius,radius,height,40),color,p);
 const ring=(radius,tube,color,p)=>entry(new THREE.TorusGeometry(radius,tube,12,64).rotateX(Math.PI/2),color,p);
 const wire=(points,color,radius=.4)=>entry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),48,radius,8,false),color);
 const render=(id,entries,direction=[.55,1.8,1.2])=>{images[id]=preview.image(entries,direction,{width:240,height:180});};
 const models=predicate=>parts.filter(p=>p.side==='left'&&predicate(p)).map(p=>({path:p.geometry,material:p.materials?p.materials.map(material):material(p.color),position:p.position,rotation:p.angle_deg}));
 for(const [id,part] of Object.entries({nano:'mcu',view:'display',power:'slider',reset:'reset'}))render(id,models(p=>p.part_id==='left-'+part),id==='reset'?[.55,-1.8,1.2]:undefined);
 // Show the open header, rather than the assembly model's closed mated envelope.
 const ivory='#e8e3cf';render('jack',[box(7.6,.6,5.9,ivory,[0,0,0]),box(7.6,.6,5.9,ivory,[0,4.2,0]),box(7.6,4.2,.6,ivory,[0,2.1,-2.65]),
  ...[-3.5,3.5].map(x=>box(.6,4.2,5.9,ivory,[x,2.1,0])),...[-1,1].map(x=>box(.5,.5,4.8,silver,[x,1.6,.3]))],[.5,.8,1.7]);
 render('switch',models(p=>p.group==='switches'&&p.name.endsWith(' K01')));
 render('socket',models(p=>p.name==='left · Hot-swap K01'),[.3,-1.8,1.2]);
 render('diode',[box(2.7,1.2,1.6,dark),box(.35,1.22,1.62,'#e1dfcd',[-.9,0,0]),box(.7,.22,1,silver,[-1.55,-.4,0]),box(.7,.22,1,silver,[1.55,-.4,0])]);
 for(const [id,width,length] of [['adafruit-1570',12,26],['301230',12,30]]){
  render(id,[box(width,3,length,silver),box(width,3.1,3,gold,[0,0,-length/2+1.5]),box(width-2,.1,length-7,'#d8dedb',[0,1.55,2]),
   wire([[-2,0,-length/2],[-3,0,-length/2-5],[1,1,-length/2-8],[4,1,-length/2-7]],red),
   wire([[2,0,-length/2],[1,0,-length/2-4],[3,1,-length/2-6],[5,1,-length/2-7]],dark),box(4,3,3,'#eeeadd',[5,1,-length/2-8])]);
 }
 const strip=[box(3,2.8,30,dark)];
 for(let i=0;i<12;i++){strip.push(ring(.65,.2,gold,[0,1.5,i*2.54-14]),cylinder(.25,3,silver,[0,-2,i*2.54-14]));}render('strip',strip);
 render('pins',[-2,0,2].flatMap((x,i)=>[cylinder(.25,7,silver,[x,i*.4,0]),cylinder(.45,.8,gold,[x,1+i*.4,0])]));
 render('feet',[-1,1].flatMap(x=>[-1,1].map(z=>cylinder(6.35,1.6,dark,[x*7,0,z*7]))));
 render('cable',[wire([[-8,0,5],[-12,0,12],[-10,0,20],[0,0,22],[10,0,18],[8,0,12],[0,0,12],[-2,0,6],[6,0,0]],dark,.7),
  box(3,1.6,5,dark,[-8,0,2]),box(2.7,1.2,2,silver,[-8,0,-1]),box(3,1.6,5,dark,[6,0,-2]),box(2.7,1.2,2,silver,[6,0,-5])]);
 const roll=(color)=>[ring(9,3,color),ring(6.4,.6,'#d9ccb2'),box(9,.5,6,color,[10,0,6])];render('tape',roll('#b77b28'));
 for(const [id,length,radius,head] of [['m6',6,1.9,1.3],['m4',4,2,1.1],['m6-common',6,1.9,2],['m4-common',4,1.9,2]]){
  const screw=[cylinder(1,length,silver,[0,length/2,0]),cylinder(radius,head,silver,[0,length+head/2,0]),entry(new THREE.CylinderGeometry(.8,.8,.02,6),dark,[0,length+head+.02,0])];
  for(let y=.3;y<length;y+=.45)screw.push(ring(1,.09,'#77868e',[0,y,0]));render(id,screw,[1,1,1]);
 }
 for(const [id,height] of [['base-magnets',3],['frame-magnets',4]])render(id,[-2.5,0,2.5].map((x,i)=>cylinder(1,height,silver,[x,i*.5,0])),[.6,1,1.4]);
 render('solder-tools',[box(7,2,10,'#b79b57',[-6,0,0]),box(5,.1,6,dark,[-6,1.1,-1]),cylinder(1,1,dark,[-6,1.5,2]),
  cylinder(1.5,10,'#376e78',[4,4,2]),cylinder(.6,5,silver,[4,-3,2]),entry(new THREE.ConeGeometry(.6,3,20),silver,[4,-7,2]),
  wire([[4,9,2],[8,9,4],[10,2,5],[4,0,8]],dark,.35)]);
 render('print-tools',[ring(7,2.8,'#698d8b',[-6,0,0]),ring(7,3.2,dark,[-6,-1,0]),ring(7,3.2,dark,[-6,1,0]),
  box(.9,.9,16,silver,[7,0,0]),box(5,.9,.9,silver,[9,0,-7.5]),box(3,3,7,gold,[2,0,7]),box(.7,.7,10,silver,[2,0,-1])]);
 for(const geometry of temporary)geometry.dispose();
 return Object.freeze(images);
}

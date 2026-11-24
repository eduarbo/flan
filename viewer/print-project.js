// SPDX-License-Identifier: GPL-3.0-or-later
import {zipSync,strToU8} from 'three/addons/libs/fflate.module.js';
import {printSettings} from './printer-presets.js';
import {planPlates} from './plate-layout.js';
import {projectEntries,projectObject,projectSetup} from './project-objects.js';
import {readMaterials,meshObject,xml} from './print-geometry.js';

const meta=(key,value)=>`<metadata key="${key}" value="${xml(String(value))}"/>`;
const modelNS='http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const relType='http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel';

function bedTransform(object,x,y,turned){
 const pose=object.placement?.transform()||[1,0,0,0,1,0,0,0,1,0,0,0];
 if(turned)return [-pose[1],pose[0],pose[2],-pose[4],pose[3],pose[5],-pose[7],pose[6],pose[8],
  x+object.size[1]-pose[10],y+pose[9],pose[11]];
 pose[9]+=x;pose[10]+=y;return pose;
}

export async function combinedProject(parts,keycaps,title,config,progress){
 const setup=projectSetup(config),{bed}=setup;
 const entries=projectEntries(parts,keycaps?.plan.groups||[]);
 const spools=[],resources=[],settings=[],objects=[];
 let nextId=2;
 for(const [index,entry] of entries.entries()){
  const {part,family}=entry;
  progress(index+1,entries.length);await new Promise(requestAnimationFrame);
  const materials=readMaterials(family==='Keycaps'?{...part,stl:keycaps.stl[part.variant]}:part);
  const object=projectObject(entry,materials,spools,config),volumes=[];
  for(const [index,m] of materials.entries()){
   const slot=object.materialSlots[index],{color}=spools[slot],spool=spools[slot];
   const id=nextId++;
   resources.push(meshObject(m,object.placement.shift,id,part.id+' '+m.role,slot));
   volumes.push({id,slot,name:m.role+' '+color+(spool.series?' · '+spool.series+' '+spool.name:'')});
  }
  const id=nextId++;
  resources.push(`<object id="${id}" type="model" name="${xml(part.id)}"><components>${volumes.map(v=>`<component objectid="${v.id}"/>`).join('')}</components></object>`);
  const locator=family==='Bases'?meta('detect_thin_wall','1'):'';
  const support=family==='Keycaps'||part.id.endsWith('-display-sled')?meta('enable_support','1'):'';
  settings.push(`<object id="${id}">${meta('name',part.id)}${meta('extruder',volumes[0].slot+1)}${support}${locator}${volumes.map(v=>`<part id="${v.id}" subtype="normal_part">${meta('name',v.name)}${meta('extruder',v.slot+1)}</part>`).join('')}</object>`);
  objects.push({...object,id,volumes});
 }
 const {plates,towerX,towerY}=planPlates(objects,setup);
 const cols=Math.ceil(Math.sqrt(plates.length)),items=[],instances=new Map();
 for(const [i,plate] of plates.entries()){
  const members=[];
  for(const {object,turned,x,y} of plate.items){
   // Bambu Studio spaces plate origins by 120% of the nominal bed dimensions.
   const dx=x+i%cols*bed*1.2,dy=y-Math.floor(i/cols)*bed*1.2;
   if(object.members){
    const slot=object.slots[0],label='Keycaps · '+spools[slot].label;
    object.id=nextId++;
    const components=object.members.map(({object:key,x,y,turned})=>
     `<component objectid="${key.volumes[0].id}" transform="${bedTransform(key,x,y,turned).join(' ')}"/>`);
    resources.push(`<object id="${object.id}" type="model" name="${xml(label)}"><components>${components.join('')}</components></object>`);
    settings.push(`<object id="${object.id}">${meta('name',label)}${meta('extruder',slot+1)}${meta('enable_support',1)}</object>`);
   }
   const transform=bedTransform(object,dx,dy,turned);
   const copy=instances.get(object.id)||0;instances.set(object.id,copy+1);
   items.push(`<item objectid="${object.id}" transform="${transform.join(' ')}" printable="1"/>`);
   members.push(`<model_instance>${meta('object_id',object.id)}${meta('instance_id',copy)}${meta('identify_id',items.length)}</model_instance>`);
  }
  settings.push(`<plate>${meta('plater_id',i+1)}${meta('plater_name',plate.family)}${meta('locked','false')}${meta('print_sequence',plate.sequence)}${members.join('')}</plate>`);
 }
 const bases=spools.map(s=>`<base name="${xml(s.label)}" displaycolor="${s.color}FF"/>`).join('');
 const keyNote='Keycaps print finger surface up, with supports below. Check one stem for fit. / Teclas con la cara de los dedos arriba y soportes debajo. Prueba el ajuste de un vástago.';
 const description=parts.length?'Print the M2 sample first: on the tested printer the M2 screws cut their own thread in the printed Ø2.1 mm pilots. The display frame rests over the display. Imprime primero la muestra M2: en la impresora probada los tornillos M2 abren su propia rosca en los pilotos impresos de Ø2.1 mm. El marco queda apoyado sobre la pantalla.':keyNote;
 const model=`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="${modelNS}" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"><metadata name="Application">BambuStudio-02.00.00.00</metadata><metadata name="BambuStudio:3mfVersion">1</metadata><metadata name="Designer">Eduardo Ruiz · Flan; KLP Lamé keycaps by braindefender</metadata><metadata name="Title">${xml(title)}</metadata><metadata name="Description">${description}</metadata><metadata name="License">Flan GPL-3.0-or-later; KLP Lamé CC-BY-SA-4.0. See Metadata/Flan/.</metadata><resources><basematerials id="1">${bases}</basematerials>${resources.join('')}</resources><build>${items.join('')}</build></model>`;
 // Studio reads the Application signature to select its project importer. Designer and
 // Description identify Flan as the generator. These are layout defaults, not toolpaths.
 const projectSettings=printSettings(setup,spools);
 projectSettings.wipe_tower_x=plates.map(()=>String(towerX));
 projectSettings.wipe_tower_y=plates.map(()=>String(towerY));
 const files={
  '[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="application/octet-stream"/><Default Extension="txt" ContentType="text/plain"/><Default Extension="csv" ContentType="text/csv"/></Types>'),
  '_rels/.rels':strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="model" Type="${relType}"/></Relationships>`),
  '3D/3dmodel.model':strToU8(model),
  'Metadata/model_settings.config':strToU8('<config>'+settings.join('')+'</config>'),
  'Metadata/project_settings.config':strToU8(JSON.stringify(projectSettings))
 };
 for(const [file,notice] of Object.entries(__FLAN_PRINT_LICENSES__))files['Metadata/Flan/'+file.replace(/\.(md|txt)$/,'')+'.txt']=strToU8(notice);
 const spoolRows=['plate,plate_name,slot,filament,color'];
 for(const [index,plate] of plates.entries())for(const slot of plate.slots){
  const spool=spools[slot];spoolRows.push([index+1,plate.family,slot+1,spool.label,spool.color].join(','));
 }
 files['Metadata/Flan/Print-notes.txt']=strToU8(!parts.length?keyNote+'\n':
  'Bases: floor down. Switch plates: flat. Frames: decorated face on the bed, all colors registered. Battery cage: top down. Display sled: long side down. Keycaps: finger surface up, supports under the body. Check a single stem.\n'+
  'Bases: piso abajo. Placas: horizontales. Marcos: dibujo contra la cama. Jaula: techo abajo. Soporte de pantalla: costado largo abajo. Teclas: cara de los dedos arriba, con soporte bajo el cuerpo. Prueba un vástago.\n'+
  'On the printer this was tested with (Bambu Lab X2D, 0.4 mm nozzle, PLA) the M2 screws cut their own thread in the printed Ø2.1 mm pilots. Print the M2 sample first. If the screw will not start, clear the hole with a 2 mm drill or an M2 tap; if it turns without gripping, reprint the sample with −0.1 mm X-Y hole compensation. Drive them straight and stop when the head seats; do not overtighten. The display frame rests over the display, loose.\n'+
  'En la impresora con la que se probó (Bambu Lab X2D, boquilla de 0.4 mm, PLA) los tornillos M2 abren su propia rosca en los pilotos impresos de Ø2.1 mm. Imprime primero la muestra M2. Si el tornillo no entra, repasa el agujero con una broca de 2 mm o un machuelo M2; si gira sin agarrar, reimprime la muestra con −0.1 mm de compensación de agujeros X-Y. Atornilla recto y detente cuando la cabeza asiente; no aprietes de más. El marco queda apoyado sobre la pantalla, sin sujeción.\n');
 files['Metadata/Flan/Filaments.csv']=strToU8(spoolRows.join('\n')+'\n');
 if(keycaps){
  const header='side,key,file,color,rotation_deg,spool';
  const rows=keycaps.plan.keys.map(k=>[k.side,k.key,k.file,k.color,k.rotation_deg,k.spool||''].join(','));
  files['Metadata/Flan/Keycaps.csv']=strToU8([header,...rows].join('\n')+'\n');
 }
 const plan=plates.map((plate,i)=>({number:i+1,name:plate.family,sequence:plate.sequence,objects:plate.parts.length,
  filaments:[...plate.slots].map(slot=>({slot:slot+1,name:spools[slot].label,color:spools[slot].color}))}));
 return {bytes:zipSync(files,{level:4,mtime:new Date(2026,0,1)}),plates:plan};
}

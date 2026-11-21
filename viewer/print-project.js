// SPDX-License-Identifier: GPL-3.0-or-later
import {zipSync,strToU8} from 'three/addons/libs/fflate.module.js';
import {setupOf,spoolFor,spoolById} from './filament-swatches.js';
import {readMaterials,meshObject,xml} from './print-geometry.js';

const margin=8,frontMargin=32; // Leave the front-left calibration/exclusion area clear.
const meta=(key,value)=>`<metadata key="${key}" value="${xml(String(value))}"/>`;
const modelNS='http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const relType='http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel';

// Separate jobs by part type so the case can be printed without the keycaps.
function plateFamily(id){
 if(id.endsWith('-base'))return 'Bases';
 if(id.endsWith('-plate'))return 'Switch plates';
 if(id.includes('-frame-'))return 'Display frames';
 return 'Internal parts';
}
function placeOnPlates(objects,{mode,bed}){
 const gap=mode==='object'?82:6;
 const groups=new Map();
 for(const object of objects){
  if(!groups.has(object.family))groups.set(object.family,[]);
  groups.get(object.family).push(object);
 }
 const plates=[];
 for(const [family,group] of groups){
  let plate,x,y,rowHeight;
  function nextPlate(){
   plate={family,items:[],slots:new Set()};plates.push(plate);x=margin;y=frontMargin;rowHeight=0;
  }
  nextPlate();
  if(mode==='object')group.sort((a,b)=>a.slots[0]-b.slots[0]);
  for(const object of group){
   const [w,h]=object.size;
   if(w>bed-2*margin||h>bed-frontMargin-margin)throw Error('Part exceeds the layout area: '+object.name);
   for(let copy=0;copy<object.count;copy++){
    if(mode!=='manual'&&new Set([...plate.slots,...object.slots]).size>4)nextPlate();
    if(x+w>bed-margin){x=margin;y+=rowHeight+gap;rowHeight=0;}
    if(y+h>bed-margin)nextPlate();
    for(const slot of object.slots)plate.slots.add(slot);
    plate.items.push({object,copy,x,y});x+=w+gap;rowHeight=Math.max(rowHeight,h);
   }
  }
 }
 return plates;
}

export async function combinedProject(parts,keycaps,title,config,progress){
 const setup=setupOf(config),{mode,bed}=setup;
 const entries=parts.map(part=>({part,count:1,family:plateFamily(part.id)}));
 for(const group of keycaps?.plan.groups||[]){
  const stl=keycaps.stl[group.variant];
  if(!stl)throw Error('Missing keycap: '+group.file);
  entries.push({part:{spool:group.spool,id:group.label+' '+group.color,stl,colors:{body:group.color}},count:group.count,family:'Keycaps'});
 }
 const spools=[],resources=[],settings=[],objects=[];
 let nextId=2;
 for(const [index,{part,count,family}] of entries.entries()){
  progress(index+1,entries.length);await new Promise(requestAnimationFrame);
  const materials=readMaterials(part);
  const min=[0,1,2].map(a=>Math.min(...materials.map(m=>m.minimum[a])));
  const size=min.map((v,a)=>Math.max(...materials.map(m=>m.maximum[a]))-v);
  // All volumes in one physical object use the same local origin, including recessed artwork.
  const shift=min.map(v=>-v),volumes=[];
  for(const m of materials){
   const color=(part.colors[m.role]||part.colors.body).toUpperCase();
   const spool=spoolById(part.spool)||spoolFor(config,part.side,color);
   const key=spool?.id||color;
   let slot=spools.findIndex(s=>s.key===key);
   if(slot<0){slot=spools.length;spools.push({key,color,label:spool?spool.series+' · '+spool.name:color});}
   const id=nextId++;
   resources.push(meshObject(m,shift,id,part.id+' '+m.role,slot));
   volumes.push({id,slot,name:m.role+' '+color+(spool?' · '+spool.series+' '+spool.name:'')});
  }
  const id=nextId++;
  resources.push(`<object id="${id}" type="model" name="${xml(part.id)}"><components>${volumes.map(v=>`<component objectid="${v.id}"/>`).join('')}</components></object>`);
  const support=family==='Keycaps'||part.id.endsWith('-display-sled')?meta('enable_support','1'):'';
  settings.push(`<object id="${id}">${meta('name',part.id)}${meta('extruder',volumes[0].slot+1)}${support}${volumes.map(v=>`<part id="${v.id}" subtype="normal_part">${meta('name',v.name)}${meta('extruder',v.slot+1)}</part>`).join('')}</object>`);
  const slots=[...new Set(volumes.map(v=>v.slot))];
  const plateName=mode==='manual'?spools[slots[0]].label:family;
  objects.push({id,name:part.id,count,size,slots,family:plateName});
 }
 const colors=spools.map(s=>s.color),plates=placeOnPlates(objects,setup);
 if(plates.length>36)throw Error('Bambu Studio: 36 plates maximum. Export one half or use fewer colors. / Máximo 36 camas. Exporta una mitad o usa menos colores.');
 const cols=Math.ceil(Math.sqrt(plates.length)),items=[];
 for(const [i,plate] of plates.entries()){
  const members=[];
  for(const {object,copy,x,y} of plate.items){
   // Bambu Studio spaces plate origins by 120% of the nominal bed dimensions.
   const dx=x+i%cols*bed*1.2,dy=y-Math.floor(i/cols)*bed*1.2;
   items.push(`<item objectid="${object.id}" transform="1 0 0 0 1 0 0 0 1 ${dx} ${dy} 0" printable="1"/>`);
   members.push(`<model_instance>${meta('object_id',object.id)}${meta('instance_id',copy)}${meta('identify_id',items.length)}</model_instance>`);
  }
  settings.push(`<plate>${meta('plater_id',i+1)}${meta('plater_name',plate.family)}${meta('locked','false')}${meta('print_sequence',mode==='object'?'by object':'by layer')}${members.join('')}</plate>`);
 }
 const bases=spools.map(s=>`<base name="${xml(s.label)}" displaycolor="${s.color}FF"/>`).join('');
 const model=`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="${modelNS}" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"><metadata name="Application">BambuStudio-02.00.00.00</metadata><metadata name="BambuStudio:3mfVersion">1</metadata><metadata name="Designer">Eduardo Ruiz · Flan; KLP Lamé keycaps by braindefender</metadata><metadata name="Title">${xml(title)}</metadata><metadata name="Description">Generated by the Flan configurator. Select your printer and spools, check orientation and add magnet pauses before slicing.</metadata><metadata name="License">Flan GPL-3.0-or-later; KLP Lamé CC-BY-SA-4.0. See Metadata/Flan/.</metadata><resources><basematerials id="1">${bases}</basematerials>${resources.join('')}</resources><build>${items.join('')}</build></model>`;
 // Studio reads the Application signature to select its project importer. Designer and
 // Description identify Flan as the generator. These are layout defaults, not toolpaths.
 const projectSettings={
  version:'02.00.00.00',printer_technology:'FFF',printer_model:'',printer_settings_id:'',print_settings_id:'',
  printable_area:['0x0',bed+'x0',bed+'x'+bed,'0x'+bed],printable_height:String(Math.min(250,bed)),nozzle_diameter:['0.4'],
  filament_colour:colors,filament_settings_id:colors.map(()=>'Generic PLA'),filament_type:colors.map(()=>'PLA'),
  filament_diameter:colors.map(()=>'1.75'),filament_is_support:colors.map(()=>'0')
 };
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
 files['Metadata/Flan/Filaments.csv']=strToU8(spoolRows.join('\n')+'\n');
 if(keycaps){
  const header='side,key,file,color,rotation_deg';
  const rows=keycaps.plan.keys.map(k=>[k.side,k.key,k.file,k.color,k.rotation_deg].join(','));
  files['Metadata/Flan/Keycaps.csv']=strToU8([header,...rows].join('\n')+'\n');
 }
 const plan=plates.map((plate,i)=>({number:i+1,name:plate.family,objects:plate.items.length,
  filaments:[...plate.slots].map(slot=>({slot:slot+1,name:spools[slot].label,color:spools[slot].color}))}));
 return {bytes:zipSync(files,{level:4,mtime:new Date(2026,0,1)}),plates:plan};
}

// SPDX-License-Identifier: GPL-3.0-or-later
import {zipSync,strToU8} from 'three/addons/libs/fflate.module.js';
import {framePalette,finishes} from './finishes.js';
import {decode,xml,readMaterials,meshObject,printPlacement} from './print-geometry.js';
import {printerSuffix} from './printer-presets.js';
import {setupOf,spoolFor} from './filament-swatches.js';
import {combinedProject} from './print-project.js';
import {templateRef} from './config.js';
export {templateRef} from './config.js';
const utf8=x=>strToU8(typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');
export function selectedParts(config,registry,half='both',scope='shells'){
 const parts=[];for(const side of ['left','right']){if(half!=='both'&&side!==half)continue;const cs=config.cases[side],f=config.frames[side];for(const group of ['base','plate'])parts.push({...registry.assets[`${side}-case-${cs.style}-${group}`],side,colors:{body:cs[group+'_color']}});if(cs.cover)parts.push({...registry.assets[`${side}-frame-${f.style}`],side,style:f.style,colors:framePalette(f.style,f.color,f.accents)});
  if(scope==='complete'){for(const id of registry.supports)parts.push({...registry.assets[`${side}-${id}`],side,colors:{body:'#78908a'}});
   // a larger size's added fasteners copy H1 or H2, washer included: the same printed part once more
   for(const [h,f] of Object.entries(registry.fasteners?.[side]||{})){const from=`${side}-washer-${f.copy_of.slice(1)}`;if(registry.assets[from])parts.push({...registry.assets[from],id:`${side}-washer-${h.slice(1)}`,copy_of:from,side,colors:{body:'#78908a'}});}}}
 const solidFrames=setupOf(config).mode!=='ams';
 return parts.map(part=>{
  if((solidFrames||config.filaments?.[part.side])&&!part.id.includes('-case-')&&!part.id.includes('-frame-')){
   return {...part,colors:{body:config.cases[part.side].base_color}};
  }
  if(solidFrames&&part.id.includes('-frame-'))return {...part,style:undefined,material_parts:[],colors:{body:part.colors.body},solid_frame:true};
  return part;
 });
}
// A larger size's added key copies its template: the same row of column 1 for the outer column, the same
// column of row 0 for the number row, K01 for the corner (tools/freecad/build_variant_case.py).
// Every keycap of the design: which KLP Lamé file, which color, where. Groups print together.
export function keycapPlan(config,catalog,added=[],half='both'){
 const byId=new Map(catalog.variants.map(v=>[v.id,v])),keys=[],groups=new Map();
 for(const side of half==='both'?['left','right']:[half])for(const ref of [...catalog.layout[side].map(k=>k.ref),...added]){
  const from=config.keycaps[side][ref]?ref:templateRef(ref),c=config.keycaps[side][from],v=byId.get(c.variant),file=v.path.split('/').pop();
  const spool=spoolFor(config,side,c.color),assignment=spool?{spool:spool.id}:{};
  keys.push({side,key:ref,...assignment,...(from===ref?{}:{copies:from}),variant:c.variant,file,color:c.color.toLowerCase(),rotation_deg:c.rotation_deg});
  const id=file+'|'+c.color.toLowerCase()+'|'+(spool?.id||'');if(!groups.has(id))groups.set(id,{...assignment,variant:c.variant,label:v.label,file,color:c.color.toLowerCase(),count:0,keys:[]});
  const g=groups.get(id);g.count++;g.keys.push(`${side==='left'?'L':'R'} ${ref}`);
 }
 return {keys,groups:[...groups.values()].sort((a,b)=>b.count-a.count||a.file.localeCompare(b.file))};
}
// Count exactly the materials used by the selection. Unassigned design colors keep their own identity.
export function printSpoolUses(config,parts,keys=[]){
 const uses=new Map();
 function add(side,color,role){
  const hex=color.toUpperCase(),chosen=spoolFor(config,side,hex),id=chosen?.id||hex;
  if(!uses.has(id))uses.set(id,{hex,chosen,roles:new Set()});
  uses.get(id).roles.add(role);
 }
 for(const part of parts){
  if(part.id.includes('-frame-')){
   const materials=part.material_parts?.length?part.material_parts:[{role:'body'}];
   for(const {role} of materials)add(part.side,part.colors[role]||part.colors.body,role);
  }else{
   const role=part.id.endsWith('-base')?'base':part.id.endsWith('-plate')?'plate':'internals';
   add(part.side,part.colors.body,role);
  }
 }
 for(const key of keys)add(key.side,key.color,'keycaps');
 return [...uses.values()];
}
export function mesh3MF(part){
 const materials=readMaterials(part);
 const placement=printPlacement(part.id,materials,10),shift=placement.shift;
 const colors=finishes.roles.map(role=>part.colors[role]||part.colors.body);
 const objects=materials.map(p=>meshObject(p,shift,p.object_id,part.id+'-'+p.role,p.roleIndex)).join('');
 const assemblyId=materials.length+2,assembly=`<object id="${assemblyId}" type="model" name="${xml(part.id)}"><components>${materials.map(p=>`<component objectid="${p.object_id}"/>`).join('')}</components></object>`;
 const model=`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Application">Flan36</metadata><metadata name="Title">${xml(part.id)}</metadata><metadata name="Description">Native material volumes registered as one co-print assembly. Prototype geometry; verify process before slicing.</metadata><resources><basematerials id="1">${colors.map((c,i)=>`<base name="${finishes.roles[i]}" displaycolor="${c.toUpperCase()}FF"/>`).join('')}</basematerials>${objects}${assembly}</resources><build><item objectid="${assemblyId}" transform="${placement.transform().join(' ')}"/></build></model>`;
 const settings=`<?xml version="1.0"?><config><object id="${assemblyId}"><metadata key="name" value="${xml(part.id)}"/>${part.id.endsWith('-base')?'<metadata key="detect_thin_wall" value="1"/>':''}${materials.map(p=>`<part id="${p.object_id}" subtype="normal_part"><metadata key="name" value="${xml(p.role)}"/><metadata key="extruder" value="${p.roleIndex+1}"/></part>`).join('')}</object></config>`;
 const files={'[Content_Types].xml':utf8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="application/xml"/></Types>'),'_rels/.rels':utf8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),'3D/3dmodel.model':utf8(model),'Metadata/model_settings.config':utf8(settings)};
 const material_parts=materials.map(p=>({role:p.role,object_id:p.object_id,source:p.print_path||p.path,source_sha256:p.sha256,color:colors[p.roleIndex],triangles:p.triangles.length}));
 return {bytes:zipSync(files,{level:6}),translation_mm:shift,build_transform:placement.transform(),triangles:materials.reduce((n,p)=>n+p.triangles.length,0),material_parts,
  role_triangles:finishes.roles.map((role,i)=>({role,count:materials.filter(p=>p.role===role).reduce((n,p)=>n+p.triangles.length,0),color:colors[i]}))};
}
export async function printKit(config,registry,{half='both',scope='shells',keycaps=null,title='Flan36',projectOnly=false,progress=()=>{}}={}){
 const selected=selectedParts(config,registry,half,scope),files={},records=[];
 const setup=setupOf(config),suffix=setup.mode==='ams'?'':'-'+setup.mode;
 const projectName=title+'-'+half+'-'+scope+suffix+printerSuffix(setup)+'.3mf';
 const project=await combinedProject(selected,keycaps,projectName,config,progress);
 if(projectOnly)return {...project,filename:projectName};
 files[projectName]=project.bytes;
 for(const [name,text] of Object.entries(__FLAN_PRINT_LICENSES__))files[name]=utf8(text);
 for(const [i,p] of selected.entries()){progress(i+1,selected.length);await new Promise(requestAnimationFrame);const colored=mesh3MF(p);files[`STL/${p.id}.stl`]=decode(p.stl);files[`3MF/${p.id}.3mf`]=colored.bytes;for(const m of p.material_parts||[])files[`Materials/${p.id}/${m.role}.stl`]=decode(m.stl);records.push({id:p.id,side:p.side,quantity:1,source:p.print_path||p.path,source_sha256:p.sha256,colors:p.colors,translation_3mf_mm:colored.translation_mm,build_transform:colored.build_transform,triangles:colored.triangles,role_triangles:colored.role_triangles,material_parts:colored.material_parts});}
 // keycaps: one exact upstream STL per file the design uses, and the plan of which key gets which file and color
 let caps=null;
 if(keycaps){
  const bundled=[],missing=[];
  for(const g of keycaps.plan.groups){const stl=keycaps.stl[g.variant];if(stl){files[`Keycaps/${g.file}`]=stl;if(!bundled.includes(g.file))bundled.push(g.file);}else if(!missing.includes(g.file))missing.push(g.file);}
  files['Keycaps/plan.csv']=utf8('side,key,copies,file,color,rotation_deg\n'+keycaps.plan.keys.map(k=>[k.side,k.key,k.copies||'',k.file,k.color,k.rotation_deg].join(',')).join('\n')+'\n');
  caps={source:'KLP Lamé by braindefender, unchanged meshes, pinned 4a67a824232d3054c61599ea047c56a340faaba2: https://github.com/braindefender/KLP-Lame-Keycaps',
   license:'CC-BY-SA-4.0, https://creativecommons.org/licenses/by-sa/4.0/',groups:keycaps.plan.groups,bundled,missing,
   missing_from:missing.length?'https://github.com/eduarbo/flan/tree/main/keycaps/variants':undefined};
 }
 const washers=selected.filter(p=>/-washer-\d+$/.test(p.id)).length;
 const manifest={project:projectName,print_setup:setup,plates:project.plates,schema:2,revision:'I',units:'mm',status:'Prototype geometry; physical fit and joining untested',half,scope,parts:records,...(caps?{keycaps:caps}:{}),configuration:config,joining:registry.joining,source:'https://github.com/eduarbo/flan',license:'GPL-3.0-or-later',
  excludes:`Commercial electronics, cells, hardware and feet${caps?'':' and KLP keycaps'}. View visibility and exploded offsets do not affect this kit.`};
 files['manifest.json']=utf8(manifest);files[`${title}-config.json`]=utf8(config);files['READ-ME.txt']=utf8(`${title.toUpperCase()} / PRINT KIT / mm\n\nOpen / Abre: ${projectName}\nOne project for this selection. Open as a project in Bambu Studio. Confirm the printer, nozzle and spools before slicing.\nUn proyecto con la selección. Ábrelo como proyecto en Bambu Studio. Confirma impresora, boquilla y bobinas antes de laminar.\n${setup.printer?'Bambu Lab '+setup.printer+' · '+setup.nozzle+' mm. ':''}Mode / Modo: ${setup.mode}. Bed / Cama: ${setup.bed} × ${setup.bed} mm.\n${setup.mode==='ams'?'AMS: up to four colors per plate.':'Frames use a single fused mesh in their body color / Marcos lisos en el color del cuerpo.'}\n\nIndividual alternatives / Alternativas por pieza\nSTL: print geometry in assembly coordinates, with open glue-in magnet sockets.\n3MF: exact native material volumes as one registered assembly. One rigid placement orients the whole part on the bed. All inlays stay registered.\nFrames print face down. Glue magnets after printing.\nMaterials/: native role STLs in assembly coordinates for manual multipart import.\nOne file per physical part. No printer profile, G-code or verified print process.\n\nJOINING\n${registry.joining.case}.\n${registry.joining.installed_frame}.\n\nPOLARITY\n${registry.joining.polarity}\n\nGLUE AFTER PRINTING / PEGA DESPUÉS DE IMPRIMIR\n${registry.joining.capture}\nPrueba en seco: tres imanes Ø2 × 3 mm por base desde arriba; tres Ø2 × 4 mm por marco desde abajo. Un mismo polo visible en todas las bases y el opuesto en los marcos. Pega antes de montar la electrónica y deja curar las piezas separadas.\nA single-station coupon checks bond and attraction; test a complete\nframe for north-edge peel, sliding and repeated removal.\n${registry.joining.acceptance}.\nNo clips are modeled.${washers?` This kit includes ${washers} washer${washers>1?'s':''}.`:''}\n\nIn AMS multicolor mode, decorated frames contain closed body/detail/accent/secondary material volumes.\nThese are co-printed regions, not separate fitted inserts. Import each 3MF as one\nassembly. For manual STL import, import all Materials/ files for a frame together\nas parts of one object and preserve their relative positions. The STL/ frame is\na complete single-color fallback.\n\nAdd filaments in body/detail/accent/secondary order using manifest HEX colors.\nVerify each material assignment and every sliced layer. Automatic slicer palette\nimport and printer-specific process settings are not qualified. Choose your actual\nfilaments and process before slicing.\n${caps?`\nKEYCAPS\nKeycaps/ holds each KLP Lamé file the design uses, once; print it as many times as\nlisted. Keycaps/plan.csv says which key gets which file and color (copies: a larger\nsize's added key repeats that key's choice). Print orientation, stems and tolerances:\nhttps://github.com/braindefender/KLP-Lame-Keycaps\n${caps.groups.map(g=>`${String(g.count).padStart(3)} × ${g.file}  ${g.color.toUpperCase()}  ${g.keys.join(' ')}`).join('\n')}\n${caps.missing.length?`Not in this kit (offline copy or a file outside the presets): ${caps.missing.join(', ')}.\nDownload them from ${caps.missing_from}\n`:''}KLP Lamé by braindefender, CC-BY-SA-4.0 (https://creativecommons.org/licenses/by-sa/4.0/).\n`:''}\nhttps://github.com/eduarbo/flan/blob/main/docs/build.md\nFlan cases and frames by Eduardo Ruiz. Key positions derived from Piantor by beekeeb.\nGPL-3.0-or-later. See LICENSE and ATTRIBUTION.md in this kit.\nSource credits and references: https://github.com/eduarbo/flan/blob/main/ATTRIBUTION.md\n`);
 return {bytes:zipSync(files,{level:6}),manifest};
}

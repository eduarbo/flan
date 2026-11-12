// Build a complete Flan36 print kit from the checked optional native variant.
// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>i%2?a:[...a,[v.slice(2),all[i+1]]],[]));
for(const key of ['configuration','candidate','output'])if(!args[key])throw Error('Required: --configuration file --candidate directory --output ZIP');
const candidate=path.resolve(args.candidate),output=path.resolve(args.output);
const read=p=>JSON.parse(fs.readFileSync(p)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const installation=read(path.join(candidate,'installation.json')),service=read(path.join(candidate,'service.json'));
const spec=read(path.join(root,'design/common-fasteners.json'));
if(!installation.passed||!service.passed||service.candidate_sha256!==installation.output_sha256)throw Error('Native qualification missing');
if(hash(fs.readFileSync(path.join(root,'design/common-fasteners.json')))!==installation.recipe.spec_sha256)throw Error('Recipe changed after qualification');
const native=path.join(candidate,'Flan36-common-screws.FCStd');
if(hash(fs.readFileSync(native))!==service.output_sha256)throw Error('Configured native file changed');
const scene=read(path.join(root,'build/viewer-scene.json')),configuration=read(path.resolve(args.configuration));
if(configuration.variant!=='flan36')throw Error('This optional variant is qualified only for Flan36');
const module=path.join(candidate,'printing.cjs');
require(path.join(root,'viewer/node_modules/esbuild')).buildSync({stdin:{contents:"export {printKit,keycapPlan,selectedParts} from './printing.js'; export {check} from './config.js';",resolveDir:path.join(root,'viewer')},bundle:true,platform:'node',format:'cjs',outfile:module});
const {printKit,keycapPlan,selectedParts,check}=require(module);
if(check(configuration,scene.catalog).errors.length)throw Error('Configuration failed the existing design checks');
const registry=scene.printing;
const exported=Object.assign({},...Object.values(installation.halves).map(h=>h.exports));
for(const asset of selectedParts(configuration,registry,'both','complete')){
  const target=registry.assets[asset.id];
  for(const part of [target,...(target.material_parts||[])]){
    const stem=path.basename(part.path,'.stl');
    if(exported[stem]){
      const file=path.join(candidate,stem+'.stl'),bytes=fs.readFileSync(file);
      if(hash(bytes)!==exported[stem].stl_sha256)throw Error('Changed candidate export: '+stem);
      part.path=path.relative(root,file);part.sha256=hash(bytes);part.stl=bytes.toString('base64');
    }else{
      const original=fs.readFileSync(path.join(root,part.path));
      if(hash(original)!==part.sha256||!original.equals(Buffer.from(part.stl,'base64')))throw Error('Stale baseline asset: '+part.path);
    }
  }
  if((asset.id.includes('-case-')&&asset.id.endsWith('-plate')||asset.id.includes('-frame-'))&&!exported[asset.id])throw Error('Missing modified printable: '+asset.id);
}
registry.joining.case='Common-M2 variant: 3 M2x6 + 2 M2x4 machine screws per half, pitch 0.4 mm; head diameter <=4 mm and height <=2 mm. Tap the unchanged 1.7 mm pilots to M2. Use the 1.5 mm Allen key specified for the selected DIN 912 screws. No countersunk or self-tapping screws';
registry.joining.profile=spec;
global.requestAnimationFrame=fn=>setImmediate(fn);
const plan=keycapPlan(configuration,scene.catalog,[],'both');
const stl=Object.fromEntries([...new Set(plan.groups.map(g=>g.variant))].map(id=>[id,new Uint8Array(fs.readFileSync(path.join(root,scene.catalog.variants.find(v=>v.id===id).path)))]));
const result=await printKit(configuration,registry,{half:'both',scope:'complete',keycaps:{plan,stl},title:'Flan36-common-M2'});
if(result.manifest.parts.length!==20||plan.keys.length!==36||result.manifest.keycaps.missing.length)throw Error('Incomplete configured kit');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,result.bytes);
fs.writeFileSync(output+'.json',JSON.stringify({schema:'flan-common-fastener-kit-1',physical_acceptance:false,configuration,recipe_sha256:installation.recipe.spec_sha256,native_sha256:service.output_sha256,kit_sha256:hash(result.bytes),parts:20,keycaps:36},null,2)+'\n');
console.log('Prepared complete kit: 20 parts and 36 keycaps; '+output);

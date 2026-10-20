// Shared malformed-input and migration contract; no CAD or browser writes.
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'build/reliability-fix');fs.mkdirSync(out,{recursive:true});
require('esbuild').buildSync({stdin:{contents:"export * from './config.js';export * from './storage.js';export * from './history.js';export {validatePaletteFile} from './keycap-colors.js';",resolveDir:__dirname},bundle:true,platform:'node',format:'cjs',outfile:path.join(out,'contract.cjs')});
const api=require(path.join(out,'contract.cjs')),catalog=JSON.parse(fs.readFileSync(path.join(root,'keycaps/catalog.json'))),base=api.normalize(catalog.default_configuration,catalog),clone=structuredClone;
// A wider outer edge fits the base layout but overlaps only the added pinky key.
const capCatalog=clone(catalog),control=clone(capCatalog.variants.find(v=>v.id===base.keycaps.left.K01.variant));
control.id='added-position-negative-control';control.hull_xy_mm=control.hull_xy_mm.map(([x,y])=>[x<0?x-5:x,y]);capCatalog.variants.push(control);
const capConfig=clone(base);capConfig.keycaps.left.K01.variant=control.id;
assert.equal(api.check(capConfig,capCatalog).errors.length,0,'control fits the original 36 positions');
capConfig.variant='flan42';assert(api.check(capConfig,capCatalog).errors.some(e=>/K00.*K01|K01.*K00/.test(e)),'added-key-only collision must be rejected');
const negative=spawnSync('python3',['-c',"import sys,json;sys.path.insert(0,'tools');from keycap_config import check;d=json.load(sys.stdin);assert any('K00' in e and 'K01' in e for e in check(d['config'],d['catalog'])[0]);d['config']['variant']='flan36';assert not check(d['config'],d['catalog'])[0]"],{cwd:root,input:JSON.stringify({config:capConfig,catalog:capCatalog}),encoding:'utf8'});assert.equal(negative.status,0,negative.stderr);
let familyPresets=0;
for(const file of ['default','normal-sculpted','saddle-sculpted'])for(const variant of ['flan36','flan42','flan46','flan54']){
 const c=JSON.parse(fs.readFileSync(path.join(root,`design/configurations/${file}.json`)));c.variant=variant;
 assert.deepEqual(api.check(c,catalog).errors,[],`${variant}/${file}`);familyPresets++;
}
const fixtures=[null,[],true,5,'hello',{},base];const legacy=clone(base);delete legacy.cases;fixtures.push(legacy);
for(const style of Object.keys(catalog.retired_frame_styles)){const old=clone(base);old.frames.left.style=style;old.frames.right.style=style;fixtures.push(old);}
for(const id of Object.keys(JSON.parse(fs.readFileSync(path.join(root,'design/variants.json'))).variants)){const v=clone(base);v.variant=id;fixtures.push(v);}
const locations=`keycaps
frames
batteries
cases
keycaps.left
keycaps.left.K01
frames.right
frames.right.style
batteries.left
keycaps.left.K01.variant
keycaps.left.K01.rotation_deg
cases.left
frames.right.accents
pcb_edition
pcb_mask
variant`.split('\n');
for(const location of locations)for(const value of [null,[],{},true,0,'constructor','__proto__','toString']){const c=clone(base),parts=location.split('.'),last=parts.pop();let target=c;for(const k of parts)target=target[k];target[last]=value;fixtures.push(c);}
const js=fixtures.map(c=>{const errors=api.check(c,catalog).errors;return {valid:!errors.length,normalized:errors.length?null:api.normalize(c,catalog)};});
const py=spawnSync('python3',['-c',"import sys,json;sys.path.insert(0,'tools');from keycap_config import check,normalize;xs=json.load(sys.stdin);print(json.dumps([{'valid':not check(x)[0],'normalized':normalize(x) if not check(x)[0] else None} for x in xs]))"],{cwd:root,input:JSON.stringify(fixtures),encoding:'utf8',maxBuffer:5e6});assert.equal(py.status,0,py.stderr);assert.deepEqual(js,JSON.parse(py.stdout));assert.equal(js[7].normalized.cases.left.style,'solid');assert.equal(js[7].normalized.cases.right.cover,true);
const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};let chain=Promise.resolve();const locks={request:(_key,_options,callback)=>{const p=chain.then(callback);chain=p.catch(()=>{});return p;}};
const store=()=>api.createStore({key:api.savedKey,storage:()=>storage,locks:()=>locks,preserveBeforeWrite:c=>api.retiredFrames(c,catalog).length>0,validate:c=>{const e=api.check(c,catalog).errors;if(e.length)throw Error(e[0]);return api.normalize(c,catalog);}});
(async()=>{
 const old=clone(base);old.frames.left.style='handheld';old.frames.right.style='bevel';old.keycaps.left.K30.color='#123456';const oldRaw=JSON.stringify(old);values.set(api.savedKey,oldRaw);const restored=api.restoreConfiguration(storage,catalog);assert.equal(restored.configuration.frames.left.style,'flan');assert.equal(restored.configuration.keycaps.left.K30.color,'#123456');assert.match(restored.message,/Retired/);assert.equal(values.get(api.savedKey),oldRaw);await store().save(restored.configuration);assert.ok([...values.values()].some(v=>{try{return JSON.parse(v).raw===oldRaw;}catch{return false;}}),'Original retired-frame bytes preserved before normalized autosave');values.clear();
 const raw='{"revision":"H","privateCustom":"keep exact bytes"}';values.set(api.savedKey,raw);assert.equal(api.restoreConfiguration(storage,catalog).configuration,null);assert.equal(values.get(api.savedKey),raw);await store().save(base);assert.equal(values.get(api.savedKey),raw);assert.ok([...values.keys()].some(k=>k.startsWith(api.recoveryPrefix)));
 values.clear();const a=store(),b=store(),ca=clone(base),cb=clone(base);ca.keycaps.left.K01.color='#123456';cb.keycaps.left.K01.color='#abcdef';const pa=a.save(ca),pb=b.save(cb);assert.ok([...values.values()].some(v=>{try{return JSON.parse(v).raw===JSON.stringify(cb);}catch{return false;}}),'Latest edit survives before the lock callback');await Promise.all([pa,pb]);assert.deepEqual(JSON.parse(values.get(api.savedKey)),ca);assert.ok([...values.values()].some(v=>{try{return JSON.parse(v).raw===JSON.stringify(cb);}catch{return false;}}));await b.replace(cb);assert.deepEqual(JSON.parse(values.get(api.savedKey)),cb);assert.ok([...values.values()].some(v=>{try{return JSON.parse(v).raw===JSON.stringify(ca);}catch{return false;}}));
 const limited=api.createStore({key:api.savedKey,storage:()=>storage,locks:()=>null,validate:x=>x});await limited.save(ca);assert.deepEqual(JSON.parse(values.get(api.savedKey)),cb);
 const throwing=api.createStore({key:api.savedKey,storage:()=>({getItem:()=>raw,setItem:()=>{throw Error('quota')}}),locks:()=>locks,validate:()=>{throw Error('bad')}});assert.equal(await throwing.save(ca),false);await assert.rejects(throwing.replace(ca));
 const h=api.createHistory(base,2);h.record(ca,'paint');h.record(cb,'paint');assert.deepEqual(h.undo(),base);assert.deepEqual(h.redo(),cb);h.record(ca);assert.equal(h.canRedo,false);const before=h.peekUndo();h.record(ca);assert.deepEqual(h.peekUndo(),before);
 for(const value of [null,{}, {schema:'flan36-keycap-palettes-1',palettes:[null]}])assert.throws(()=>api.validatePaletteFile(value,catalog));
 const report={fixture_count:fixtures.length,js_python_exact_parity:true,family_presets:familyPresets,added_key_collision_rejected_in_js_and_python:true,fixed_legacy_solid:true,rejected_raw_preserved:true,serialized_concurrent_saves:true,recovery_before_replace:true,lock_and_quota_fallback:true,history_coalescing:true};fs.writeFileSync(path.join(out,'contract.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
})().catch(e=>{console.error(e);process.exitCode=1;});

// SPDX-License-Identifier: GPL-3.0-or-later
// The scene's meshes arrive in files, one per option (viewer/build.mjs): what a design shows is fetched
// before it is drawn, the rest when an option needs it. Positions and triangles are the scene's own bytes;
// normals come from 16-bit octahedral vectors.
import * as THREE from 'three';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
import {verifiedBytes,gunzip} from './assets.js';
import {t} from './i18n.js';

export function createGeometryStore({index,chunks,aliases={},embedded={}}){
  const meshes=new Map(),loads=new Map(),canonical=id=>aliases[id]||id;let fetching=0;
  function geometry(m,blob){
    const piece=([at,length])=>blob.subarray(at,at+length);
    const positions=new Float32Array(m.v*3);MeshoptDecoder.decodeVertexBuffer(new Uint8Array(positions.buffer),m.v,12,piece(m.p));
    const oct=new Int16Array(m.v*4),normals=new Float32Array(m.v*3);MeshoptDecoder.decodeVertexBuffer(new Uint8Array(oct.buffer),m.v,8,piece(m.n),'OCTAHEDRAL');
    for(let i=0;i<m.v;i++){const x=oct[i*4],y=oct[i*4+1],z=oct[i*4+2],scale=1/(Math.hypot(x,y,z)||1);normals[i*3]=x*scale;normals[i*3+1]=y*scale;normals[i*3+2]=z*scale;}
    const indices=m.s===2?new Uint16Array(m.i):new Uint32Array(m.i);MeshoptDecoder.decodeIndexSequence(new Uint8Array(indices.buffer),m.i,m.s,piece(m.x));
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('normal',new THREE.BufferAttribute(normals,3));g.setIndex(new THREE.BufferAttribute(indices,1));
    for(const [start,count,material] of m.g||[])g.addGroup(start,count,material);
    g.computeBoundingBox();return g;
  }
  // one fetch per file, shared by everyone who waits for it; a failed one can be asked for again
  function file(name,arrived){
    if(!loads.has(name)){fetching++;loads.set(name,(async()=>{
      const data=await gunzip(await verifiedBytes(chunks[name],embedded[name],'geometry',arrived));
      await MeshoptDecoder.ready;
      const n=new DataView(data.buffer,data.byteOffset).getUint32(0,true),header=JSON.parse(new TextDecoder().decode(data.subarray(4,4+n))),blob=data.subarray(4+n);
      if(header.schema!=='flan-geometry-1')throw Error(t('load.geometry.mismatch'));
      for(const [id,m] of Object.entries(header.meshes))meshes.set(id,geometry(m,blob));
    })().then(()=>{fetching--;},error=>{fetching--;loads.delete(name);throw error;}));}
    return loads.get(name);
  }
  const filesOf=ids=>[...new Set(ids.map(canonical).filter(id=>!meshes.has(id)).map(id=>{if(!index[id])throw Error(t('msg.geometry',{id}));return index[id];}))];
  return {
    has:id=>meshes.has(canonical(id)),
    known:id=>Boolean(index[canonical(id)]),
    get:id=>meshes.get(canonical(id)),
    set:(id,g)=>{meshes.set(id,g);},
    // bytes still to fetch for these meshes: files not asked for yet
    bytes:ids=>filesOf(ids).filter(name=>!loads.has(name)).reduce((n,name)=>n+chunks[name].bytes,0),
    ensure(ids,arrived){let names;try{names=filesOf(ids);}catch(error){return Promise.reject(error);}return Promise.all(names.map(name=>file(name,arrived)));},
    core:arrived=>file('core',arrived),coreBytes:chunks.core.bytes,
    busy:()=>fetching>0,
  };
}

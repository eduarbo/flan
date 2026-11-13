// The home page's creased normals (viewer/home/creased.js) against three's toCreasedNormals(), on every mesh of
// every published pack: positions, normals and material groups must be equal bit for bit. No browser needed.
// node viewer/home-normals-check.mjs
// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
import {creasedNormals} from './home/creased.js';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),ANGLE=Math.PI/4;
const receipt=JSON.parse(fs.readFileSync(path.join(root,'validation/revI-home.json'),'utf8'));
await MeshoptDecoder.ready;
const same=(a,b)=>a.length===b.length&&Buffer.compare(Buffer.from(a.buffer,a.byteOffset,a.byteLength),Buffer.from(b.buffer,b.byteOffset,b.byteLength))===0;
let meshes=0,corners=0,ours=0,theirs=0;
for(const [name,pack] of Object.entries(receipt.packs)){
  const bytes=gunzipSync(fs.readFileSync(path.join(root,pack.path))),length=bytes.readUInt32LE(0);
  const header=JSON.parse(bytes.subarray(4,4+length).toString()),blob=bytes.subarray(4+length);
  for(const [id,m] of Object.entries(header.meshes)){
    // decoded as viewer/home/model.js does
    const vb=new Uint8Array(m.v*8),ib=new Uint8Array(m.i*m.s);
    MeshoptDecoder.decodeVertexBuffer(vb,m.v,8,blob.subarray(m.vb[0],m.vb[0]+m.vb[1]));
    MeshoptDecoder.decodeIndexBuffer(ib,m.i,m.s,blob.subarray(m.ib[0],m.ib[0]+m.ib[1]));
    const q=new Uint16Array(vb.buffer),p=new Float32Array(m.v*3);
    for(let i=0;i<m.v;i++)for(let a=0;a<3;a++)p[i*3+a]=m.b[a]+q[i*4+a]/65535*(m.b[a+3]-m.b[a]);
    const index=m.s===2?new Uint16Array(ib.buffer):new Uint32Array(ib.buffer);
    let t=performance.now();const made=creasedNormals(p,index,ANGLE);ours+=performance.now()-t;
    assert(made,`${name} ${id}: outside the creasing grid`);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setIndex(new THREE.BufferAttribute(index,1));
    for(const [start,count,material] of m.g||[])g.addGroup(start,count,material);
    t=performance.now();const reference=toCreasedNormals(g,ANGLE);theirs+=performance.now()-t;
    assert(!reference.index,`${name} ${id}: three's result is indexed`);
    assert(same(made.position,reference.attributes.position.array),`${name} ${id}: positions differ`);
    assert(same(made.normal,reference.attributes.normal.array),`${name} ${id}: normals differ`);
    assert.deepEqual(reference.groups.map(x=>[x.start,x.count,x.materialIndex]),m.g||[],`${name} ${id}: groups differ`);
    meshes++;corners+=index.length;
  }
}
assert(meshes>0,'no meshes were read');
console.log(JSON.stringify({packs:Object.keys(receipt.packs).length,meshes,corners,ms:{creased:Math.round(ours),three:Math.round(theirs)}}));
console.log('home normals ok');

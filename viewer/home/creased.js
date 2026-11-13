// SPDX-License-Identifier: GPL-3.0-or-later
// Creased normals for an indexed triangle mesh: what three's toCreasedNormals() (BufferGeometryUtils, r180) gives its
// non-indexed copy, by the same arithmetic in the same order, so the values are equal bit for bit
// (viewer/home-normals-check.mjs compares every published mesh). Locations are keyed by a number instead of a string
// and normals stay in typed arrays, which is several times faster where it counts: on a phone, when the model is
// prepared and whenever a case, a size or a frame is chosen.
// three's 0.01 grid; SPAN bounds a cell's coordinates so that three of them make one exact number
const CELL=(1+1e-10)*1e2,SPAN=65536,RADIX=2*SPAN;

// positions: Float32Array, three per vertex. indices: three per triangle. Returns one position and one normal per
// triangle corner, or null when a vertex lies outside the grid this key can hold (655 mm from the origin).
export function creasedNormals(positions,indices,creaseAngle){
  const corners=indices.length,faces=corners/3,creaseDot=Math.cos(creaseAngle);
  const position=new Float32Array(corners*3);
  for(let i=0;i<corners;i++){const v=indices[i]*3;position[i*3]=positions[v];position[i*3+1]=positions[v+1];position[i*3+2]=positions[v+2];}
  // each face's normal as three computes it: (c - b) x (a - b), times 1 / its length
  const face=new Float64Array(faces*3);
  for(let f=0;f<faces;f++){
    const o=f*9,ax=position[o],ay=position[o+1],az=position[o+2],bx=position[o+3],by=position[o+4],bz=position[o+5],cx=position[o+6],cy=position[o+7],cz=position[o+8];
    const ux=cx-bx,uy=cy-by,uz=cz-bz,vx=ax-bx,vy=ay-by,vz=az-bz;
    const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,k=1/(Math.sqrt(x*x+y*y+z*z)||1);
    face[f*3]=x*k;face[f*3+1]=y*k;face[f*3+2]=z*k;
  }
  // corners that share a location: the same grid cell
  const group=new Int32Array(corners),ids=new Map();
  for(let i=0;i<corners;i++){
    const x=~~(position[i*3]*CELL),y=~~(position[i*3+1]*CELL),z=~~(position[i*3+2]*CELL);
    if(x<=-SPAN||x>=SPAN||y<=-SPAN||y>=SPAN||z<=-SPAN||z>=SPAN)return null;
    const key=((x+SPAN)*RADIX+(y+SPAN))*RADIX+(z+SPAN);let id=ids.get(key);
    if(id===undefined){id=ids.size;ids.set(key,id);}
    group[i]=id;
  }
  // each location's faces, in face order: the order three adds them in
  const start=new Int32Array(ids.size+1);
  for(let i=0;i<corners;i++)start[group[i]+1]++;
  for(let g=0;g<ids.size;g++)start[g+1]+=start[g];
  const members=new Int32Array(corners),next=start.slice(0,ids.size);
  for(let i=0;i<corners;i++)members[next[group[i]]++]=(i/3)|0;
  // a corner's normal: the sum of its location's face normals within the crease angle of its own face's, normalized
  const normal=new Float32Array(corners*3);
  for(let i=0;i<corners;i++){
    const f=((i/3)|0)*3,nx=face[f],ny=face[f+1],nz=face[f+2],g=group[i];let x=0,y=0,z=0;
    for(let m=start[g],end=start[g+1];m<end;m++){
      const o=members[m]*3;
      if(nx*face[o]+ny*face[o+1]+nz*face[o+2]>creaseDot){x+=face[o];y+=face[o+1];z+=face[o+2];}
    }
    const k=1/(Math.sqrt(x*x+y*y+z*z)||1);
    normal[i*3]=x*k;normal[i*3+1]=y*k;normal[i*3+2]=z*k;
  }
  return {position,normal};
}

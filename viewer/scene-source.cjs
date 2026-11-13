// The scene's own meshes, before viewer/build.mjs packs them into the explorer's files: the checks compare what
// the explorer shows and exports with these, byte for byte. Reads build/viewer-scene.json (from
// tools/build_viewer_revI.py) and refuses one the built page was not made from.
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('fs'),path=require('path');
module.exports=function sourceGeometries(built){
  const source=JSON.parse(fs.readFileSync(path.join(__dirname,'../build/viewer-scene.json'),'utf8'));
  if(JSON.stringify(source.sources)!==JSON.stringify(built.sources))throw Error('build/viewer-scene.json is not the scene this page was built from.');
  return source.geometries;
};

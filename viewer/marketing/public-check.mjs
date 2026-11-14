// SPDX-License-Identifier: GPL-3.0-or-later
// Read back the published effect. No cache purge or external write.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),base=process.argv[2]||'https://flankbd.com/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function get(rel,ua){const r=await fetch(new URL(rel,base),{headers:{'user-agent':ua||'Flan-marketing-verification/1.0','cache-control':'no-cache'},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,rel);return {bytes:Buffer.from(await r.arrayBuffer()),type:r.headers.get('content-type'),url:r.url};}
const files=['index.html','explore/index.html','marketing/index.html','marketing/flan-launch-kit.zip','marketing/flan-cover-variants.zip',...fs.readdirSync(path.join(root,'docs/marketing/variants')).filter(f=>f.endsWith('.png')).map(f=>'marketing/variants/'+f),...fs.readdirSync(path.join(root,'docs/marketing/assets')).map(f=>'marketing/assets/'+f)];
const verified=[];
for(let i=0;i<files.length;i+=4)await Promise.all(files.slice(i,i+4).map(async file=>{const r=await get(file);const local=fs.readFileSync(path.join(root,'docs',file));assert.equal(sha(r.bytes),sha(local),`published bytes differ: ${file}`);verified.push({file,sha256:sha(r.bytes),bytes:r.bytes.length,content_type:r.type});}));
const agents=['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)','Twitterbot/1.0','LinkedInBot/1.0'];
const previews=[];
for(const ua of agents)for(const rel of ['','explore/']){
 const page=await get(rel,ua),html=page.bytes.toString(),og=html.match(/property="og:image" content="([^"]+)"/)[1],twitter=html.match(/name="twitter:image" content="([^"]+)"/)[1];assert.equal(og,twitter);
 const image=await get(og,ua);assert.match(image.type,/image\/png/);assert.equal(image.bytes.readUInt32BE(16),1200);assert.equal(image.bytes.readUInt32BE(20),630);assert.equal(sha(image.bytes),sha(fs.readFileSync(path.join(root,'docs/assets/home-og.png'))));
 previews.push({agent:ua.split('/')[0],page:new URL(rel,base).href,image:og,status:200,width:1200,height:630});
}
const result={schema_version:1,checked_at:new Date().toISOString(),base,files:verified.sort((a,b)=>a.file.localeCompare(b.file)),previews,limit:'HTTP crawler responses verified; no third-party cached card or social post is claimed.'};
fs.writeFileSync(path.join(root,'validation/marketing-public.json'),JSON.stringify(result,null,2)+'\n');console.log(`PASS: ${files.length} published files match local bytes; home and explorer share cards accessible to all three social crawler user agents.`);

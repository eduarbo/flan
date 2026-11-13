// What crawlers, link previews and language models read about Flan must exist, parse and agree with the data.
// Reads the built pages and the static files in docs/. No browser needed: node viewer/site-meta-check.mjs
// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),json=p=>JSON.parse(read(p));
const themes=json('design/themes.json').themes,family=json('design/variants.json').variants,frames=json('design/frame-selection.json').selected;
const tag=(html,attr,name)=>{const m=html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));assert(m,`missing ${name}`);return m[1];};
function page(file,url){
 const html=read(file),head=html.slice(0,html.indexOf('</head>'));
 assert.match(head,/<title>[^<]{10,70}<\/title>/,file+': title');
 const description=tag(head,'name','description');assert(description.length>=70&&description.length<=200,file+': description length '+description.length);
 assert(head.includes(`<link rel="canonical" href="${url}">`),file+': canonical');assert.match(tag(head,'name','robots'),/^index, follow/);
 for(const name of ['og:site_name','og:title','og:description','og:image:alt'])assert(tag(head,'property',name).length>5,file+': '+name);
 assert.equal(tag(head,'property','og:url'),url);assert.equal(tag(head,'property','og:type'),'website');
 assert.equal(tag(head,'property','og:image:width'),'1200');assert.equal(tag(head,'property','og:image:height'),'630');
 assert.equal(tag(head,'name','twitter:card'),'summary_large_image');
 for(const name of ['twitter:title','twitter:description'])assert(tag(head,'name',name).length>5,file+': '+name);
 const image=tag(head,'property','og:image');assert.equal(tag(head,'name','twitter:image'),image);assert.match(image,/^https:\/\/flankbd\.com\/assets\/home-og\.png(\?v=[0-9a-f]{12})?$/);
 for(const m of head.matchAll(/content="([^"]*)"/g))assert(!/\b\d+ (themes|temas)\b/.test(m[1])||m[1].includes(`${themes.length} themes`),file+': stale theme count in '+m[1]);
 return {head,description};
}
const home=page('docs/index.html','https://flankbd.com/');page('docs/explore/index.html','https://flankbd.com/explore/');
assert(home.description.includes(`${themes.length} themes`),'the home description states the theme count');
// the share image is the size its tags claim
const png=fs.readFileSync(new URL('docs/assets/home-og.png',root));assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
// structured data parses and says what Flan is without offering it for sale
const ld=JSON.parse(home.head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]),nodes=ld['@graph'],types=nodes.map(n=>n['@type']);
for(const type of ['WebSite','Person','CreativeWork','SoftwareSourceCode'])assert(types.includes(type),'structured data: '+type);
assert(!JSON.stringify(ld).includes('"offers"'),'nothing is for sale');
const work=nodes.find(n=>n['@type']==='CreativeWork');assert.match(work.creativeWorkStatus,/prototype/i);assert(JSON.stringify(work).includes(`${themes.length} colour themes`));
// crawler files
const robots=read('docs/robots.txt');assert.match(robots,/^Sitemap: https:\/\/flankbd\.com\/sitemap\.xml$/m);assert(!/^Disallow: \/\s*$/m.test(robots),'the site is not closed to crawlers');
const locs=[...read('docs/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);assert(locs.length>=2);
for(const loc of locs){assert(loc.startsWith('https://flankbd.com/'),loc);const rel=loc.slice('https://flankbd.com/'.length),file='docs/'+(rel===''||rel.endsWith('/')?rel+'index.html':rel);assert(fs.existsSync(new URL(file,root)),'sitemap entry without a file: '+loc);}
// the summaries for language models: present, well formed, and consistent with the data
const sizes=Object.values(family).map(v=>({title:v.title,keys:v.keys_per_half*2}));
for(const file of ['docs/llms.txt','docs/llms-full.txt']){
 const text=read(file);assert.match(text,/^# Flan Keyboard/,file+': title');assert.match(text,/^> .{80,}/m,file+': summary');
 assert(text.includes(`${themes.length} `),file+': theme count');for(const s of sizes){assert(text.includes(s.title),file+': '+s.title);assert(text.includes(String(s.keys)),file+': '+s.keys+' keys');}
 assert.match(text,/prototype/i,file+': says it is a prototype');assert.match(text,/no board has been built and tested/i,file+': says it is untested');assert.match(text,/GPL-3\.0-or-later/);
 assert(!/\b(best|ideal|perfect|recommended?)\b/i.test(text.replace(/reference/gi,'')),file+': describes, does not sell');
 for(const m of text.matchAll(/\]\(([^)]+)\)|(https?:\/\/\S+)/g)){const url=(m[1]||m[2]).replace(/[.,;]$/,'');assert.match(url,/^https:\/\/(flankbd\.com|github\.com\/eduarbo\/flan|ko-fi\.com\/eduarbo)(\/|$)/,file+': unexpected link '+url);
  const doc=url.match(/^https:\/\/github\.com\/eduarbo\/flan\/blob\/main\/(.+)$/);if(doc)assert(fs.existsSync(new URL(doc[1],root)),file+': link to a missing file '+doc[1]);}
}
assert(frames.length===6&&read('docs/llms.txt').includes('six interchangeable magnetic display frames'));
console.log(`PASS: home and explorer metadata, a 1200 x 630 share image, structured data, robots.txt, ${locs.length} sitemap entries and two summaries that agree with ${themes.length} themes and ${sizes.length} sizes`);

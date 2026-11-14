// SPDX-License-Identifier: GPL-3.0-or-later
// Compose campaign artwork from real explorer captures; no synthetic product photography.
// From the repository root: FLAN36_PLAYWRIGHT_MODULE=/path/to/playwright node viewer/marketing/build.cjs
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'docs/marketing/assets'),work=path.join(root,'build/marketing');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'content.json')));
const uri=(file,type)=>`data:${type};base64,${fs.readFileSync(path.join(root,file)).toString('base64')}`;
const font=(name,file)=>`@font-face{font-family:${name};src:url(${uri('viewer/home/fonts/'+file,'font/woff2')});font-weight:100 900}`;
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const mark=uri('docs/branding/flan/flan-mark-color.svg','image/svg+xml');
const captures=JSON.parse(fs.readFileSync(path.join(work,'captures.json')));
const renderBytes=Object.fromEntries(captures.map(c=>{
 const bytes=fs.readFileSync(path.join(work,c.name+'.png'));
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==c.sha256||c.keys.left+c.keys.right!==Number(c.size.slice(4)))throw Error('Unverified capture: '+c.name);
 return [c.name,bytes];
}));
const renders=Object.fromEntries(Object.entries(renderBytes).map(([k,b])=>[k,'data:image/png;base64,'+b.toString('base64')]));
const css=`${font('Fraunces','Fraunces-latin.woff2')}${font('Inter','Inter-latin.woff2')}${font('Mono','JetBrainsMono-latin.woff2')}
*{box-sizing:border-box}html,body{margin:0}body{background:#211e2b;color:#fff5dc;font-family:Inter,sans-serif}.art{position:relative;width:100vw;height:100vh;overflow:hidden;background:radial-gradient(ellipse at 52% 58%,#65504355,transparent 57%),#211e2b}.brand{position:absolute;top:55px;left:64px;display:flex;align-items:center;gap:16px;font:42px Fraunces}.brand img{width:55px;height:50px}.brand small{font:17px Mono;color:#d8c9ba}.label{position:absolute;top:175px;left:64px;font:19px Mono;letter-spacing:.12em;color:#ebbb71}h1{position:absolute;top:220px;left:60px;right:55px;margin:0;font:300 90px/.99 Fraunces;letter-spacing:-.035em;white-space:pre-line}.product{position:absolute;top:395px;left:-60px;width:1200px;height:750px;object-fit:contain}.body{position:absolute;top:1015px;left:64px;right:70px;margin:0;font:31px/1.45 Inter;color:#e4d7c4;max-width:910px}.foot{position:absolute;left:64px;right:64px;bottom:64px;display:flex;justify-content:space-between;gap:28px;align-items:end;border-top:1px solid #ffffff30;padding-top:24px;font:19px Mono}.foot .status{color:#c6b9aa;font-size:16px}.count{position:absolute;right:64px;top:65px;font:20px Mono;color:#c6b9aa}.family{position:absolute;left:30px;right:30px;top:455px;display:grid;grid-template-columns:1fr 1fr;gap:0 0}.family figure{margin:0;position:relative;height:270px}.family img{width:100%;height:100%;object-fit:contain}.family figcaption{position:absolute;bottom:0;left:0;right:0;text-align:center;font:24px Mono;color:#ebbb71}
.wide .brand{top:35px;left:48px;font-size:30px;gap:12px}.wide .brand img{width:40px;height:36px}.wide .brand small{font-size:13px}.wide .label{top:114px;left:48px;font-size:14px}.wide h1{top:146px;left:43px;font-size:68px;line-height:1.05}.wide .product{top:140px;left:250px;width:940px;height:580px}.wide .body{top:255px;left:48px;width:305px;font-size:22px;line-height:1.5}.wide .foot{left:48px;right:48px;bottom:32px;padding-top:18px;font-size:16px}.wide .foot .status{font-size:13px}
.square .label{top:160px}.square h1{top:207px;font-size:90px}.square .product{top:260px}.square .body{top:818px;font-size:28px}.square .foot{bottom:42px}
.story .brand{top:220px}.story .label{top:350px}.story h1{top:405px;font-size:100px}.story .product{top:620px}.story .body{top:1305px;font-size:36px;line-height:1.4}.story .foot{bottom:250px}.story .count{top:230px}.story .family{top:730px;gap:40px 0}.story .family figure{height:280px}
.light{background:radial-gradient(ellipse at 50% 65%,#edc38555,transparent 60%),#f5ead5;color:#302635}.light .label,.light .family figcaption{color:#875938}.light .body{color:#5f5260}.light .foot{border-color:#30263540}.light .brand small,.light .count,.light .foot .status{color:#655a62}
.avatar{display:grid;place-items:center;background:#f5ead5}.avatar img{width:65%;height:65%}
`;
function artwork(lang,slide,{shape='',count='',light=false}={}){
 const l=data[lang];const visual=slide.image==='family'?`<div class="family">${['hero','flan42','flan46','flan54'].map((k,i)=>`<figure><img src="${renders[k]}"><figcaption>${[36,42,46,54][i]} ${lang==='en'?'keys':'teclas'}</figcaption></figure>`).join('')}</div>`:`<img class="product" src="${renders[slide.image]}">`;
 return `<html lang="${lang}"><style>${css}</style><div class="art ${shape} ${light?'light':''}"><div class="brand"><img src="${mark}"><span>flan <small>keyboard</small></span></div><div class="count">${count}</div><div class="label">${esc(slide.label)}</div><h1>${esc(slide.title)}</h1>${visual}<p class="body">${esc(slide.body)}</p><div class="foot"><span>flankbd.com ↗</span><span class="status"></span></div></div></html>`;
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});fs.mkdirSync(work,{recursive:true});
 const browser=await chromium.launch({headless:true});const p=await browser.newPage({deviceScaleFactor:1});const written=[];
 async function shot(file,html,w,h){await p.setViewportSize({width:w,height:h});await p.setContent(html);await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});await p.screenshot({path:file});if(file.startsWith(out))written.push(path.relative(root,file));}
 try{
  for(const lang of ['en','es']){
   const l=data[lang];
   for(const [i,slide] of l.slides.entries()){
    await shot(path.join(out,`carousel-${lang}-${i+1}.png`),artwork(lang,slide,{count:`0${i+1} / 06`,light:i%2===1}),1080,1350);
    await shot(path.join(work,`video-${lang}-${i+1}.png`),artwork(lang,slide,{shape:'story',count:`0${i+1} / 06`,light:i%2===1}),1080,1920);
   }
   const hero={title:l.headline,body:l.sub,image:'hero',label:l.eyebrow};
   await shot(path.join(out,`share-${lang}.png`),artwork(lang,hero,{shape:'wide'}),1200,630);
   await shot(path.join(out,`square-${lang}.png`),artwork(lang,hero,{shape:'square'}),1080,1080);
   await shot(path.join(out,`story-${lang}.png`),artwork(lang,{...l.slides[0],body:l.ordered+' '+l.cta+'.'},{shape:'story'}),1080,1920);
   await shot(path.join(out,`youtube-${lang}.png`),artwork(lang,{...hero,title:lang==='en'?'My first Flan.':'Mi primer Flan.',body:l.ordered},{shape:'wide'}),1280,720);
   // A 30-second silent teaser from the CAD renders. It is not a live typing demo.
   const srt=l.slides.map((s,i)=>`${i+1}\n00:00:${String(i*5).padStart(2,'0')},000 --> 00:00:${String((i+1)*5).padStart(2,'0')},000\n${s.title.replaceAll('\n',' ')} ${s.body}\n`).join('\n');
   fs.writeFileSync(path.join(out,`teaser-${lang}.srt`),srt);written.push(`docs/marketing/assets/teaser-${lang}.srt`);
   execFileSync('ffmpeg',['-y','-loglevel','error','-framerate','1/5','-start_number','1','-i',path.join(work,`video-${lang}-%d.png`),'-vf','fps=30,format=yuv420p','-c:v','libx264','-preset','medium','-crf','20','-movflags','+faststart','-t','30',path.join(out,`teaser-${lang}.mp4`)]);
   written.push(`docs/marketing/assets/teaser-${lang}.mp4`);
  }
  await shot(path.join(out,'avatar.png'),`<style>${css}</style><div class="art avatar"><img src="${mark}"></div>`,800,800);
 }finally{await browser.close();}
 for(const name of Object.keys(renders)){const dest=path.join(out,`render-${name}.png`);fs.writeFileSync(dest,renderBytes[name]);written.push(path.relative(root,dest));}
 fs.copyFileSync(path.join(out,'share-en.png'),path.join(root,'viewer/home/home-og.png'));
 const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
 const sourceFiles=['viewer/marketing/content.json','viewer/marketing/capture.cjs','viewer/marketing/build.cjs','viewer/app.js','viewer/appearance.js','viewer/explorer.js','design/themes.json','build/viewer-scene.json'];
 fs.writeFileSync(path.join(root,'validation/marketing-assets.json'),JSON.stringify({schema_version:1,stage:'Parts ordered; first physical build pending',method:'Real explorer CAD renders, browser typography and FFmpeg. No generated product photos or claimed hardware test.',captures,sources:sourceFiles.map(file=>({file,sha256:hash(file)})),assets:written.map(file=>({file,sha256:hash(file),bytes:fs.statSync(path.join(root,file)).size}))},null,2)+'\n');
 console.log(`Built ${written.length} marketing assets and the social card.`);
})().catch(e=>{console.error(e);process.exitCode=1});

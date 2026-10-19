// Renders the explorer R1 mockups to design/proposals/explorer-r1/*.png. Run capture.cjs first.
// FLAN36_PLAYWRIGHT_MODULE=… FLAN36_BROWSER=… node design/proposals/explorer-r1/src/render.cjs
const fs=require('fs'),path=require('path'),http=require('http');const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../../..'),types={'.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));
  if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
const pages=[['a-design','explorer.html?mode=design&theme=snes',1440,900],['b-advanced','explorer.html?mode=advanced&theme=snes',1440,900],
  ['c-parts','explorer.html?mode=parts&theme=phone',1440,900],['d-files','explorer.html?mode=files&theme=snes',1440,900],['e-phone','phone.html',390,844]];
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({executablePath:process.env.FLAN36_BROWSER});const errs=[];
for(const [name,url,w,h] of pages){
  if(process.env.ONLY&&!process.env.ONLY.split(',').includes(name))continue;
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:w<500?3:1.5});p.on('pageerror',e=>errs.push(name+': '+e.message));p.on('requestfailed',r=>errs.push(name+': '+r.url()));
  await p.goto(`http://127.0.0.1:${server.address().port}/design/proposals/explorer-r1/src/${url}`);await p.waitForSelector('body[data-ready]');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
  await p.screenshot({path:path.join(root,'design/proposals/explorer-r1',name+'.png')});await p.close();}
console.log(JSON.stringify({errs}));await b.close();server.close();})();

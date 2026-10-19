// Renders the review sheet to design/proposals/logo-color-r1/sheet.png. Run color_marks.py first.
// FLAN36_PLAYWRIGHT_MODULE=… FLAN36_BROWSER=… node design/proposals/logo-color-r1/src/render.cjs
const fs=require('fs'),path=require('path'),http=require('http');const {chromium}=require(process.env.FLAN36_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../../..'),types={'.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));
  if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({executablePath:process.env.FLAN36_BROWSER});
const p=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('requestfailed',r=>errs.push(r.url()));
await p.goto(`http://127.0.0.1:${server.address().port}/design/proposals/logo-color-r1/src/sheet.html`);await p.waitForSelector('body[data-ready]');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);
await p.screenshot({path:path.join(root,'design/proposals/logo-color-r1/sheet.png'),fullPage:true});console.log(JSON.stringify({errs}));await b.close();server.close();})();

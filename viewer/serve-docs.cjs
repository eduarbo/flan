// Serves docs/ at /flan/, as GitHub Pages does, for the home and explorer checks.
// SPDX-License-Identifier: GPL-3.0-or-later
const fs=require('fs'),path=require('path'),http=require('http');
const docs=path.resolve(__dirname,'../docs');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.bin':'application/octet-stream','.json':'application/json'};
module.exports=async function serve(){
  const server=http.createServer((req,res)=>{
    let p=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/flan/,'');if(p.endsWith('/'))p+='index.html';
    const file=path.join(docs,p);if(!file.startsWith(docs)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {base:`http://127.0.0.1:${server.address().port}/flan/`,close:()=>server.close()};
};

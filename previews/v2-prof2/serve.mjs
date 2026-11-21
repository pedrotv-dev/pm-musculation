import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'};
export function serve(port=0) {
 const server=http.createServer((req,res)=>{
 const url=decodeURIComponent(req.url.split('?')[0]);
 // Ne sert que l'aperçu, ses styles et les assets visuels existants.
 if(!/^\/(previews\/v2-prof2\/|css\/base\.css$|assets\/(icons\/icon-192\.png$|ascent\/icones\.svg$|mascot\/stage-0(?:-happy|-cheer)?\.png$))/.test(url)){res.writeHead(404).end();return;}
 let f=path.resolve(root,'.'+url);
 if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');
 if(!fs.existsSync(f)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',mime[path.extname(f)]||'application/octet-stream');
 res.setHeader('Cache-Control','no-store');fs.createReadStream(f).pipe(res);
 });
 return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server)));
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const server=await serve(4173);
 console.log('Prototype : http://127.0.0.1:4173/previews/v2-prof2/');
}

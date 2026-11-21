import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.env.UI2_NODE_MODULES || path.resolve(path.dirname(process.execPath),'../node_modules'), 'ui2-loader.cjs'));
const { chromium } = require('playwright');
const root = process.cwd();
const out = path.join(root,'previews/v1-ui2/captures'); fs.mkdirSync(out,{recursive:true});
const types = {'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json'};
const server = http.createServer((req,res)=>{
 const file = path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if (file !== root && !file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
 const f = fs.existsSync(file)&&fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;
 if(!fs.existsSync(f)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream'); fs.createReadStream(f).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true, executablePath:process.env.UI2_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const results=[];
try {
 for(const width of [320,375,390]){
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1});
  // Sentinel : toute lecture/écriture de stockage depuis une maquette échoue.
  await context.addInitScript(()=>{
   for(const key of ['localStorage','sessionStorage','indexedDB']) Object.defineProperty(window,key,{get(){throw new Error('Stockage interdit : '+key);}});
  });
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message)); page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  for(const view of ['exercice','exercice-vide','succes','succes-vide']){
   await page.goto(url+'/previews/v1-ui2/#'+view); await page.locator('h1').waitFor(); await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,view+' overflow '+width);
   assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
   assert.equal(await page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).length),0);
   await page.screenshot({path:path.join(out,view+'-'+width+'.png'),fullPage:true});
   results.push({view,width,overflow:false,storage:'interdit',errors:[...errors]});
  }
  await page.getByRole('button',{name:'Voir l’exemple rempli'}).click(); await page.waitForURL('**/#succes');
  await page.getByRole('link',{name:'Tous les aperçus'}).click(); await page.waitForURL('**/#');
  assert.equal(await page.locator('h1').innerText(),'Deux vues complémentaires');
  assert.deepEqual(errors,[]); await context.close();
 }
 // App existante, contexte vierge : profil démo seulement, jamais de données réelles.
 const ctx=await browser.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage();
 await p.goto(url+'/'); await p.locator('[data-select-profile="demo"]').click();
 for(const tab of ['accueil','seances','progres','profil']){
  await p.locator('.nav-btn[data-go="'+tab+'"]').click(); await p.screenshot({path:path.join(out,'reference-'+tab+'-390.png'),fullPage:true});
 }
 await ctx.close();
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(results,null,2)+'\n');
 console.log('12 vues vérifiées + navigation et 4 références app démo');
} finally {await browser.close();server.close();}

import { readdir, readFile, writeFile, mkdir, copyFile, unlink } from 'node:fs/promises';
import { build } from 'vite';
const assets = {};
async function cleanGeneratedAssets() {
  for (const entry of await readdir('docs/assets',{withFileTypes:true}).catch(()=>[]))
    if (entry.isFile()) await unlink('docs/assets/'+entry.name);
}
async function walk(dir,prefix='') {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const path = prefix+'/'+entry.name;
    if (entry.isDirectory()) await walk(dir+'/'+entry.name,path);
    else if (/\.(html|js|css|svg)$/.test(entry.name)) {
      const ext = entry.name.split('.').pop();
      assets[path] = {body:await readFile(dir+'/'+entry.name,'utf8'),type:({html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml'})[ext]};
    }
  }
}
await cleanGeneratedAssets();
await build({define:{'import.meta.env.VITE_API_URL':JSON.stringify('')}});
await walk('docs');
await writeFile('server/generated-assets.js','export default '+JSON.stringify(assets)+';\n');
await build({configFile:false,build:{ssr:'server/index.js',outDir:'dist/server',emptyOutDir:true,rollupOptions:{output:{entryFileNames:'index.js'}}}});
await mkdir('dist/.openai',{recursive:true});
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Cloud worker and frontend packaged in dist.');
// The GitHub Pages frontend calls the same public service at its cloud origin.
await cleanGeneratedAssets();
await build();

import {build} from 'esbuild';
import {rm,mkdir,cp,writeFile,readFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await cp('public','dist/client',{recursive:true});
await build({entryPoints:['server/worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:*']});
const h=JSON.parse(await readFile('.openai/hosting.json','utf8'));
await writeFile('dist/hosting.json',JSON.stringify({main:'server/index.js',assets:{directory:'client',binding:'ASSETS'},d1:h.d1}));

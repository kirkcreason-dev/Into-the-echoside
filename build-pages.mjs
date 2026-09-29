import {build} from 'esbuild';
import {rm,mkdir,cp,readFile,writeFile} from 'node:fs/promises';
await rm('pages-dist',{recursive:true,force:true});await mkdir('pages-dist',{recursive:true});
await cp('public','pages-dist',{recursive:true});
await build({entryPoints:['pages/entry.js'],outfile:'pages-dist/pages-bundle.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});
const html=(await readFile('public/index.html','utf8')).replace('src="app.js"','src="pages-bundle.js"');
await writeFile('pages-dist/index.html',html);await writeFile('pages-dist/.nojekyll','');
// The repository already publishes main / (root). Keep a ready-to-serve entry
// there so Pages does not need a privileged settings change or build token.
await writeFile('index.html',html.replace('<head>','<head><base href="./public/">'));
await cp('pages-dist/pages-bundle.js','public/pages-bundle.js');
await writeFile('.nojekyll','');
console.log('GitHub Pages build ready in pages-dist.');

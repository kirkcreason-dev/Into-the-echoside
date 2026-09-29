import {mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {scenarios,KIT_VERSION} from './scenarios.js';
import {DB} from '../server/engine.js';
const out='public/playtest';await mkdir(out,{recursive:true});
await build({entryPoints:['playtest/lab.js'],outfile:out+'/lab.js',bundle:true,format:'esm',platform:'browser',target:'es2023',minify:true});
const fixtures=await scenarios();await writeFile(out+'/scenarios.json',JSON.stringify(fixtures,null,2)+'\n');
const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const rows=DB.map(d=>[d.id,d.n,d.t,d.set,d.source||'https://steamcommunity.com/sharedfiles/filedetails/?id=1405579643',d.nameSource||'',d.t==='GAMBIT'?(d.descriptiveName?'Descriptive name; effect/cost visually checked':'Name corroborated; effect/cost visually checked'):'Printed scan transcribed', 'Executable definition; simulations and selected targeted regressions (not exhaustive)', 'Physical comparison pending; exhaustive interaction verification not claimed']);
await writeFile(out+'/card-audit.csv',[['id','name','type','set','card_source','name_source','evidence','digital_coverage','remaining_validation'],...rows].map(r=>r.map(csv).join(',')).join('\n')+'\n');
await writeFile(out+'/mismatch-template.csv','session,date,edition,players,scenario,step,card_names,action_and_choices,physical_result,digital_result,first_difference,rule_page_or_source,reproducible,severity,status,notes\n');
const list=(cards,reverse=false)=>{let a=[...cards];if(reverse)a.reverse();return a.map(c=>c?c.d.n+(c.d.t==='JUG'?' ['+c.d.crew+']':'')+(c.crewOverride?' ['+c.crewOverride+']':'')+(c.tilted?' [used]':''):'[empty slot]').join(' → ')||'(empty)';};
let md=`# Exact playtest positions\n\nKit ${KIT_VERSION}. Decks are listed top first. Slots and ordinary zones are left to right. These are controlled midgame positions, not standard opening deals. All unlisted cards stay out of the test.\n\n`;
for(const s of fixtures){const g=s.setup;md+=`## ${s.title}\n\n${s.lesson}\n\nActive: Player A. Turn 1. Karma: A ${g.players[0].karma}, B ${g.players[1].karma}. Both have completed 0 turns; Unity unused.\n\nVariants: ${JSON.stringify(g.variants)}\n\n`;
for(const p of g.players){md+=`### ${p.name}\n\n`;for(const z of ['hand','inPlay','items','fiends','gambits','deck','discard'])md+=`- ${z}${z==='deck'?' (top first)':''}: ${list(p[z]||[],z==='deck')}\n`;md+='\n';}
md+='### Shared table\n\n';for(const z of ['gallery','epicTier','main','epicDeck','flavor','jug'])md+=`- ${z}: ${list(g[z],['main','epicDeck','flavor','jug'].includes(z))}\n`;if(g.relic)md+=`- Relic: ${g.relic.d.n}\n`;md+='- Abyss, Flavor discard, resolved Tarot and removed Gambits: empty.\n\n### Steps\n\n'+s.steps.map((x,i)=>`${i+1}. ${x.label}`).join('\n')+'\n\n### Expected final checks\n\n'+s.checks.map(x=>'- '+x).join('\n')+'\n\n';}
await writeFile(out+'/positions.md',md);await copyFile('playtest/README.md',out+'/README.md');await copyFile('playtest/setup-checks.md',out+'/setup-checks.md');
execFileSync('python3',['-c',`import zipfile\nfrom pathlib import Path\np=Path('public/playtest')\nwith zipfile.ZipFile(p/'echoside-playtest-kit.zip','w',zipfile.ZIP_DEFLATED) as z:\n for n in ['README.md','positions.md','scenarios.json','mismatch-template.csv','card-audit.csv','setup-checks.md']:z.write(p/n,n)`]);
console.log('Eight reproducible practice scenarios and physical test kit built.');

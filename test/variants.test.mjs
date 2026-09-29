import test from 'node:test';
import assert from 'node:assert/strict';
import { transition, DB, viewState } from '../server/engine.js';
import { normalizeVariants } from '../server/variants.js';
import { createRoom, changeRoom, projectRoom } from '../pages/room.js';
import { validateView } from '../pages/validate-view.js';
const defs = Object.fromEntries(DB.map(d=>[d.id,d]));
const start = async (variants={}, expansion=false) => (await transition({config:{seed:42,players:[{name:'One',isAI:true},{name:'Two',isAI:true}],expansion,variants}},{type:'start'})).state;
const add=(g,id,zone='hand',seat=g.active)=>{const c={id,u:++g.uid,d:defs[id]};g.players[seat][zone].push(c);return c;};
test('Abolish Made Easy replaces the benefit, spends Unity, and excludes Flavor',async()=>{
 const g=await start({abolishUnity:true}),p=g.players[g.active]; p.isAI=false;p.hand=[];
 for(let i=0;i<3;i++)add(g,'c1430','inPlay'); const junk=add(g,'c1203'),flavor=add(g,'c2904');
 const a={type:'unity',crew:'DC'};let r=await transition(g,a,[1]);
 assert.equal(r.pending.kind,'cards');assert.deepEqual(r.pending.cards.map(c=>c.u),[junk.u]);
 r=await transition(g,a,[1,[junk.u]]);assert.equal(r.pending,null);assert.equal(r.state.players[g.active].karma,0);assert(r.state.players[g.active].unityUsed);assert(r.state.abyss.some(c=>c.u===junk.u));assert(r.state.players[g.active].hand.some(c=>c.u===flavor.u));
 const normal=await transition(g,a,[0]);assert.equal(normal.state.players[g.active].karma,2);
});
test('A Matter of Time supports chosen supplies and ignores Epic depletion when selected',async()=>{
 for(const expansion of [false,true]) for(const n of [0,1,3,6,12]){const g=await start({epicCount:n,mainOnly:true},expansion);assert.equal(g.epicDeck.length+g.epicTier.filter(Boolean).length,n);assert.equal(g.endTriggered,false);}
 let g=await start({epicCount:4,mainOnly:true});g.epicTier[0]=null;g=(await transition(g,{type:'end'})).state;assert.equal(g.epicDeck.length,0);assert.equal(g.endTriggered,false);
 g.main=[];g=(await transition(g,{type:'end'})).state;assert(g.endTriggered);
 assert.throws(()=>normalizeVariants({epicCount:13}));assert.throws(()=>normalizeVariants({epicCount:-1}));
});
test('House of Mirrors reveals exactly the current top of all three shared decks',async()=>{
 const g=await start({mirrors:true});for(const seat of [0,1]){const v=viewState(g,seat);for(const z of ['main','flavor','epicDeck']){assert.equal(v[z].at(-1).u,g[z].at(-1).u);assert(v[z].slice(0,-1).every(c=>c===null));}assert(v.players.every(p=>p.deck.every(c=>c===null)));}
 const hidden=viewState(await start(),0);assert(hidden.main.every(c=>c===null));
});
test('Relic is removed from Main, cannot be owned/targeted/scored, and resets each turn',async()=>{
 let g=await start({relic:'c2515'});assert.equal(g.relic.id,'c2515');assert.equal([...g.main,...g.gallery].filter(c=>c?.id==='c2515').length,0);const seat=g.active;
 const before=viewState(g,seat).players[seat].gp;g=(await transition(g,{type:'relic'})).state;assert(g.relic.tilted);assert.equal(g.players[seat].hand.filter(c=>c.d.t==='FLAVOR').length,1);assert.equal(viewState(g,seat).players[seat].gp,before);
 await assert.rejects(transition(g,{type:'relic'}));await assert.rejects(transition(g,{type:'buy',zone:'extra',id:g.relic.u}));
 g=(await transition(g,{type:'end'})).state;assert.equal(g.relic.tilted,false);g=(await transition(g,{type:'relic'})).state;assert(g.relic.tilted);
 assert.throws(()=>normalizeVariants({relic:'c2512'}));assert.throws(()=>normalizeVariants({relic:'c2504'},false));
});
test('Relic mask affects each owner cleanup and a Lotus relic cannot be discarded',async()=>{
 let g=await start({relic:'c2506'}),seat=g.active;g=(await transition(g,{type:'end'})).state;assert.equal(g.players[seat].hand.length,6);
 g=await start({relic:'c2504'},true);g.players[(g.active+1)%2].hand=[];const uid=g.relic.u;g=(await transition(g,{type:'end'})).state;assert.equal(g.relic.u,uid);assert(!g.abyss.some(c=>c.u===uid));
});
test('online room carries variants into setup and validates projected relic/top cards',async()=>{
 let r=await createRoom('host',{name:'Host',variants:{relic:'c2506',mirrors:true,epicCount:5,abolishUnity:true}});r=await changeRoom(r,'guest','join',{name:'Guest'});r=await changeRoom(r,'host','start',{revision:r.revision});assert.equal(r.game.relic.id,'c2506');assert.equal(r.game.variants.epicCount,5);assert(validateView(projectRoom(r,'guest')).game.main.at(-1));
});
test('Shovel draw opens a Mirror reaction',async()=>{
 let g=await start({},true),p=g.players[g.active],other=(g.active+1)%2;g.players[other].isAI=false;g.players[other].hand=[];add(g,'c1414','hand',other);const shovel=add(g,'c2500','items');p.deck=[{id:'c1203',u:++g.uid,d:defs.c1203}];const r=await transition(g,{type:'item',id:shovel.u});assert.match(r.pending.title,/Mirror/);
});
test('Flying Guillotine triggers before a full effect-driven discard shuffle',async()=>{
 let g=await start({},true),p=g.players[g.active];p.isAI=false;p.hand=[];p.discard=[];add(g,'c2831','items');const flavor=add(g,'c2933'),junk=add(g,'c1203','discard');
 const action={type:'play',id:flavor.u};const r=await transition(g,action,[0]);assert.equal(r.pending.kind,'cards');assert(r.pending.cards.some(c=>c.u===junk.u));
 const done=await transition(g,action,[0,[junk.u]]);assert.equal(done.pending,null);assert(done.state.abyss.some(c=>c.u===junk.u));assert(!done.state.players[g.active].deck.some(c=>c.u===junk.u));
});
test('Entourage copying Sideshow checks two other DC cards rather than its own crew',async()=>{
 const g=await start(),p=g.players[g.active];p.isAI=false;p.hand=[];p.inPlay=[];const copy=add(g,'c2721'),junk=add(g,'c1203');const sideshow=add(g,'c1426','inPlay');add(g,'c1430','inPlay');
 const result=await transition(g,{type:'play',id:copy.u},[[sideshow.u],[junk.u]]);assert.equal(result.pending,null);assert(result.state.abyss.some(c=>c.u===junk.u));assert.equal(result.state.players[g.active].karma,2);
});
test('combined variants preserve physical cards through complete base and Oracle games',async()=>{
 for(const expansion of [false,true]){
  let g=await start({abolishUnity:true,mirrors:true,epicCount:4,mainOnly:true,relic:'c2506'},expansion);
  const physical=g=>[...g.main,...g.gallery,...g.epicTier,...g.epicDeck,...g.flavor,...g.flavorDis,...g.tarotDiscard,...g.abyss,...g.jug,...g.extraGallery,g.relic,...g.players.flatMap(p=>[...p.deck,...p.hand,...p.inPlay,...p.items,...p.fiends,...p.discard])].filter(Boolean);
  const count=physical(g).length;let n=0;while(!g.over&&n++<3000){const r=await transition(g,{type:'bot'});assert.equal(r.pending,null);g=r.state;const cards=physical(g);assert.equal(cards.length,count);assert.equal(new Set(cards.map(c=>c.u)).size,count);}
  assert(g.over);assert(g.players.every(p=>p.turns===g.players[0].turns));
 }
});

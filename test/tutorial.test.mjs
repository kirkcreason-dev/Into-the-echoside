import test from 'node:test';
import assert from 'node:assert/strict';
import {transition,viewState} from '../server/engine.js';

const setup=seed=>({config:{players:[{name:'Learner'},{name:'The Void',isAI:true}],expansion:false,tutorial:true,seed}});
const move=async(g,action,answers=[])=>{const r=await transition(g,action,answers);assert.equal(r.pending,null);return r.state};
const owned=p=>[...p.hand,...p.deck,...p.discard,...p.inPlay,...p.fiends,...p.items];
const physical=g=>[...g.main,...g.gallery.filter(Boolean),...g.flavor,...g.flavorDis,...g.abyss,...g.tarotDiscard,...g.jug,...g.epicDeck,...g.epicTier.filter(Boolean),...g.extraGallery,...g.players.flatMap(owned)];

test('guided match teaches a complete turn and stomp, preserving all cards across seeds',async()=>{
  for(const seed of [1,7,91,345]){
    let g=await move(setup(seed),{type:'start'});
    const cards=physical(g).map(c=>c.u).sort((a,b)=>a-b);
    assert.equal(g.active,0);assert.equal(g.first,0);assert.equal(g.tutorial.step,0);
    assert.deepEqual(g.players[0].hand.map(c=>c.id),['c1203','c1203','c1200','c1200','c1200']);
    assert.equal(owned(g.players[0]).length,10);assert.equal(g.gallery[0].id,'c1430');assert.equal(g.gallery[1].id,'c2823');
    await assert.rejects(transition(g,{type:'end'}),/lesson/);
    g=await move(g,{type:'tutorial',command:'next'});
    g=await move(g,{type:'ninjas'});assert.equal(g.tutorial.step,2);assert.equal(g.players[0].karma,2);
    for(let n=0;n<3;n++){
      const action={type:'play',id:g.players[0].hand.find(c=>c.id==='c1200').u};
      const waiting=await transition(g,action);
      assert.equal(waiting.pending.tutorialChoice,0);assert.equal(waiting.state.tutorial.step,2);
      await assert.rejects(transition(g,action,[1]),/highlighted option/);
      g=await move(g,action,[0]);
      // Serialized room snapshots retain progress, as they do on reconnect.
      g=JSON.parse(JSON.stringify(g));
    }
    assert.equal(g.tutorial.step,3);
    g=await move(g,{type:'unity',crew:'DC'});assert.equal(g.players[0].karma,4);assert.equal(g.tutorial.step,4);
    await assert.rejects(transition(g,{type:'buy',zone:'gallery',index:1}),/lesson/);
    g=await move(g,{type:'buy',zone:'gallery',index:0});assert.equal(g.tutorial.step,5);assert.equal(viewState(g,0).players[0].gp,1);
    g=await move(g,{type:'buy',zone:'gallery',index:1});assert.equal(g.tutorial.step,6);assert.equal(g.players[0].karma,0);assert.equal(g.players[0].fiends.length,1);
    g=await move(g,{type:'end'});assert.equal(g.tutorial.step,7);assert.equal(g.active,1);assert.equal(g.players[0].hand.length,5);
    const reaction=await transition(g,{type:'bot'});assert.equal(reaction.pending.actor,0);assert.match(reaction.pending.labels[0],/Drainer Road Monks/);
    g=await move(g,{type:'bot'},[0]);assert.equal(g.tutorial.step,8);assert(g.abyss.some(c=>c.id==='c2823'));
    for(let n=0;g.active===1&&n<30;n++)g=await move(g,{type:'bot'});
    assert.equal(g.tutorial.step,9);assert.equal(g.active,0);
    g=await move(g,{type:'tutorial',command:'finish'});assert.equal(g.tutorial.completed,true);assert.equal(g.tutorial.active,false);
    g=await move(g,{type:'ninjas'});assert.equal(g.players[0].karma,5);
    assert.deepEqual(physical(g).map(c=>c.u).sort((a,b)=>a-b),cards);
  }
});

test('leaving the guide enables ordinary play without redealing',async()=>{
  let g=await move(setup(10),{type:'start'});
  const before=g.players[0].hand.map(c=>c.u);
  g=await move(g,{type:'tutorial',command:'skip'});
  assert.equal(g.tutorial.skipped,true);assert.deepEqual(g.players[0].hand.map(c=>c.u),before);
  g=await move(g,{type:'end'});assert.equal(g.active,1);
  await assert.rejects(transition(g,{type:'tutorial',command:'next'}),/no active guide/);
});

test('guided setup cannot change ordinary multiplayer or expansion configuration',async()=>{
  for(const config of [{...setup(1).config,expansion:true},{...setup(1).config,players:[{name:'One'},{name:'Two'}]}])await assert.rejects(transition({config},{type:'start'}),/guided game/);
  const normal=setup(3);delete normal.config.tutorial;
  const g=await move(normal,{type:'start'});assert.equal(g.tutorial,undefined);
});

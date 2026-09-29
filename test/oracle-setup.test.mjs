import test from 'node:test';
import assert from 'node:assert/strict';
import { transition, viewState } from '../server/engine.js';
import { createRoom, changeRoom, projectRoom } from '../pages/room.js';
import { parseBackup } from '../pages/backup.js';
import { validateView } from '../pages/validate-view.js';
import { normalizeVariants } from '../server/variants.js';

const owned = p => ['deck','hand','discard','inPlay','items','fiends'].flatMap(z => p[z]);
const physical = g => [
  ...['main','gallery','epicTier','epicDeck','flavor','flavorDis','tarotDiscard','abyss','jug','extraGallery','armyRemoved','gambitReserve','gambitRemoved'].flatMap(z => g[z] || []),
  g.relic, ...g.players.flatMap(p => [...owned(p), ...p.gambits]),
].filter(Boolean);

test('Oracle can start without Gambits in solo and online rooms, including restored lobbies', async () => {
  const solo = await createRoom('solo', {name:'Solo',solo:true,expansion:true,gambits:false});
  assert.equal(solo.game.gambitsEnabled,false);
  assert.equal(solo.game.gambitReserve.length,0);
  assert.equal(projectRoom(solo,'solo').gambits,false);
  let room = await createRoom('host',{name:'Host',expansion:true,gambits:false});
  room = await changeRoom(room,'guest','join',{name:'Guest'});
  room = parseBackup(JSON.stringify({format:'echoside-table-backup',version:1,room}));
  room = await changeRoom(room,'host','start',{revision:room.revision});
  assert.equal(room.game.gambitsEnabled,false);
  assert(room.game.players.every(p => p.gambits.length === 0));
  assert(!room.pending?.title.includes('Gambits'));
});

test('existing Oracle lobbies retain their Gambit draft and base tutorials exclude it', async () => {
  let room = await createRoom('host',{name:'Host',expansion:true});
  delete room.gambits; // A pre-0.3.1 saved lobby.
  room = await changeRoom(room,'guest','join',{name:'Guest'});
  assert.equal(projectRoom(room,'guest').gambits,true);
  room = await changeRoom(room,'host','start',{revision:room.revision});
  assert.equal(room.pending.title,'Choose your Gambits');
  assert.equal(room.pending.cards.length,10);
  const tutorial = await createRoom('host',{name:'Learner',solo:true,tutorial:true,expansion:true,gambits:true});
  assert.equal(tutorial.game.gambitsEnabled,false);
  assert.equal(tutorial.gambits,false);
});

test('Juggalo Army removes exactly three selected starters, then rotates one recruitment at a time', async () => {
  for (const n of [2,3,4]) {
    let room = await createRoom('seat0',{name:'Player 0',expansion:true,gambits:false,variants:{juggaloArmy:true}});
    room.seed = 42;
    for (let i=1;i<n;i++) room = await changeRoom(room,'seat'+i,'join',{name:'Player '+i});
    room = await changeRoom(room,'seat0','start',{revision:room.revision});
    const removed=[], picks=[], actors=[];
    while (room.pending?.title.startsWith('Juggalo Army')) {
      const q=room.pending, seat=q.actor;
      assert(room.game.players.every(p => p.hand.length===0));
      assert.equal(projectRoom(room,'seat'+((seat+1)%n)).pending.kind,'waiting');
      await assert.rejects(changeRoom(room,'seat'+((seat+1)%n),'choice',{revision:room.revision,answer:[]}),/Another player/);
      const answer=q.cards.slice(0,q.min).map(c=>c.u);
      if(q.title.includes('replace')) {
        assert.equal(q.cards.length,10); assert(q.cards.every(c=>c.d.t==='START'));
        removed.push(...answer);
        await assert.rejects(changeRoom(room,'seat'+seat,'choice',{revision:room.revision,answer:answer.slice(1)}),/Invalid card/);
      } else {
        assert.equal(q.min,1);assert.equal(q.max,1);
        assert.equal(q.cards.length,30-picks.length);
        assert(q.cards.every(c=>c.d.t==='JUG'&&!picks.includes(c.u)));
        actors.push(seat);picks.push(...answer);
      }
      for(let i=0;i<n;i++) validateView(projectRoom(room,'seat'+i));
      const input={revision:room.revision,answer};
      const restored=parseBackup(JSON.stringify({format:'echoside-table-backup',version:1,room}));
      const live=await changeRoom(room,'seat'+seat,'choice',input);
      const resumed=await changeRoom(restored,'seat'+seat,'choice',input);
      assert.deepEqual(resumed.game,live.game);
      assert.deepEqual(resumed.pending,live.pending);
      room=live;
    }
    const g=room.game;
    assert.deepEqual(actors,[...g.armyDraftOrder,...g.armyDraftOrder,...g.armyDraftOrder]);
    assert.deepEqual(g.armyRemoved.map(c=>c.u),removed);
    assert.equal(g.jug.length,30-3*n);
    assert.equal(new Set(picks).size,n*3);
    for(const p of g.players) {
      assert.equal(owned(p).filter(c=>c.d.t==='JUG').length,3);
      assert.equal(owned(p).filter(c=>c.d.t==='START').length,7);
      assert(!owned(p).some(c=>removed.includes(c.u)));
    }
    assert(!g.abyss.some(c=>removed.includes(c.u)));
    assert(g.armyRolls.length>0);assert(g.firstRolls.length>0);
    assert.equal(g.phase,undefined);
    assert(viewState(g,0).players.every(p=>p.deck.every(c=>c===null)));
  }
  assert.throws(()=>normalizeVariants({juggaloArmy:true},false),/requires the Oracle/);
});

test('Juggalo Army, Gambits and shared Relic conserve cards through complete 2–4 player games', async () => {
  for(const n of [2,3,4]) {
    let {state:g,pending}=await transition({config:{seed:42,expansion:true,gambits:true,
      players:Array.from({length:n},(_,i)=>({name:'Player '+i,isAI:true})),
      variants:{juggaloArmy:true,relic:'c2506',mirrors:true,abolishUnity:true},
    }},{type:'start'});
    assert.equal(pending,null);
    const count=physical(g).length;
    let steps=0;
    while(!g.over&&steps++<3000) {
      const result=await transition(g,{type:'bot'});
      assert.equal(result.pending,null);g=result.state;
      const cards=physical(g);
      assert.equal(cards.length,count);
      assert.equal(new Set(cards.map(c=>c.u)).size,count);
      assert.equal(g.armyRemoved.length,n*3);
    }
    assert(g.over);assert(g.players.every(p=>p.turns===g.players[0].turns));
  }
});

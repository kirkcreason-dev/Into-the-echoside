import test from 'node:test';import assert from 'node:assert/strict';
import {createRoom,changeRoom,projectRoom} from '../pages/room.js';
import {validateView} from '../pages/validate-view.js';

test('Pages rooms enforce seats, capacity, host control and stale moves',async()=>{
  let room=await createRoom('host',{name:'Host',expansion:false});
  assert.throws(()=>projectRoom(room,'stranger'),/Join/);
  for(let i=1;i<=3;i++)room=await changeRoom(room,'guest'+i,'join',{name:'Guest '+i});
  await assert.rejects(changeRoom(room,'guest4','join',{name:'Late'}),/full/);
  await assert.rejects(changeRoom(room,'guest1','start',{revision:room.revision}),/Only the host/);
  room=await changeRoom(room,'host','start',{revision:room.revision});
  const snapshot=JSON.stringify(room),active=room.game.active,actor=room.members[active].session,other=room.members[(active+1)%4].session;
  await assert.rejects(changeRoom(room,other,'action',{revision:room.revision,action:{type:'end'}}),/not your turn/);
  await assert.rejects(changeRoom(room,actor,'action',{revision:room.revision-1,action:{type:'end'}}),/table changed/);
  assert.equal(JSON.stringify(room),snapshot);
  const view=validateView(projectRoom(room,actor));
  assert(view.game.players[(active+1)%4].hand.every(c=>c===null));
  assert(!JSON.stringify(view).includes('"session"'));assert(!view.game.config);assert(!view.game.rng);
  const next=await changeRoom(room,actor,'action',{revision:room.revision,action:{type:'end'}});
  assert.equal(next.revision,room.revision+1);assert.equal(next.game.active,(active+1)%4);
});

test('Pages tutorial persists a pending choice and safely leaves guidance',async()=>{
  let room=await createRoom('learner',{name:'Ninja',solo:true,tutorial:true,expansion:true});
  assert.equal(room.expansion,false);
  const move=async(route,extra)=>room=await changeRoom(room,'learner',route,{revision:room.revision,...extra});
  await move('tutorial',{action:{command:'next'}});await move('action',{action:{type:'ninjas'}});
  const dog=room.game.players[0].hand[0];await move('action',{action:{type:'play',id:dog.u}});
  assert.equal(room.pending.tutorialChoice,0);room=structuredClone(room);
  const partial=projectRoom(room,'learner');assert.equal(partial.pending.kind,'option');
  await move('tutorial',{action:{command:'skip'}});
  assert.equal(room.pending,null);assert(room.game.players[0].hand.some(c=>c.u===dog.u));
  await move('action',{action:{type:'play',id:dog.u}});await move('choice',{answer:1});
  assert.equal(room.game.players[0].inPlay.at(-1).crewOverride,'PSY');
});

test('remote views reject unsafe fields and use local printed card definitions',async()=>{
  const room=await createRoom('host',{name:'Host',solo:true,tutorial:true});
  let view=projectRoom(room,'host');view.game.players[0].karma='<img src=x onerror=alert(1)>';
  assert.throws(()=>validateView(view),/invalid table/);
  view=projectRoom(room,'host');view.game.players[0].hand[0].d.cost='<script>';
  assert.equal(validateView(view).game.players[0].hand[0].d.cost,0);
  view=projectRoom(room,'host');view.game.jug.count=1e9;assert.throws(()=>validateView(view),/invalid table/);
});

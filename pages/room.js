import {transition,viewState} from '../server/engine.js';

export function fail(status,message){const e=new Error(message);e.status=status;throw e}
export function cleanName(value){const s=typeof value==='string'?value.trim():'';if(!s||s.length>24||/[<>\x00-\x1f]/.test(s))fail(400,'Use a name between 1 and 24 characters.');return s.replace(/[&"']/g,'')}
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join('');
export const randomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');

async function execute(room,action,answers=[],base=room.game){
  const result=await transition(base,action,answers);
  room.game=result.state;room.pending=result.pending;
  if(result.pending)room.transaction={base,action,answers};else delete room.transaction;
}
export async function createRoom(session,body){
  if(body.tutorial&&!body.solo)fail(400,'The tutorial is a solo practice table.');
  const members=[{name:cleanName(body.name),session}];
  if(body.solo)members.push({name:'The Void',session:'bot:'+randomToken(),isAI:true});
  const room={code:randomCode(),revision:0,status:body.solo?'playing':'lobby',solo:!!body.solo,members,expansion:body.tutorial?false:!!body.expansion,seed:crypto.getRandomValues(new Uint32Array(1))[0],game:null,pending:null,updatedAt:Date.now()};
  if(body.solo)await execute(room,{type:'start'},[],{config:{players:members.map(m=>({name:m.name,isAI:!!m.isAI})),expansion:room.expansion,tutorial:!!body.tutorial,seed:room.seed}});
  return room;
}
export function projectRoom(room,session){
  const seat=room.members.findIndex(m=>m.session===session);if(seat<0)fail(403,'Join this room first.');
  return{code:room.code,revision:room.revision,status:room.status,seat,isHost:seat===0,expansion:room.expansion,hosting:room.solo?'local':'peer',members:room.members.map(m=>({name:m.name,isAI:!!m.isAI})),game:viewState(room.game,seat),pending:room.pending?room.pending.actor===seat?room.pending:{actor:room.pending.actor,title:'A player is resolving a card effect.',kind:'waiting'}:null};
}
export async function changeRoom(source,session,route,body={}){
  const room=structuredClone(source),seat=room.members.findIndex(m=>m.session===session);
  if(route==='join'){
    if(seat>=0)return room;
    if(room.status!=='lobby')fail(409,'This match has already started.');
    if(room.members.length>=4)fail(409,'This room is full.');
    room.members.push({name:cleanName(body.name),session});
  }else{
    if(seat<0)fail(403,'Join this room first.');
    if(body.revision!==room.revision)fail(409,'The table changed. Refreshing your view.');
    if(route==='start'){
      if(seat!==0)fail(403,'Only the host can start the match.');
      if(room.status!=='lobby'||room.members.length<2)fail(409,'Wait for at least one other player.');
      await execute(room,{type:'start'},[],{config:{players:room.members.map(m=>({name:m.name,isAI:!!m.isAI})),expansion:room.expansion,seed:room.seed}});room.status='playing';
    }else{
      if(room.status!=='playing'||room.game?.over)fail(409,'This match is over.');
      if(route==='tutorial'){
        if(seat!==0||!room.game.tutorial?.active)fail(403,'This table has no active guide for you.');
        const command=body.action?.command;if(!['next','skip','finish'].includes(command))fail(400,'Invalid tutorial action.');
        if(room.pending&&command!=='skip')fail(409,'Resolve the card effect first.');
        await execute(room,{type:'tutorial',command},[],room.transaction?.base||room.game);
      }else if(route==='choice'){
        if(!room.pending||!room.transaction||room.pending.actor!==seat)fail(403,'Another player is resolving this effect.');
        const tx=room.transaction;await execute(room,tx.action,[...tx.answers,body.answer],tx.base);
      }else{
        if(room.pending)fail(409,'Resolve the current card effect first.');
        if(route==='bot'){
          if(!room.game.players[room.game.active].isAI)fail(409,'The Void is not taking a turn.');
          await execute(room,{type:'bot'});
        }else if(route==='action'){
          if(room.game.active!==seat)fail(403,'It is not your turn.');
          if(!body.action||!['play','ninjas','buy','cycle','item','fiend','unity','end'].includes(body.action.type))fail(400,'Invalid game action.');
          await execute(room,body.action);
        }else fail(404,'Unknown game action.');
      }
      if(room.game.over)room.status='complete';
    }
  }
  room.revision++;room.updatedAt=Date.now();return room;
}

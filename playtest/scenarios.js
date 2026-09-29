import { DB, transition } from '../server/engine.js';
const defs = Object.fromEntries(DB.map(d => [d.id, d]));
export const KIT_VERSION = '0.3.0';
async function table(variants = {}, expansion = false) {
  const g = (await transition({config:{seed:1701,players:[{name:'Player A',isAI:true},{name:'Player B',isAI:true}],expansion,variants}}, {type:'start'})).state;
  g.active=0;g.first=0;g.turnN=1;g.endTriggered=false;g.log=[];g.uid=0;
  for(const p of g.players) { for(const z of ['hand','deck','discard','items','fiends','inPlay','gambits'])p[z]=[];p.karma=0; }
  for(const z of ['main','flavor','flavorDis','jug','epicDeck','epicTier','gallery','extraGallery','abyss','tarotDiscard','gambitRemoved','gambitReserve'])g[z]=[];
  delete g.relic;
  const mk=id=>{ if(!defs[id])throw Error('Unknown fixture card '+id);return {id,u:++g.uid,d:defs[id],tilted:false}; };
  const put=(seat,zone,ids)=>g.players[seat][zone]=ids.map(mk);
  // Arrays in the engine are bottom-to-top. The kit prints them top-to-bottom.
  g.main=['c1431','c1428','c1432','c1433','c1420','c1419','c1417','c1412'].map(mk);
  g.gallery=['c1430','c1403','c1402','c2501','c2715','c2721'].map(mk);
  g.epicTier=['c1301','c1302','c1303'].map(mk);g.epicDeck=['c1305','c1306'].map(mk);
  g.flavor=['c2904','c2900','c2902','c2907','c2908'].map(mk);g.jug=['c3000','c3010','c3020'].map(mk);
  put(0,'deck',['c1203','c1203','c1203','c1203','c1200','c1200','c1200']);
  put(1,'deck',['c1203','c1203','c1203','c1203','c1200','c1200','c1200']);
  return {g,mk,put};
}
export async function scenarios() {
  const out=[];
  const add=(id,title,lesson,setup,steps,checks,oracle=false)=>out.push({id,title,lesson,setup,steps,checks,oracle,version:KIT_VERSION});
  {
    const {g,mk,put}=await table({abolishUnity:true});g.players[0].isAI=false;
    put(0,'deck',Array(6).fill('c1203'));
    put(0,'inPlay',['c1200','c1200','c1200']);g.players[0].inPlay.forEach(c=>c.crewOverride='DC');
    put(0,'hand',['c1203','c2904']);const ninja=g.players[0].hand[0];
    add('unity','Abolish Made Easy','Unity can be exchanged for abolishing one card. Flavor is never eligible.',g,
      [{label:'Claim Dark Carnival Unity; choose Abolish a card instead; select Ninja.',action:{type:'unity',crew:'DC'},answers:[1,[ninja.u]]}],
      ['Player A has 0 Karma and Unity is used.','Ninja is in the Abyss; the Flavor card stays in hand.']);
  }
  {
    const {g}=await table({epicCount:4,mainOnly:true});g.epicDeck.splice(0,1);g.epicTier[0]=null;
    add('time','A Matter of Time','In Main Deck ending mode, exhausting the Epic draw pile does not end the match.',g,
      [{label:'Player A ends their turn. Refill the empty Epic slot.',action:{type:'end'}}],
      ['The Epic draw pile is empty; its last card occupies the empty tier slot.','The final round has not started. Player B is active.']);
  }
  {
    const {g}=await table({mirrors:true});g.players[0].karma=2;
    add('mirrors','House of Mirrors','The current top Main, Epic and Flavor cards are public. All lower cards remain hidden in an ordinary match.',g,
      [{label:'Buy The Loons from Gallery slot 1.',action:{type:'buy',zone:'gallery',index:0}},
       {label:'End the turn. The visible top Main card fills Gallery slot 1.',action:{type:'end'}}],
      ['The previously visible Main top is now in Gallery slot 1.','The next card is faceup on the Main Deck. Flavor and Epic tops are unchanged.']);
  }
  {
    const {g,mk}=await table({relic:'c2515'});g.relic=mk('c2515');
    add('relic','Relic of Power','Each player may activate The Wraith’s Tome once during their turn. The Relic belongs to nobody.',g,
      [{label:'Player A activates the Relic, drawing one Flavor.',action:{type:'relic'}},
       {label:'Player A ends their turn. The Relic becomes ready for Player B.',action:{type:'end'}},
       {label:'Player B activates the same Relic.',action:{type:'relic'}}],
      ['Player B holds one Flavor card.','The Wraith’s Tome remains the shared Relic, is used this turn, and adds no Gathering Points.']);
  }
  {
    const {g,put}=await table({},true);put(0,'hand',['c2517']);put(1,'hand',['c1414']);g.players[1].isAI=false;
    const actor=g.players[0].hand[0];
    add('mirror','Oracle: Mirror a draw','Mirror gives one draw when an opponent draws cards, even if the original effect draws three.',g,
      [{label:'Player A plays Axe Murder Boyz. Player B responds with In Yo Face. A keeps two of the three drawn cards.',action:{type:'play',id:actor.u},answers:[0]}],
      ['A has two cards in hand and one drawn card in the discard.','B drew exactly one card, gained 2 Karma, and In Yo Face stays in play.'],true);
  }
  {
    const {g,put}=await table({},true);put(0,'items',['c2502']);put(1,'hand',['c1404']);g.players[1].isAI=false;
    const item=g.players[0].items[0];
    add('fast','Oracle: interrupt an Item','Bitch Slap can nullify an Item as its activation is announced. The activation is spent, but the effect fails.',g,
      [{label:'A activates Joey’s Bazooka. B plays Bitch Slap, targets A, then chooses the Bazooka.',action:{type:'item',id:item.u},answers:[0,[item.u]]}],
      ['The Gallery is unchanged. Bazooka is used and nullified for this turn.','B has 3 Karma and Bitch Slap in play.'],true);
  }
  {
    const {g,mk,put}=await table({},true);g.main.push(mk('c2620'));g.gallery[0]=null;put(1,'hand',['c1203']);
    add('tarot','Oracle: reveal a Tarot','Tarot interrupts Gallery refill. Both players accept the draw; then refill continues past the Tarot.',g,
      [{label:'A ends their turn. Reveal Ace of Pentacles, accept both draws, and continue filling the Gallery.',action:{type:'end'}}],
      ['Ace of Pentacles is in the resolved Tarot pile, never in the Gallery.','A has six cards after the Tarot draw and normal cleanup draw; B has two.'],true);
  }
  {
    const {g,mk}=await table({},true);g.players[0].gambits=[mk('gambit01'),mk('gambit36')];
    add('gambit','Oracle: one-use Gambits','This practice hand spends a three-point draft budget: Karma Infusion costs two, and GP Boost costs one. Save the GP card for scoring.',g,
      [{label:'Use Karma Infusion for 1 Karma.',action:{type:'gambit',id:g.players[0].gambits[0].u}}],
      ['A has 1 Karma. Karma Infusion is in the removed Gambit pile and cannot be reused.','GP Boost remains private and contributes 1 GP at scoring.'],true);
  }
  return out;
}
export async function resolveScenarioStep(state, step) {
  const result = await transition(state,step.action,step.answers || []);
  if(result.pending)throw Error(`Scenario needs another choice: ${result.pending.title}`);
  return result.state;
}

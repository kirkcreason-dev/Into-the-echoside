import test from 'node:test';
import assert from 'node:assert/strict';
import {scenarios,resolveScenarioStep} from '../playtest/scenarios.js';
import {viewState} from '../server/engine.js';
test('all eight physical comparison scripts replay with their stated outcomes',async()=>{
 const fixtures=await scenarios();assert.equal(fixtures.length,8);
 for(const s of fixtures){let g=structuredClone(s.setup);for(const step of s.steps)g=await resolveScenarioStep(g,step);let replay=structuredClone(s.setup);for(const step of s.steps)replay=await resolveScenarioStep(replay,step);assert.deepEqual(g,replay);
 const [a,b]=g.players;
 if(s.id==='unity'){assert.equal(a.karma,0);assert(a.unityUsed);assert.equal(g.abyss[0].id,'c1203');assert.equal(a.hand[0].d.t,'FLAVOR');}
 if(s.id==='time'){assert.equal(g.epicDeck.length,0);assert.equal(g.endTriggered,false);assert.equal(g.active,1);}
 if(s.id==='mirrors'){assert.equal(g.gallery[0].u,s.setup.main.at(-1).u);assert.equal(viewState(g,0).main.at(-1).u,g.main.at(-1).u);}
 if(s.id==='relic'){assert.equal(b.hand.filter(c=>c.d.t==='FLAVOR').length,1);assert(g.relic.tilted);assert.equal(g.relic.id,'c2515');}
 if(s.id==='mirror'){assert.equal(a.hand.length,2);assert.equal(a.discard.length,1);assert.equal(b.hand.length,1);assert.equal(b.karma,2);assert.equal(b.inPlay[0].id,'c1414');}
 if(s.id==='fast'){assert.deepEqual(g.gallery,s.setup.gallery);assert(a.items[0].tilted);assert.equal(a.items[0].nullTurn,g.turnN);assert.equal(b.karma,3);}
 if(s.id==='tarot'){assert.equal(g.tarotDiscard[0].id,'c2620');assert.equal(a.hand.length,6);assert.equal(b.hand.length,2);assert(g.gallery.every(c=>c?.d.t!=='TAROT'));}
 if(s.id==='gambit'){assert.equal(a.karma,1);assert.equal(g.gambitRemoved[0].id,'gambit01');assert.equal(a.gambits[0].d.gp,1);}
 }
});

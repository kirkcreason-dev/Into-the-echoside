export function tutorialLesson(g) {
  const p=g.players[0],step=g.tutorial.step;
  const dog=p.hand.find(c=>c.id==='c1200');
  const gallery=id=>g.gallery.findIndex(c=>c?.id===id);
  const lessons=[
    {number:0,title:'Your first gathering',text:'Build a deck worth the most Gathering Points (GP). Karma is the currency you spend during a turn. Learn both in this guided base-game match against the Void.',detail:'About 3 minutes · Your progress saves automatically · Leave the guide at any time',label:'Begin the lesson',action:'tutorial-next'},
    {number:1,title:'Ninjas make Karma',text:'Each Ninja gives you 1 Karma. Play both Ninjas from your hand to earn 2. You can inspect cards individually, or play every Ninja with one click.',detail:`${p.karma} / 2 Karma earned. Karma does not carry over to your next turn.`,label:'Play Ninjas',action:'ninjas',targets:['[data-action="ninjas"]',...p.hand.filter(c=>c.id==='c1203').map(c=>`[data-action="hand:${c.u}"]`)]},
    {number:2,title:'Gather the same crew',text:'Hound Dogs become a crew of your choice for this turn. Play all three and choose Dark Carnival each time. Three cards of one crew unlock Unity.',detail:`${p.inPlay.filter(c=>c.id==='c1200'&&c.crewOverride==='DC').length} / 3 Hound Dogs in Dark Carnival. Hound Dogs do not generate Karma by themselves.`,label:'Play Hound Dogs',action:dog?'hand:'+dog.u:null,targets:dog?[`[data-action="hand:${dog.u}"]`]:[]},
    {number:3,title:'Claim your Unity bonus',text:'Three Dark Carnival cards are in play. Claim their Unity benefit for 2 extra Karma. You can claim one Unity benefit per turn.',detail:'Dark Carnival: +2 Karma · Psychopathic: draw 1 card · Underground: draw Flavor',label:'Claim Unity',action:'unity',targets:['[data-action="unity"]','.unity']},
    {number:4,title:'Recruit from the Gallery',text:'You have 4 Karma. Recruit The Loons for 2. This card gives 2 Karma when you play it and is worth 1 Gathering Point at the end of the game.',detail:'New Crew cards go to your discard pile. When your deck runs out, shuffle the discard pile to build your next deck.',label:'Inspect The Loons',action:'market:gallery:'+gallery('c1430'),targets:[`[data-action="market:gallery:${gallery('c1430')}"]`]},
    {number:5,title:'Keep a Fiend at your side',text:'Spend your remaining 2 Karma on Drainer Road Monks. Fiends enter play immediately and stay between turns. This one can stop an opponent’s card.',detail:'The Loons is now in your discard pile. Your deck is already worth 1 GP more.',label:'Inspect Drainer Road Monks',action:'market:gallery:'+gallery('c2823'),targets:[`[data-action="market:gallery:${gallery('c2823')}"]`]},
    {number:6,title:'End your turn',text:'Your Karma is spent. End your turn to discard played cards and draw a new five-card hand. Empty Gallery spaces refill, and the Void takes its turn.',detail:'Your Fiend stays in play. Watch for a chance to use it during the opponent’s turn.',label:'End turn',action:'end',targets:['.side [data-action="end"]','.inplay']},
    {number:7,title:'Interrupt with a stomp',text:'When the Void plays a card, a reaction window opens. Choose “Stomp with Drainer Road Monks” to stop that card’s effect.',detail:'Stomping abolishes your Fiend to the Abyss. Ordinary stomps cannot stop a shielded card.',label:'Waiting for the Void…',action:null,targets:['.inplay']},
    {number:7,title:'A successful stomp',text:'Drainer Road Monks is in the Abyss, and the card you stomped gave the Void no benefit. Let the Void finish its turn.',detail:'Abolished cards leave your deck. You can inspect them in the Abyss.',label:'The Void is finishing…',action:null,targets:['[data-action="abyss"]']},
    {number:8,title:'You’re ready for the Echoside',text:'It’s your turn again. Play cards, claim Unity, recruit, then end your turn. The Loons joins your draws after your discard pile shuffles into a new deck.',detail:'Aim for Gathering Points. You may buy one Epic each turn. When a shared main or Epic deck runs out, finish with equal turns and score every card you own.',label:'Continue this match',action:'tutorial-finish',targets:['.hand-area']}
  ];
  return lessons[step];
}

export function renderTutorial(g,busy=false,pending=false) {
  if(!g?.tutorial?.active)return '';
  const l=tutorialLesson(g);
  return `<section class="tutorial-coach" aria-labelledby="tutorial-title">
    <div class="tutorial-progress"><span class="tutorial-sigil" aria-hidden="true">✦</span><div><b>LEARN TO PLAY</b><span>${l.number===0?'GUIDED FIRST GAME':l.number===8?'LESSON COMPLETE':`LESSON ${l.number} OF 8`}</span></div><progress value="${l.number}" max="8" aria-label="Tutorial progress">${l.number} of 8</progress></div>
    <div class="tutorial-copy"><h2 id="tutorial-title" tabindex="-1">${l.title}</h2><p id="tutorial-instruction">${l.text}</p><p class="tutorial-detail">${l.detail}</p></div>
    <div class="tutorial-controls"><button class="primary" data-action="${l.action||'none'}" ${!l.action||busy||pending?'disabled':''}>${pending?'Choose in the card window':l.label}</button><div>${l.targets?.length&&l.action?'<button class="ghost" data-action="tutorial-locate">Find on table</button>':''}<button class="ghost" data-action="tutorial-skip" ${busy?'disabled':''}>Leave guide</button></div></div>
  </section>`;
}

export function highlightTutorial(g) {
  document.body.classList.toggle('is-tutorial',!!g?.tutorial?.active);
  if(!g?.tutorial?.active)return;
  for(const selector of tutorialLesson(g).targets||[]){
    for(const target of document.querySelectorAll('#app .shell '+selector)){
      target.classList.add('tutorial-target');
      target.setAttribute('aria-describedby','tutorial-instruction');
    }
  }
}

export function locateTutorialTarget(g) {
  if(!g?.tutorial?.active)return;
  for(const selector of tutorialLesson(g).targets||[]){
    const target=[...document.querySelectorAll('#app .shell '+selector)].find(t=>t.getClientRects().length);
    if(target){target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});target.focus({preventScroll:true});return;}
  }
}

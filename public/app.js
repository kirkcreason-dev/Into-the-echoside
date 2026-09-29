import {
  renderTutorial,
  highlightTutorial,
  locateTutorialTarget,
} from "./tutorial.js";
let DB = [],
  DEF = {},
  G = null,
  room = null,
  connected = true,
  pollTimer,
  botTimer,
  lastPrompt = "",
  recent = [];
const PAGES = !!window.echosidePages;
const safeLog = (s) => esc(s).replace(/&lt;(\/?)b&gt;/g, "<$1b>");
const TYPE_META = {
  DC: { label: "Dark Carnival", color: "var(--dc)" },
  PSY: { label: "Psychopathic", color: "var(--psy)" },
  UG: { label: "Underground", color: "var(--ug)" },
  ITEM: { label: "Item", color: "var(--item)" },
  FIEND: { label: "Fiend", color: "var(--fiend)" },
  EPIC: { label: "Epic", color: "var(--epic)" },
  FLAVOR: { label: "Flavor", color: "var(--flavor)" },
  JUG: { label: "Juggalo", color: "var(--jug)" },
  START: { label: "Starter", color: "var(--start)" },
  GAMBIT: { label: "Gambit", color: "#84b954" },
  TAROT: { label: "Tarot", color: "var(--fiend)" },
};
const CREWS = ["DC", "PSY", "UG"];
const me = () => G?.players[room.seat];
const scoreGP = (p) => p?.gp || 0;
const crewOf = (c) =>
  c.crewOverride || c.d.crew || (CREWS.includes(c.d.t) ? c.d.t : null);
const crewCounts = (p) => {
  const n = { DC: 0, PSY: 0, UG: 0 };
  [...p.inPlay, ...p.items, ...p.fiends].forEach((c) => {
    const t = crewOf(c);
    if (t) n[t]++;
  });
  return n;
};
const unityReady = (p) =>
  p.unityUsed
    ? null
    : CREWS.filter((t) => crewCounts(p)[t] >= 3).length
      ? CREWS.filter((t) => crewCounts(p)[t] >= 3)
      : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const el = (id) => document.getElementById(id),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let art = {},
  sound = (() => { try { return localStorage.getItem("echoside-sound") === "on"; } catch { return false; } })(),
  busy = false,
  view = "table",
  lastFocus = null,
  choiceRequired = false;

const icons = {
  DC: "✥",
  PSY: "✦",
  UG: "✶",
  ITEM: "◇",
  FIEND: "♜",
  EPIC: "✧",
  START: "◈",
  JUG: "✥",
  FLAVOR: "❖",
  TAROT: "☽",
  GAMBIT: "✦",
};
function button(label, action, cls = "", disabled = false) {
  return `<button class="${cls}" data-action="${action}" ${disabled ? "disabled" : ""}>${label}</button>`;
}
function card(c, action = "", cls = "") {
  if (c?.hiddenBy)
    return '<button class="empty-slot" disabled>Facedown<br>Cannot be obtained</button>';
  if (!c) return '<div class="empty-slot">Draws at<br>end of turn</div>';
  const d = c.d || c,
    m = TYPE_META[d.t] || TYPE_META.START;
  return `<button class="card ${cls}" style="--card-color:${m.color}" data-action="${action || "detail:" + d.id}" ${action.startsWith("server-pick:") ? 'aria-pressed="false"' : ""} aria-label="${esc(d.n)}${d.t === "JUG" ? " · " + TYPE_META[d.crew].label : ""}. ${d.t === "GAMBIT" ? d.draftCost + " draft points" : (d.cost || 0) + " Karma"}. ${d.gp || 0} Gathering Points.">${art[d.id] ? `<img class="scan" src="assets/cards/${art[d.id]}.jpg" alt="${esc(d.n)}" loading="lazy">` : `<span class="card-portrait"><span class="card-cost">${d.t === "GAMBIT" ? d.draftCost : (d.cost ?? "✦")}</span><span class="card-emblem">${icons[d.t]}</span></span><span class="card-name">${esc(d.n)}</span><span class="card-type">${m.label}</span><span class="card-effect">${esc(d.txt)}</span><span class="card-bottom"><b>${d.gp || 0} GP</b><span>${d.shield ? "Shield" : "◈"}</span></span>`}</button>`;
}
function modal(title, body, wide = false, required = false) {
  const d = el("modal");
  lastFocus = document.activeElement;
  choiceRequired = required;
  d.className = wide ? "wide" : "";
  d.innerHTML = `${required ? "" : button("×", "close", "dialog-close")}<h2 id="modalTitle">${title}</h2>${body}`;
  if (!d.open) d.showModal();
  el("modalTitle").tabIndex = -1;
  el("modalTitle").focus();
}
function close() {
  if (choiceRequired) return;
  el("modal").close();
  lastFocus?.focus?.();
}
function zoomCard(d) {
  if (!d) return;
  const dialog = el("card-zoom");
  dialog.innerHTML = `${button("Close enlarged card", "zoom-close", "dialog-close")}<h2 id="zoomTitle">${esc(d.n)}</h2><div class="zoom-layout">${art[d.id] ? `<img src="assets/cards/${art[d.id]}.jpg" alt="Printed ${esc(d.n)} card">` : `<div class="zoom-gambit">${card(d, "none")}</div>`}<div><span class="pill">${TYPE_META[d.t].label}${d.t === "JUG" ? " · " + TYPE_META[d.crew].label : ""}</span><p class="rules-text">${esc(d.txt)}</p><p>${d.t === "GAMBIT" ? `${d.draftCost} draft points · one use` : `${d.cost || 0} Karma · ${d.gp || 0} Gathering Points`}</p>${d.descriptiveName ? '<p class="tiny">Descriptive label: the printed name has not yet been verified.</p>' : ""}</div></div>`;
  if (!dialog.open) dialog.showModal();
}
function reactionContext(q) {
  return q.contextCards?.length ? `<p class="reaction-help">${esc(q.sub || "Review the cards before responding. Passing lets the announced action continue.")}</p><div class="reaction-cards">${q.contextCards.map(c => `<button data-action="zoom:${c.id}"><b>${esc(c.d.n)}</b><span>${esc(c.d.txt)}</span><small>Enlarge card</small></button>`).join("")}</div>` : "";
}
function variantForm() {
  return `<details class="variant-form"><summary>Optional variants</summary><label class="check"><input type="checkbox" id="variant-army" disabled> Juggalo Army · Oracle</label><p>Replace three starters with Juggalos, drafted one at a time in three rounds.</p><label class="check"><input type="checkbox" id="variant-abolish"> Abolish Made Easy</label><p>Replace any Unity benefit by abolishing a card from your hand or discard.</p><label class="check"><input type="checkbox" id="variant-mirrors"> House of Mirrors</label><p>Reveal the top Main, Epic and Flavor cards throughout the game.</p><label class="form-label" for="variant-epics">A Matter of Time · total Epic cards</label><input id="variant-epics" type="number" min="0" max="12" placeholder="Standard for this player count"><label class="check"><input id="variant-main" type="checkbox"> Continue until the Main Deck runs out</label><p>Zero Epics automatically uses the Main Deck ending.</p><label class="form-label" for="variant-relic">Relic of Power</label><select id="variant-relic"><option value="">No Relic</option><option value="random">Random Item</option>${DB.filter(d => d.t === "ITEM" && d.id !== "c2512" && d.set !== "promo").map(d => `<option value="${d.id}" ${d.set === "oracle" ? "disabled" : ""}>${esc(d.n)}${d.set === "oracle" ? " · Oracle" : ""}</option>`).join("")}</select><p>Everyone uses the Relic during their own turn. It cannot be taken, discarded, abolished or targeted.</p></details>`;
}
function variantTable(mine) {
  const v = G.variants || {};
  return `${v.abolishUnity || v.epicCount != null || v.mainOnly || v.mirrors || v.relic || v.juggaloArmy ? `<div class="variant-strip">${button("Table variants", "variant-info", "ghost")}${v.juggaloArmy ? '<span>Juggalo Army</span>' : ""}${v.abolishUnity ? '<span>Abolish Made Easy</span>' : ""}${v.epicCount != null || v.mainOnly ? '<span>A Matter of Time</span>' : ""}</div>` : ""}${v.mirrors ? `<section class="mirror-tops" aria-label="House of Mirrors"><b>House of Mirrors</b>${[["Main", G.main], ["Epic", G.epicDeck], ["Flavor", G.flavor]].map(([name, cards]) => cards.at(-1) ? button(`${name}: ${esc(cards.at(-1).d.n)}`, "zoom:" + cards.at(-1).id) : `<span>${name}: empty</span>`).join("")}</section>` : ""}${G.relic ? `<section class="relic-area"><div><span class="eyebrow">Relic of Power</span><h3>${esc(G.relic.d.n)}</h3><p>${esc(G.relic.d.txt)}</p></div>${button("Inspect Relic", "relic")}${G.relic.d.active ? button(G.relic.tilted ? "Used this turn" : "Activate Relic", "activate-relic", "primary", !mine || G.relic.tilted) : '<span class="pill">Applies during your turn</span>'}</section>` : ""}`;
}
function variantInfo() {
  const v = G?.variants || room?.variants || {};
  modal("Table variants", `<p><b>Gambits:</b> ${(G?.gambitsEnabled ?? room?.gambits) ? "On. Ten private choices and a three-point budget per player." : "Off"}</p><p><b>Juggalo Army:</b> ${v.juggaloArmy ? "On. Each player replaces three starters with three Juggalos before drawing their opening hand. A separate die roll chooses who drafts first." : "Off"}</p><p><b>Abolish Made Easy:</b> ${v.abolishUnity ? "On. A Unity benefit may be replaced with abolishing one non-Flavor card from hand or discard." : "Off"}</p><p><b>A Matter of Time:</b> ${v.epicCount == null ? "Standard Epic count" : v.epicCount + " Epic cards"}. ${v.mainOnly ? "Only the Main Deck ending applies." : "Main or Epic exhaustion triggers the final round."} Players still finish with equal turns.</p><p><b>House of Mirrors:</b> ${v.mirrors ? "On. Only the top Main, Epic and Flavor cards are revealed." : "Off"}</p><p><b>Relic of Power:</b> ${G?.relic ? esc(G.relic.d.n) + ". Available during each player's turn; never owned or scored. Effects requiring its removal cannot be used." : v.relic ? "Selected at setup" : "Off"}</p>`);
}
function inspect(c, buttons = "") {
  const d = c.d || c;
  modal(
    esc(d.n),
    `<div class="detail">${card(c, "zoom:" + d.id)}<div><span class="pill">${TYPE_META[d.t]?.label || d.t} · ${d.gp || 0} GP</span><p class="rules-text">${esc(d.txt)}</p>${button("Enlarge card", "zoom:" + d.id, "ghost")}<div class="tiny">${(d.t === "GAMBIT" ? "Verified effect · " + (d.descriptiveName ? "Descriptive name · " : "") : "Printed card scan · ") + (d.set === "oracle" ? "Oracle of the Three Rings" : d.set === "promo" ? "Promo" : "Base game")}</div></div></div>${buttons ? `<div class="dialog-actions">${buttons}</div>` : ""}`,
  );
}
const UI = {
  render() {
    if (!G) return;
    const p = me(),
      q = G.players.find((_, i) => i !== room.seat),
      mine = G.active === room.seat && !G.over && !room.pending && !busy;
    const counts = crewCounts(p);
    el("app").innerHTML =
      `<header><div class="brand"><div class="sigil"><span>E</span></div><div><small>Into the</small><strong>ECHOSIDE</strong></div></div><nav class="header-actions" aria-label="Game navigation">${button("Card library", "library", "ghost hide-mobile")}${button("How to play", "rules", "ghost")}${button(sound ? "Sound on" : "Sound off", "sound", "ghost")}${button("Table menu", "table-menu", "")}</nav></header>${renderTutorial(G, busy, !!room.pending)}<div class="shell"><aside class="rail"><div class="eyebrow">The game table</div><h2>Welcome to<br>the Echoside.</h2><span class="mode-label">${G.expansion ? "ORACLE · CARD SET" : G.advanced === false ? "BASE GAME · BEGINNER" : "BASE GAME · ADVANCED"}</span><p class="muted">Build your army.<br>Claim the Carnival.</p><div class="ruleline"></div><div class="eyebrow">Your table</div>${button("◈   Play vs the Void", "new", "nav-button")}${button("◇   Online multiplayer", "online", "nav-button")}${button("❖   Card library", "library", "nav-button")}${button("☽   Oracle expansion", "expansion", "nav-button")}${button("≡   Match journal", "journal", "nav-button")}${button("Table & recovery", "table-menu", "nav-button")}<div class="ruleline"></div><div class="eyebrow">Gathering points</div><div class="stat">${scoreGP(p)} <small>GP</small></div><p class="tiny">The strongest deck wins.</p><div class="rail-foot">DIGITAL GAME TABLE<br>${G.expansion ? (G.gambitsEnabled ? "Oracle · 40 Gambits" : "Oracle · No Gambits") : "Printed card data"}</div></aside><main class="center"><div class="table-strip"><span>TABLE ${room.code}</span>${room.deadline?'<span data-table-clock role="timer"></span>':''}<span>${room.members.length} PLAYERS${G.teams ? " · TEAMS" : ""} ${G.endTriggered ? " · FINAL ROUND" : ""}</span></div><div class="opponent"><div class="opponent-name"><div class="avatar">N</div><div><div class="name">${esc(q.name)}</div><div class="tiny">${q.deck.length} in deck · ${q.discard.length} discarded</div></div></div><div class="opponent-cards">${q.hand.map(() => '<span class="back-card"></span>').join("")}</div><div class="stat">${q.gp} <small>GP</small></div></div>${room.pending && room.pending.actor !== room.seat ? `<div class="waiting-choice" role="status">Waiting for ${esc(room.members[room.pending.actor].name)} to resolve a card effect.</div>` : ""}${G.players.length > 2 ? `<div class="other-players">${G.players.map((q, i) => (i === room.seat ? "" : `<button data-action="player:${i}" class="${G.active === i ? "active" : ""}">${esc(q.name)} · ${q.gp} GP${G.teams ? (i % 2 === room.seat % 2 ? " · ALLY" : " · RIVAL") : ""}</button>`)).join("")}</div>` : ""}<div class="section-head"><h2>THE EPIC TIER</h2><span>One Epic purchase per turn</span></div><div class="epic-layout"><div class="deck-mark"><b>${G.epicDeck.length}</b><span>EPICS</span></div>${G.epicTier.map((c, i) => card(c, "market:epic:" + i, mine && c && p.karma >= c.d.cost ? "afford" : "")).join("")}</div><div class="section-head"><h2>THE GALLERY</h2><span>${G.main.length} cards in the main deck</span></div><div class="gallery">${G.gallery.map((c, i) => card(c, "market:gallery:" + i, mine && c && p.karma >= c.d.cost ? "afford" : "")).join("")}</div>${variantTable(mine)}${G.extraGallery?.length ? `<div class="section-head"><h2>THE BUTTERFLY</h2></div><div class="gallery">${G.extraGallery.map((c) => card(c, "extra:" + c.u)).join("")}</div>` : ""}<div class="inplay"><span class="inplay-label">IN PLAY</span>${[...p.items, ...p.fiends, ...p.inPlay].map((c) => button(esc(c.d.n), `permanent:${c.u}`, "mini")).join("") || '<span class="tiny">Your played cards, Items & Fiends gather here.</span>'}</div>${p.gambits?.length ? `<section class="gambit-area"><div class="section-head"><h2>YOUR GAMBITS</h2><span>Private · one use each</span></div><div class="gambit-list">${p.gambits.map((c) => button(esc(c.d.n) + (c.d.timing === "end_game" ? " · " + c.d.gp + " GP" : ""), "gambit:" + c.u, "mini")).join("")}</div></section>` : ""}<section class="hand-area"><div class="hand-head"><h2>YOUR HAND <span class="muted">· ${p.hand.length}</span></h2>${button("Play Ninjas", "ninjas", "ghost", !mine || !p.hand.some((c) => c.id === "c1203"))}</div><div class="hand">${p.hand.map((c) => card(c, "hand:" + c.u)).join("") || '<p class="muted">Your hand is empty. Spend your Karma, then end your turn.</p>'}</div><p class="hint">${mine ? "Select a card to inspect or play it." : G.players[G.active].isAI ? "The Void is thinking." : esc(G.players[G.active].name) + " is taking their turn."}</p><div class="mobile-tools">${button("Juggalos · 3 Karma", "juggalo")}${button("Your discard", "discard")}${button("The Abyss", "abyss")}${button("Card library", "library")}${button("Match journal", "journal")}${button("Table menu", "table-menu")}${unityReady(p) ? button("Claim Unity", "unity", "primary", !mine) : ""}</div></section></main><aside class="side"><div class="turn"><b>${room.pending ? "RESOLVING A CHOICE" : mine ? "YOUR TURN" : "OPPONENT TURN"}</b><span>ROUND ${Math.ceil(G.turnN / G.players.length)}</span>${room.deadline ? '<span data-table-clock role="timer"></span>' : ""}</div><div class="karma"><div class="eyebrow">Available Karma</div><strong>${p.karma}</strong><p>Spend it before your turn ends.</p></div>${button("End turn", "end", "primary", !mine || busy)}<div class="unity"><div class="eyebrow">Unity benefits</div>${CREWS.map((t) => `<div class="unity-row"><span>${TYPE_META[t].label}</span>${[0, 1, 2].map((i) => `<i class="pip ${counts[t] > i ? "on" : ""}"></i>`).join("")}</div>`).join("")}${unityReady(p) ? button("Claim Unity", "unity", "", !mine) : '<p class="tiny">Play 3 of one crew to unlock.</p>'}</div><div class="side-extras"><div class="ruleline"></div><div class="eyebrow">The reserves</div><div class="supply">${button(`<b>${G.jug.length}</b>Juggalos · 3 Karma`, "juggalo")}${button(`<b>${p.deck.length}</b>Your deck`, "deck")}${button(`<b>${p.discard.length}</b>Your discard`, "discard")}${button(`<b>${G.abyss.length}</b>The Abyss`, "abyss")}</div><div class="ruleline"></div><div class="eyebrow">Last at the table</div><div class="last-event">${safeLog(G.log.slice(-1)[0] || "The Gallery is open. Your first hand is dealt.")}</div>${button("View journal", "journal", "ghost")}</div></aside></div><footer class="footer"><span><i class="status-dot"></i> ${room.code} · ${room.hosting === "local" ? "Saved on this device" : connected ? (PAGES ? "Connected · keep host tab open" : "Connected") : PAGES ? "Waiting for host" : "Reconnecting"}</span><span class="development">${G.expansion ? (G.gambitsEnabled ? "Oracle · Gambits enabled" : "Oracle · No Gambits") : "Base game · Advanced rules"}</span></footer>`;
    highlightTutorial(G);
  },
  toast(s) {
    el("toast").textContent = s.replace(/<[^>]*>/g, "");
    el("toast").classList.add("show");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => el("toast").classList.remove("show"), 2800);
  },
  logChanged() {},
  banner: async (s) => UI.toast(s),
  choice(title, labels) {
    return new Promise((resolve) => {
      modal(
        esc(title),
        `<div class="choices">${labels.map((s, i) => button(esc(s), "choose:" + i)).join("")}</div>`,
        false,
        true,
      );
      UI.resolveChoice = (v) => {
        choiceRequired = false;
        close();
        resolve(v);
      };
    });
  },
  pick(opts) {
    return new Promise((resolve) => {
      let selected = [];
      const min = opts.min || 0;
      modal(
        esc(opts.title),
        `<p>${esc(opts.sub || "Choose the cards to use.")}</p><div class="card-grid">${opts.cards.map((c) => card(c, "pick:" + c.u)).join("")}</div>${button("Confirm selection", "confirm-pick", "primary", min > 0)}`,
        true,
        true,
      );
      UI.pickCard = (id) => {
        const c = opts.cards.find((x) => x.u === id);
        if (selected.includes(c)) selected = selected.filter((x) => x !== c);
        else if (selected.length < opts.max) selected.push(c);
        el("modal")
          .querySelectorAll('[data-action^="pick:"]')
          .forEach((b) =>
            b.classList.toggle(
              "selected",
              selected.some((c) => "pick:" + c.u === b.dataset.action),
            ),
          );
        el("modal").querySelector('[data-action="confirm-pick"]').disabled =
          selected.length < min;
      };
      UI.confirmPick = () => {
        if (selected.length < min) return;
        choiceRequired = false;
        close();
        resolve(selected);
      };
    });
  },
  async showWheel(p, roll) {
    modal(
      "The Wheel of Fate",
      `<div class="wheel-result">${roll}</div><p style="text-align:center">${esc(WHEEL[roll].t)}</p>`,
      false,
      true,
    );
    await sleep(2000);
    choiceRequired = false;
    close();
  },
  gameOver(winner, sa, sb) {
    modal(
      winner === me()
        ? "The Carnival is yours."
        : winner
          ? "The Void prevails."
          : "A dead heat.",
      `<div class="scoreboard"><div>You<strong>${sa}</strong>Gathering points</div><div>The Void<strong>${sb}</strong>Gathering points</div></div>${button("Play again", "restart", "primary")}`,
    );
    this.render();
  },
};
async function api(path, body) {
  if (PAGES) return window.echosidePages.api(path, body);
  const r = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error("The game service is unavailable. Please try again.");
  }
  if (!r.ok) {
    const e = Error(data.error || "The action failed.");
    e.status = r.status;
    throw e;
  }
  return data;
}
function accept(data, force = false) {
  const changed =
    force ||
    !room ||
    room.revision !== data.revision ||
    room.code !== data.code;
  const presenceChanged =
    JSON.stringify(room?.members) !== JSON.stringify(data.members);
  if (changed && room && data.game) {
    if (data.pending?.actor === data.seat) tone(620);
    else if (room.game?.active !== data.game.active && data.game.active === data.seat) tone(520);
  }
  room = data;
  recent = [
    { code: data.code, status: data.status },
    ...recent.filter((r) => r.code !== data.code),
  ].slice(0, 10);
  G = data.game;
  if (G?.jug && !Array.isArray(G.jug))
    G.jug =
      G.jug.cards ||
      (G.jug.count
        ? Array(G.jug.count - 1)
            .fill(null)
            .concat(G.jug.top)
        : []);
  connected = true;
  if (changed) {
    lastPrompt = "";
    if (!data.pending || data.pending.actor !== data.seat) {
      choiceRequired = false;
      if (el("modal").open) close();
    }
    if (data.status === "lobby") lobby();
    else if (G) {
      UI.render();
      if (G.over) results();
    }
  }
  if (!changed && presenceChanged && data.status === "lobby") lobby();
  showPending();
  schedule();
}
function schedule() {
  clearTimeout(pollTimer);
  clearTimeout(botTimer);
  if (!room || view === "home") return;
  pollTimer = setTimeout(poll, 1600);
  if (room.deadline && Date.now() >= room.deadline && !busy) {
    botTimer = setTimeout(() => send(null, "timeout"), 100);
    return;
  }
  if (room.deadline) {
    const seconds = Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000));
    document.querySelectorAll("[data-table-clock]").forEach(clock=>clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} to act`);
  }

  if (
    room.status === "playing" &&
    G &&
    !room.pending &&
    G.players[G.active].isAI &&
    !busy
  )
    botTimer = setTimeout(() => send(null, "bot"), 600);
}
async function poll() {
  if (!room) return;
  try {
    const data = await api("rooms/" + room.code);
    if (!busy && view !== "home") accept(data);
    else schedule();
  } catch (e) {
    connected = false;
    if (G && view !== "home") UI.render();
    clearTimeout(pollTimer);
    pollTimer = setTimeout(poll, 4000);
  }
}
async function send(action, route = "action", answer) {
  if (busy || !room) return;
  busy = true;
  clearTimeout(botTimer);
  try {
    const b = { revision: room.revision };
    if (action) b.action = action;
    if (route === "choice") b.answer = answer;
    const data = await api(`rooms/${room.code}/${route}`, b);
    if (!data.pending) {
      choiceRequired = false;
      close();
    }
    accept(data);
    tone(route === "choice" ? 480 : 640);
  } catch (e) {
    UI.toast(e.message);
    if (e.status === 409) await poll();
  } finally {
    busy = false;
    if (G && !G.over) UI.render();
    showPending();
    if (G?.tutorial?.active && !room.pending)
      el("tutorial-title")?.focus({ preventScroll: true });
    schedule();
  }
}
function showPending() {
  const q = room?.pending;
  if (!q || q.actor !== room.seat) return;
  const key = room.code + ":" + room.revision;
  if (lastPrompt === key) return;
  lastPrompt = key;
  if (q.kind === "option") {
    modal(
      esc(q.title),
      `${reactionContext(q)}${q.tutorialHint ? `<div class="tutorial-prompt"><span class="eyebrow">LEARN TO PLAY</span><p>${esc(q.tutorialHint)}</p></div>` : ""}<div class="choices">${q.labels.map((s, i) => button(esc(s), "server-choice:" + i, q.tutorialChoice === i ? "primary" : "", q.tutorialChoice !== undefined && q.tutorialChoice !== i)).join("")}</div>${q.tutorialHint ? button("Leave guide and play freely", "tutorial-skip", "ghost") : ""}`,
      false,
      true,
    );
  } else if (q.kind === "cards") {
    let selected = [];
    const armyRecruit = G?.phase === "army" && q.max === 1 && q.cards.every(c => c.d.t === "JUG");
    const choices = armyRecruit ? q.cards.filter((c, i, list) => list.findIndex(x => x.id === c.id) === i) : q.cards;
    modal(
      esc(q.title),
      `<p>${esc(q.sub || "Choose the cards to use.")} ${q.min === 0 ? "You may skip this effect." : ""}</p>${q.budget != null ? `<p id="draft-budget" class="draft-budget">0 / ${q.budget} draft points</p>` : ""}<div class="card-grid">${choices.map((c) => `<div class="choice-card">${card(c, "server-pick:" + c.u)}${armyRecruit ? `<p class="choice-caption">${TYPE_META[c.d.crew].label} · ${q.cards.filter(x => x.id === c.id).length} available</p>` : ""}${button("Read " + esc(c.d.n) + (c.d.t === "JUG" ? " · " + TYPE_META[c.d.crew].label : ""), "zoom:" + c.id, "read-card")}</div>`).join("")}</div>${button("Confirm selection", "server-confirm", "primary", q.min > 0)}`,
      true,
      true,
    );
    UI.serverPick = (id) => {
      if (selected.includes(id)) selected = selected.filter((x) => x !== id);
      else if (
        selected.length < q.max &&
        (q.budget == null ||
          [...selected, id].reduce(
            (sum, uid) => sum + q.cards.find((c) => c.u === uid).d.draftCost,
            0,
          ) <= q.budget)
      )
        selected.push(id);
      if (q.budget != null)
        el("draft-budget").textContent =
          selected.reduce(
            (sum, uid) => sum + q.cards.find((c) => c.u === uid).d.draftCost,
            0,
          ) +
          " / " +
          q.budget +
          " draft points";
      el("modal")
        .querySelectorAll('[data-action^="server-pick:"]')
        .forEach((b) =>
          { const picked = selected.includes(+b.dataset.action.split(":")[1]); b.classList.toggle("selected", picked); b.setAttribute("aria-pressed", String(picked)); },
        );
      el("modal").querySelector('[data-action="server-confirm"]').disabled =
        selected.length < q.min;
    };
    UI.serverConfirm = () => send(null, "choice", selected);
  }
}
function tone(f) {
  if (!sound) return;
  try {
    const ctx = UI.audio || (UI.audio = new AudioContext());
    if (ctx.state === "suspended") ctx.resume();
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(f, ctx.currentTime);
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.14);
  } catch {}
}
function titlebar() {
  return `<header><div class="brand"><div class="sigil"><span>E</span></div><div><small>Into the</small><strong>ECHOSIDE</strong></div></div><nav class="header-actions">${button("Card library", "library", "ghost")}${button("How to play", "rules", "ghost")}${G ? button("Table variants", "variant-info") : ""}${button("Physical playtest kit", "playtest-kit")}${room ? button("Return to table", "return", "primary") : ""}</nav></header>`;
}
function home() {
  view = "home";
  document.body.classList.remove("is-tutorial");
  clearTimeout(pollTimer);
  clearTimeout(botTimer);
  el("app").innerHTML =
    titlebar() +
    `<main class="lobby-home"><div class="lobby-cover"><img src="assets/hero.jpg" alt="Into the Echoside game artwork"><div class="cover-caption">THE DARK CARNIVAL AWAITS</div></div><div class="lobby-intro"><div class="eyebrow">A gathering of your own</div><h1>Enter the<br>Echoside.</h1><p>Build your deck. Stomp your rivals.<br>Lead the army of Shangri-La.</p><div class="start-actions">${button("Learn to play · guided game", "tutorial-start", "tutorial-start")}${button("Oracle · guided practice", "oracle-practice")}${button("Play against the Void", "setup-solo", "primary")}${button("Create an online room", "setup-online")}${button("Join with a room code", "join", "ghost")}${PAGES ? button("Restore a game or seat", "table-menu", "ghost") : ""}</div><div class="lobby-tags"><span>2–4 PLAYERS</span><span>ORIGINAL CARD ART</span><span>ORACLE CARD SET</span></div>${
      recent.length
        ? `<div class="recent"><div class="eyebrow">Return to a table</div>${recent
            .slice(0, 3)
            .map((r) =>
              button(
                r.code +
                  " · " +
                  (r.status === "lobby"
                    ? "Waiting room"
                    : r.status === "complete"
                      ? "Finished"
                      : "In progress"),
                "resume:" + r.code,
                "recent-room",
              ),
            )
            .join("")}</div>`
        : ""
    }<p class="edition-note">Community digital adaptation with the base game, Oracle, team play and 40 Gambits. Not an official publisher release.</p></div></main><footer class="footer"><span>Into the Echoside · Original game by Jumpsteady & Louis Simpson</span><span>Artwork credited to Tom Wood</span></footer>`;
}
function setup(solo) {
  modal(
    solo ? "Play against the Void" : "Create an online room",
    `<p>${solo ? "A complete match against the AI." : PAGES ? "Your browser hosts this table. Keep this tab open while everyone plays. Share the room code to invite friends." : "Start a private table, then share its code with your friends."}</p><label class="form-label" for="player-name">Your name</label><input id="player-name" maxlength="24" value="${esc(me()?.name || "Ninja")}" autocomplete="nickname"><label class="form-label" for="game-set">Card set</label><select id="game-set"><option value="base">Base game · advanced</option><option value="basic">Base game · beginner (no Fiends)</option><option value="oracle">Base + Oracle cards</option></select><div id="oracle-options" hidden><label class="check"><input type="checkbox" id="game-gambits" checked> Include Gambits</label><p class="tiny">An optional private draft before the game. Turn off to play Oracle without Gambits.</p></div>${PAGES ? `<label class="form-label" for="game-teams">Players</label><select id="game-teams"><option value="free">Every player for themselves</option><option value="teams">2 vs 2 · partners across the table</option></select>${!solo ? '<label class="form-label" for="game-clock">Time to make a move or choice</label><select id="game-clock"><option value="180">3 minutes</option><option value="300">5 minutes</option><option value="120">2 minutes</option><option value="0">No timer</option></select><p class="tiny">When time runs out, the table passes or confirms a required minimum choice.</p>' : ""}` : ""}${variantForm()}<p class="tiny">${solo ? (PAGES ? "Your match saves on this device." : "Your match is saved to this browser’s session.") : "2–4 human players · shared game state · private hands"}</p><div class="dialog-actions">${button(solo ? "Deal me in" : "Create room", solo ? "create-solo" : "create-online", "primary")}${button("Cancel", "close", "ghost")}</div>`,
  );
}
document.addEventListener("change", e => {
  if (e.target.id !== "game-set") return;
  const expansion = e.target.value === "oracle", advanced = e.target.value !== "basic";
  for (const option of el("variant-relic").options) {
    const d = DEF[option.value];
    option.disabled = !!d && ((!expansion && d.set === "oracle") || (!advanced && ["axe", "toy"].includes(d.passive)));
  }
  if (el("variant-relic").selectedOptions[0]?.disabled) el("variant-relic").value = "";
  el("variant-epics").max = expansion ? 15 : 12;
  el("oracle-options").hidden = !expansion;
  el("variant-army").disabled = !expansion;
  if (!expansion) el("variant-army").checked = false;
});
async function create(solo, tutorial = false) {
  if (busy) return;
  busy = true;
  const trigger = document.querySelector(
      '[data-action="' +
        (tutorial ? "tutorial-start" : solo ? "create-solo" : "create-online") +
        '"]',
    ),
    label = trigger?.textContent;
  if (trigger) {
    trigger.disabled = true;
    trigger.textContent =
      PAGES && !solo ? "Connecting your room…" : "Dealing cards…";
  }
  try {
    const name = tutorial ? me()?.name || "Ninja" : el("player-name").value,
      expansion = !tutorial && el("game-set").value === "oracle";
    const data = await api("rooms", {
      name,
      expansion,
      gambits: expansion && el("game-gambits")?.checked,
      solo,
      tutorial,
      advanced: tutorial || el("game-set")?.value !== "basic",
      teams: !tutorial && el("game-teams")?.value === "teams",
      turnSeconds: tutorial ? 0 : Number(el("game-clock")?.value || 0),
      variants: tutorial ? {} : {
        juggaloArmy: expansion && el("variant-army").checked,
        abolishUnity: el("variant-abolish").checked, mirrors: el("variant-mirrors").checked,
        mainOnly: el("variant-main").checked, epicCount: el("variant-epics").value === "" ? null : Number(el("variant-epics").value), relic: el("variant-relic").value || null,
      },
    });
    choiceRequired = false;
    close();
    view = "table";
    history.replaceState(
      null,
      "",
      new URL("?room=" + data.code, location.href).href,
    );
    accept(data);
  } catch (e) {
    UI.toast(e.message);
  } finally {
    busy = false;
    if (trigger?.isConnected) {
      trigger.disabled = false;
      trigger.textContent = label;
    }
    if (view === "table" && G) UI.render();
    showPending();
    schedule();
  }
}
function joinForm(code = "") {
  modal(
    "Join a gathering",
    `<label class="form-label" for="join-name">Your name</label><input id="join-name" maxlength="24" value="Ninja" autocomplete="nickname"><label class="form-label" for="room-code">Room code</label><input id="room-code" maxlength="8" placeholder="8-character room code" value="${esc(code)}" autocapitalize="characters" spellcheck="false"><div class="dialog-actions">${button("Join room", "join-submit", "primary")}${button("Cancel", "close", "ghost")}</div>`,
  );
}
async function joinRoom() {
  if (busy) return;
  const code = el("room-code").value.trim().toUpperCase(),
    name = el("join-name").value;
  busy = true;
  try {
    const data = await api("rooms/" + code + "/join", { name });
    close();
    view = "table";
    history.replaceState(
      null,
      "",
      new URL("?room=" + data.code, location.href).href,
    );
    accept(data);
  } catch (e) {
    UI.toast(e.message);
  } finally {
    busy = false;
    schedule();
  }
}
function lobby() {
  el("app").innerHTML =
    titlebar() +
    `<main class="waiting-room"><div class="eyebrow">Your gathering is open</div><h1>Call in the homies.</h1><p>Share this code or invitation link. The host starts when everyone is seated.${PAGES ? " Keep the host’s game tab open throughout the match." : ""}</p><div class="room-code">${room.code}</div><div class="dialog-actions" style="justify-content:center">${button("Copy invitation", "copy-invite")}${button("Copy room code", "copy-code", "ghost")}</div><div class="seats">${Array.from({ length: 4 }, (_, i) => `<div class="seat ${room.members[i] ? "occupied" : ""}"><div class="avatar">${room.members[i] ? esc(room.members[i].name[0].toUpperCase()) : "+"}</div><b>${room.members[i] ? esc(room.members[i].name) : "Open seat"}</b><span>${i === 0 ? "HOST" : room.members[i] ? (room.members[i].connected === false ? "OFFLINE" : "READY") : "WAITING"}</span></div>`).join("")}</div><div class="pill">${room.teams ? "2 VS 2 · SEATS 1 + 3 / 2 + 4 · " : ""}${room.expansion ? "Base + Oracle" + (room.gambits ? " · Gambit draft" : " · No Gambits") : room.advanced === false ? "Base game · Beginner rules" : "Base game · Advanced rules"}</div><div class="dialog-actions" style="justify-content:center">${room.isHost ? button("Start the match", "start-online", "primary", room.members.length < (room.teams ? 4 : 2)) : "<p>Waiting for the host to start the match.</p>"}${button("Table variants", "variant-info")}${button("Table & recovery", "table-menu")}${button("Back to games", "home", "ghost")}</div><p class="tiny">${room.members.length}/4 players · ${connected ? "Connected — seats update automatically." : "Reconnecting…"}</p></main>`;
}
function results() {
  modal(
    G.winners.includes(room.seat)
      ? "The Carnival is yours."
      : "The Gathering is complete.",
    `<p>${G.finalTie ? "Still tied after Epic points. Tied players race to claim the final tiebreak." : G.teams ? "Partners combine their Gathering Points." : G.tieBreak === "epic" ? "Epic Gathering Points decided the tie." : "The strongest deck has claimed the table."}</p><div class="scoreboard">${G.scores.map((s, i) => `<div>${esc(s.name)}<strong>${s.gp}</strong>${s.epic} EPIC GP · ${G.winners.includes(i) ? (G.finalTie ? "TIED" : "WINNER") : "GATHERING POINTS"}</div>`).join("")}</div><div class="dialog-actions">${G.finalTie && G.winners.includes(room.seat) ? button("Gimmie my money, muddafocko!", "claim-tie", "primary") : ""}${button("Play again", "new", "primary")}${button("Review the table", "close")}</div>`,
  );
}
function rules() {
  modal(
    "How to play",
    `<p>Build the deck worth the most Gathering Points. Karma buys cards; Gathering Points decide the winner.</p><div class="tutorial-invitation"><div><b>Learn by playing</b><p>A guided first turn, with real cards and a practice opponent.</p></div>${button("Start tutorial", "tutorial-start", "primary")}${button("Oracle practice", "oracle-practice")}</div><div class="rules-grid"><div><h3>01 · Build Karma</h3><p>Start with 7 Ninjas and 3 Hound Dogs. Play from your five-card hand in any order and resolve each effect.</p></div><div><h3>02 · Recruit allies</h3><p>Spend Karma in the Gallery, buy a Juggalo for 3, or purchase one Epic per turn. Cards usually go to your discard pile; Fiends enter play immediately.</p></div><div><h3>03 · Find your crew</h3><p>Play 3 cards of one crew for a Unity benefit: Dark Carnival gives 2 Karma, Psychopathic draws a card, Underground draws Flavor. Claim once per turn.</p></div><div><h3>04 · Pass the turn</h3><p>Discard your hand and played cards, lose unspent Karma, refill the Gallery and Epic Tier, then draw 5. Items and unused Fiends stay in play.</p></div><div><h3>Stomps & shields</h3><p>Use a stomp reaction to stop a card as it is played. Shields prevent normal stomps. Declare Fiend targets before opponents can stomp. Used Fiends go to the Abyss at the end of the turn. Activate each Item at most once per turn.</p></div><div><h3>The final gathering</h3><p>Drawing the last Main or Epic Deck card triggers the final round. Finish with equal turns. Most Gathering Points wins; tied players compare Epic points, then race to the final claim.</p></div><div><h3>Team play</h3><p>Seats 1 and 3 face seats 2 and 4. Opponent effects cannot target your partner. Pay 1 extra Karma when obtaining a card to give it to your partner. Partners combine their final points.</p></div><div><h3>Oracle card set</h3><p>Tarot cards resolve around the table. Fast cards can interrupt an opponent’s play. Mirror cards react to draws and abolishing. Deal 10 Gambits to each player and secretly select up to 3 points. Each Gambit is used once, with Fast, Mirror and Stomp cards offered at the matching reaction window.</p></div><div><h3>Optional variants</h3><p>Select Abolish Made Easy, A Matter of Time, House of Mirrors, and Relic of Power when creating a table. Oracle also offers Juggalo Army and an optional Gambit draft. Your selections apply to solo and online games. Open Table variants during play to review them.</p></div><div><h3>Play online</h3><p>Create a room, copy the invitation and wait for friends to join. ${PAGES ? "The host keeps the match and must leave their game tab open. Guest hands are hidden from other guests; play with a host you trust. Return from the same browser to reconnect. Some networks may block direct room connections." : "Only you can see your hand. The game saves every confirmed move; return using the same browser to reconnect."}</p></div></div><div class="notice">Base rules were checked against the published manual. Oracle effects and Gambit costs were checked against visible cards and demonstrated rulebook examples. A complete Oracle manual remains unavailable, so uncommon expansion timing and its Epic setup count are not fully verified. Thirty-four Gambit names are corroborated; six still use descriptive labels. High-quality Gambit artwork remains unavailable.</div><p class="tiny">References: <a href="https://steamcommunity.com/sharedfiles/filedetails/?id=1405579643" target="_blank" rel="noopener">scanned card source</a> · <a href="https://www.intotheechoside.com/" target="_blank" rel="noopener">game website</a></p>`,
    true,
  );
}
function library(filter = "all", query = "") {
  modal(
    "The card library",
    `<p>${DB.length} distinct card variants · original printed scans</p><div class="tools"><input id="card-search" type="search" placeholder="Find a card…" value="${esc(query)}" aria-label="Find a card"><select id="card-filter" aria-label="Card category"><option value="all">All cards</option>${Object.keys(
      TYPE_META,
    )
      .map(
        (t) =>
          `<option value="${t}" ${filter === t ? "selected" : ""}>${TYPE_META[t].label}</option>`,
      )
      .join("")}</select></div><div class="card-grid" id="library-grid"></div>`,
    true,
  );
  const update = () => {
    const q = el("card-search").value.toLowerCase(),
      f = el("card-filter").value;
    el("library-grid").innerHTML =
      DB.filter(
        (d) =>
          (f === "all" || d.t === f) &&
          (d.n + " " + d.txt).toLowerCase().includes(q),
      )
        .map((d) => card(d))
        .join("") || "<p>No matching cards.</p>";
  };
  el("card-search").addEventListener("input", update);
  el("card-filter").addEventListener("change", update);
  update();
}
function market(c, zone, index) {
  if (!c) return;
  const p = me(),
    cost = Math.max(0, c.d.cost - (zone === "epic" ? p.epicDiscount || 0 : 0));
  inspect(
    c,
    button(
      `Recruit · ${cost} Karma`,
      zone === "extra" ? "buy-extra:" + c.u : "buy:" + zone + ":" + index,
      "primary",
      G.active !== room.seat ||
        p.karma < cost ||
        (zone === "epic" && p.epicBought > 0),
    ),
  );
}
function tableMenu() {
  modal(
    "Your table",
    `<p>${room ? `Table ${room.code}` : "Restore a saved game or take your seat again."}</p>${room ? `<div class="choices">${room.members.map((m, i) => button(esc(m.name) + (room.teams ? " · Team " + ((i % 2) + 1) : ""), "player:" + i)).join("")}</div>` : ""}${PAGES ? `<div class="dialog-actions">${room ? button("Seat recovery key", "recovery-key") : ""}${room?.isHost ? button("Download table backup", "backup-table") : ""}${button("Restore table backup", "restore-table")}${button("Recover a seat", "recover-seat")}</div><p class="tiny">A guest recovery key lets you rejoin from another device while the host is online. To move the host’s table, save its backup, close the old host tab, and restore the file on the new device. Keep backups and recovery keys private.</p><input id="restore-file" type="file" accept=".json,application/json" hidden>` : ""}${G ? button("Table variants", "variant-info") : ""}${button("Physical playtest kit", "playtest-kit")}${room ? button("Return to table", "return", "primary") : ""}`,
  );
  if (PAGES)
    el("restore-file").addEventListener("change", async (event) => {
      try {
        const file = event.target.files[0];
        if (!file) return;
        const data = await window.echosidePages.importTable(await file.text());
        choiceRequired = false;
        close();
        view = "table";
        accept(data, true);
        history.replaceState(
          null,
          "",
          new URL("?room=" + data.code, location.href).href,
        );
      } catch (e) {
        UI.toast(e.message);
      }
    });
}
function playerArea(seat) {
  const p = G?.players[seat];
  if (!p)
    return modal(
      "Seat " + (seat + 1),
      `<p>${esc(room.members[seat]?.name || "Open seat")}</p>`,
    );
  modal(
    esc(p.name),
    `<p>${p.gp} Gathering Points · ${p.hand.length} cards in hand · ${p.deck.length} in deck</p><h3>Items, Fiends & played cards</h3><div class="card-grid">${[...p.items, ...p.fiends, ...p.inPlay].map((c) => card(c)).join("") || "<p>No cards in play.</p>"}</div><h3>Discard pile</h3><div class="card-grid">${p.discard.map((c) => card(c)).join("") || "<p>No discarded cards.</p>"}</div>`,
    true,
  );
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-action]");
  if (!b || b.disabled) return;
  const [action, a, z] = b.dataset.action.split(":");
  if (action === "tutorial-start") return create(true, true);
  if (action === "tutorial-locate") return locateTutorialTarget(G);
  if (["tutorial-next", "tutorial-skip", "tutorial-finish"].includes(action)) {
    await send({ type: "tutorial", command: action.slice(9) }, "tutorial");
    if (action === "tutorial-finish" && G?.tutorial?.completed)
      UI.toast("Tutorial complete. The table is yours.");
    return;
  }
  if (action === "server-choice") return send(null, "choice", +a);
  if (action === "server-pick") return UI.serverPick(+a);
  if (action === "server-confirm") return UI.serverConfirm();
  if (action === "oracle-practice") { location.href = new URL("playtest/?lesson=mirror", document.baseURI); return; }
  if (action === "playtest-kit") { location.href = new URL("playtest/", document.baseURI); return; }
  if (action === "table-menu") return tableMenu();
  if (action === "player") return playerArea(+a);
  if (action === "jug-deck")
    return modal(
      "Faceup Juggalo deck",
      `<p>Top card first. Cycling is limited to once per turn.</p><div class="card-grid">${G.jug
        .filter(Boolean)
        .slice()
        .reverse()
        .map((c) => card(c))
        .join("")}</div>`,
      true,
    );
  if (action === "claim-tie") return send(null, "tiebreak");
  if (action === "restore-table") return el("restore-file").click();
  if (action === "gambit") {
    const c = me()?.gambits?.find((c) => c.u === +a);
    if (c)
      inspect(
        c,
        button(
          ["normal", "karma", "fast"].includes(c.d.timing)
            ? "Use Gambit"
            : "Offered at its reaction or scoring time",
          "use-gambit:" + c.u,
          "primary",
          G.active !== room.seat ||
            busy ||
            !!room.pending ||
            !["normal", "karma", "fast"].includes(c.d.timing),
        ),
      );
    return;
  }
  if (action === "use-gambit") return send({ type: "gambit", id: +a });
  if (action === "backup-table") {
    try {
      const blob = new Blob(
          [await window.echosidePages.exportTable(room.code)],
          { type: "application/json" },
        ),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = "echoside-" + room.code + ".json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      UI.toast("Table backup saved. Keep this file private.");
    } catch (e) {
      UI.toast(e.message);
    }
    return;
  }
  if (action === "recovery-key")
    return modal(
      "Your private recovery key",
      `<p>Save this key privately. Anyone who has it can take your seat.</p><textarea id="recovery-key" readonly aria-label="Your private recovery key">${esc(window.echosidePages.recoveryKey(room.code))}</textarea>${button("Copy recovery key", "copy-recovery", "primary")}`,
    );
  if (action === "copy-recovery") {
    try {
      await navigator.clipboard.writeText(el("recovery-key").value);
      UI.toast("Recovery key copied.");
    } catch {
      el("recovery-key").select();
    }
    return;
  }
  if (action === "recover-seat")
    return modal(
      "Recover your seat",
      `<label class="form-label" for="seat-key">Private recovery key</label><textarea id="seat-key" spellcheck="false" placeholder="ECHOSIDE1.…"></textarea>${button("Rejoin table", "recover-submit", "primary")}`,
    );
  if (action === "recover-submit") {
    try {
      const data = await window.echosidePages.recoverSeat(el("seat-key").value);
      close();
      view = "table";
      accept(data, true);
      history.replaceState(
        null,
        "",
        new URL("?room=" + data.code, location.href).href,
      );
    } catch (e) {
      UI.toast(e.message);
    }
    return;
  }
  if (action === "close") return close();
  if (action === "none") return;
  if (action === "home") {
    choiceRequired = false;
    close();
    home();
    return;
  }
  if (action === "return") {
    view = "table";
    if (room?.status === "lobby") lobby();
    else UI.render();
    poll();
    return;
  }
  if (action === "zoom") return zoomCard(DEF[a]);
  if (action === "zoom-close") return el("card-zoom").close();
  if (action === "relic") return inspect(G.relic, G.relic.d.active ? button(G.relic.tilted ? "Used this turn" : "Activate Relic", "activate-relic", "primary", G.active !== room.seat || !!room.pending || G.relic.tilted) : "");
  if (action === "activate-relic") return send({ type: "relic" });
  if (action === "variant-info") return variantInfo();
  if (action === "detail") return inspect(DEF[a]);
  if (action === "rules") return rules();
  if (action === "library") return library();
  if (action === "sound") {
    sound = !sound;
    try { localStorage.setItem("echoside-sound", sound ? "on" : "off"); } catch {}
    tone(440);
    if (G) UI.render();
    UI.toast(sound ? "Sound on" : "Sound off");
    return;
  }
  if (action === "new" || action === "online") {
    close();
    return setup(action === "new");
  }
  if (action === "setup-solo") return setup(true);
  if (action === "setup-online") return setup(false);
  if (action === "create-solo") return create(true);
  if (action === "create-online") return create(false);
  if (action === "join") return joinForm();
  if (action === "join-submit") return joinRoom();
  if (action === "start-online") return send(null, "start");
  if (action === "copy-invite" || action === "copy-code") {
    try {
      await navigator.clipboard.writeText(
        action === "copy-code"
          ? room.code
          : new URL("?room=" + room.code, location.href).href,
      );
      UI.toast("Copied. Send it to your friends.");
    } catch {
      UI.toast("Room code: " + room.code);
    }
    return;
  }
  if (action === "resume") {
    try {
      view = "table";
      accept(await api("rooms/" + a), true);
      history.replaceState(null, "", new URL("?room=" + a, location.href).href);
    } catch (e) {
      UI.toast(e.message);
    }
    return;
  }
  if (action === "expansion")
    return modal(
      "Oracle of the Three Rings",
      `<p>The available Oracle card set adds new Crew cards, Items, Fiends, Epics, Flavor and six kinds of Tarot. Playable in solo matches and online rooms, with an optional private Gambit draft and the Juggalo Army setup variant.</p><div class="notice">All 40 Gambit effects are included. Draft from 10 cards with a 3-point budget; keep your picks private and use each once. Some names use descriptive labels because their print is unreadable in the source. Uncommon timing and the exact Epic setup still need the complete expansion manual.</div><div class="dialog-actions">${button("Start an Oracle table", "setup-online", "primary")}${button("Browse cards", "library")}</div>`,
    );
  if (!G) return;
  const p = me(),
    mine = G.active === room.seat;
  if (action === "journal")
    return modal(
      "Match journal",
      G.log
        .slice()
        .reverse()
        .map((s) => `<div class="log-entry">${safeLog(s)}</div>`)
        .join("") || "<p>The first turn is yours.</p>",
    );
  if (action === "hand") {
    const c = p.hand.find((c) => c.u === +a);
    if (c) inspect(c, button("Play card", "play:" + a, "primary", !mine));
    return;
  }
  if (action === "play") {
    close();
    return send({ type: "play", id: +a });
  }
  if (action === "ninjas") return send({ type: "ninjas" });
  if (action === "market")
    return market((a === "epic" ? G.epicTier : G.gallery)[+z], a, +z);
  if (action === "extra")
    return market(
      G.extraGallery.find((c) => c.u === +a),
      "extra",
      0,
    );
  if (action === "buy-extra") {
    close();
    return send({ type: "buy", zone: "extra", id: +a });
  }
  if (action === "buy") {
    close();
    return send({ type: "buy", zone: a, index: +z });
  }
  if (action === "end") {
    const canBuy =
      G.gallery.some((c) => c && !c.hiddenBy && c.d.cost <= p.karma) ||
      (p.karma >= 3 && G.jug.length);
    if (canBuy)
      return modal(
        "End your turn?",
        `<p>You have ${p.karma} Karma remaining and can still recruit a card. Unspent Karma is lost.</p><div class="dialog-actions">${button("Keep playing", "close", "primary")}${button("End turn", "confirm-end")}</div>`,
      );
    return send({ type: "end" });
  }
  if (action === "confirm-end") {
    close();
    return send({ type: "end" });
  }
  if (action === "unity")
    return modal(
      "Choose your Unity benefit",
      `<div class="choices">${(unityReady(p) || []).map((t) => button(TYPE_META[t].label + " · " + { DC: "+2 Karma", PSY: "Draw 1 card", UG: "Draw Flavor" }[t], "claim-unity:" + t)).join("")}</div>`,
    );
  if (action === "claim-unity") {
    close();
    return send({ type: "unity", crew: a });
  }
  if (action === "juggalo") {
    const c = G.jug.at(-1);
    if (c)
      inspect(
        c,
        button(
          "Recruit · 3 Karma",
          "buy-jug",
          "primary",
          !mine || p.karma < 3,
        ) +
          button(
            "Cycle · 1 Karma",
            "cycle-jug",
            "",
            !mine || p.karma < 1 || p.jugCycled,
          ) +
          button("View faceup Juggalo deck", "jug-deck", "ghost"),
      );
    return;
  }
  if (action === "buy-jug") {
    close();
    return send({ type: "buy", zone: "juggalo" });
  }
  if (action === "cycle-jug") {
    close();
    return send({ type: "cycle" });
  }
  if (["discard", "abyss", "deck"].includes(action)) {
    if (action === "deck")
      return modal(
        "Your deck",
        `<p>${p.deck.length} cards remain. The order is hidden until a card effect reveals it.</p>`,
      );
    const cards = action === "discard" ? p.discard : G.abyss;
    return modal(
      action === "discard" ? "Your discard pile" : "The Abyss",
      `<div class="card-grid">${cards.map((c) => card(c, action === "abyss" && p.abyssBuy ? "abyss-card:" + c.u : "detail:" + c.id)).join("")}</div>${cards.length ? "" : "<p>No cards here yet.</p>"}`,
      true,
    );
  }
  if (action === "abyss-card") {
    const c = G.abyss.find((c) => c.u === +a);
    if (c)
      inspect(
        c,
        button(
          "Recruit · " + c.d.cost + " Karma",
          "buy-abyss:" + c.u,
          "primary",
          !mine || p.karma < c.d.cost,
        ),
      );
    return;
  }
  if (action === "buy-abyss") {
    close();
    return send({ type: "buy", zone: "abyss", id: +a });
  }
  if (action === "permanent") {
    const c = [...p.items, ...p.fiends, ...p.inPlay].find((c) => c.u === +a);
    if (c)
      inspect(
        c,
        (p.items.includes(c) || c.borrowedActive) &&
          (c.d.active || c.borrowedActive)
          ? button(
              c.tilted ? "Already used" : "Activate Item",
              "item:" + a,
              "primary",
              !mine || c.tilted || !!c.nullBy || c.nullTurn === G.turnN,
            )
          : p.fiends.includes(c) && c.d.fiendUse?.length
            ? button(
                c.spent ? "Used this turn" : "Unleash Fiend",
                "fiend:" + a,
                "primary",
                !mine || !!c.nullBy || c.nullTurn === G.turnN || c.spent,
              )
            : "",
      );
    return;
  }
  if (action === "item" || action === "fiend") {
    close();
    return send({ type: action, id: +a });
  }
});
el("modal").addEventListener("cancel", (e) => {
  if (choiceRequired) e.preventDefault();
});
async function init() {
  try {
    [DB, { rooms: recent }] = await Promise.all([
      fetch("cards.json").then((r) => r.json()),
      api("session"),
    ]);
    DEF = Object.fromEntries(DB.map((d) => [d.id, d]));
    art = Object.fromEntries(DB.map((d) => [d.id, d.art]));
    home();
    const code = new URLSearchParams(location.search).get("room");
    if (code) {
      try {
        view = "table";
        accept(await api("rooms/" + code));
      } catch (e) {
        if (e.status === 403) joinForm(code);
        else UI.toast(e.message);
      }
    }
    registerTools();
  } catch (e) {
    el("app").innerHTML =
      titlebar() +
      `<main class="waiting-room"><h1>The gates are resting.</h1><p>${esc(e.message)}</p>${button("Try again", "reload", "primary")}</main>`;
    el("app")
      .querySelector('[data-action="reload"]')
      .addEventListener("click", init);
  }
}
function registerTools() {
  const c = document.modelContext;
  if (!c?.registerTool) return;
  const tools = [
    {
      name: "read_game_table",
      title: "Read game table",
      description:
        "Read your visible game table and legal action context. Opponent hands remain hidden.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () =>
        room
          ? {
              code: room.code,
              status: room.status,
              seat: room.seat,
              game: G,
              pending: room.pending,
            }
          : { status: "not_at_table" },
    },
    {
      name: "play_hand_card",
      title: "Play a card",
      description:
        "Play one card from your hand. May open a choice that must be resolved before play continues.",
      inputSchema: {
        type: "object",
        properties: { cardId: { type: "integer" } },
        required: ["cardId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async ({ cardId }) => {
        if (
          !Number.isInteger(cardId) ||
          !me()?.hand.some((c) => c.u === cardId) ||
          G.active !== room.seat ||
          room.pending
        )
          throw Error("Card must be in your hand.");
        await send({ type: "play", id: cardId });
        return { revision: room.revision, pending: room.pending };
      },
    },
  ];
  for (const t of tools) Promise.resolve(c.registerTool(t)).catch(() => {});
}
window.addEventListener("echoside-connection", (e) => {
  connected = e.detail.connected;
  if (G && view === "table") UI.render();
});
init();

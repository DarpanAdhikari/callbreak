const BASE_ROUNDS = 4;
let players = [], balances = [0,0,0,0], betAmounts = [];
let gameId = 0, games = {}; // games[gameId] => { rounds, roundResults, totals, finished }

function start(){
  players = [p0.value||'P1', p1.value||'P2', p2.value||'P3', p3.value||'P4'];
  betAmounts = [+b1.value||0, +b2.value||0, +b3.value||0].filter(v=>!isNaN(v)).sort((a,b)=>b-a);
  while(betAmounts.length<3) betAmounts.push(0);
  createGame();
}

function createGame(){
  gameId++;
  games[gameId] = { rounds: BASE_ROUNDS, roundResults: {}, totals: [0,0,0,0], finished:false };
  const wrap = document.getElementById('gamesArea');
  const card = document.createElement('div'); card.className='card'; card.id='card_'+gameId;
  card.innerHTML = `<h3 style="text-align:center;margin:6px 0">Game ${gameId}</h3>
    <div style="overflow:auto"><table id="tbl_${gameId}"></table></div>
    <div id="bal_${gameId}" style="text-align:center;margin-top:8px"></div>
    <div id="ctl_${gameId}" style="text-align:center;margin-top:10px"></div>`;
  wrap.appendChild(card);
  buildTable(gameId);
  renderBalances(gameId);
}

/* build initial 4 rounds table */
function buildTable(g){
  const tbl = document.getElementById('tbl_'+g);
  tbl.innerHTML = '';
  const header = `<tr><th>Round</th>${players.map(p=>`<th colspan="2">${esc(p)}</th>`).join('')}</tr>`;
  const sub = `<tr><td></td>${players.map(()=>'<td class="muted">Bid</td><td class="muted">Got</td>').join('')}</tr>`;
  let rows = '';
  for(let r=1;r<=BASE_ROUNDS;r++){
    rows += `<tr id="g${g}_r${r}"><td>R${r}</td>` + players.map((_,p)=>
      `<td><input id="bid_${g}_${r}_${p}" type="number"
           oninput="onBid(${g},${r},${p})"
           onwheel="this.blur()" onkeydown="if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();}"></td>
       <td><input id="got_${g}_${r}_${p}" type="number" disabled
           oninput="onGot(${g},${r})"
           onwheel="this.blur()" onkeydown="if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();}"></td>`
    ).join('') + `</tr><tr id="rowmsg_${g}_${r}"><td colspan="${1+players.length*2}"></td></tr>`;
  }
  rows += `<tr id="tot_${g}"><td>Total</td>${players.map((_,i)=>`<td colspan="2" id="total_${g}_${i}">0</td>`).join('')}</tr>`;
  rows += `<tr><td colspan="${1+players.length*2}" id="summary_${g}"></td></tr>`;
  tbl.innerHTML = header + sub + rows;
}

/* bid input: enable got for that player only, clear row messages, check low-bid confirm if all bids present */
function onBid(g,r,p){
  const bid = document.getElementById(`bid_${g}_${r}_${p}`);
  const got = document.getElementById(`got_${g}_${r}_${p}`);
  if(!bid) return;
  if(bid.value !== '') got.disabled = false;
  setRowMessage(g,r,'');
  checkLowBidConfirm(g,r);
}

/* If all bids present and sum bids < 9, show inline confirm bar */
function checkLowBidConfirm(g,r){
  let allBids = true, sumBid = 0;
  for(let p=0;p<4;p++){
    const b = document.getElementById(`bid_${g}_${r}_${p}`);
    if(!b || b.value === '') { allBids = false; break; }
    sumBid += Number(b.value)||0;
  }
  if(!allBids){ setRowMessage(g,r,''); return; }
  if(sumBid < 9){
    setRowMessage(g,r, `<div class="confirm-bar">
      <div class="inline-err">Total Bid = ${sumBid} &lt; 9 — game normally cannot begin.</div>
      <button class="btn" onclick="copyBidsToGots(${g},${r})">Copy Bids → Gots & Force</button>
      <button class="btn" style="background:#6b7280" onclick="forceProcess(${g},${r})">Proceed Anyway</button>
      <button class="btn" style="background:#c0392b" onclick="setRowMessage(${g},${r},'')">Cancel</button>
    </div>`);
  } else setRowMessage(g,r,'');
}

/* got input: only act when ALL bid+got present; validate sum(got)==13 (exact). show errors inline (no popup). */
function onGot(g,r){
  for(let p=0;p<4;p++){
    const b = document.getElementById(`bid_${g}_${r}_${p}`);
    const gt = document.getElementById(`got_${g}_${r}_${p}`);
    if(!b || !gt || b.value === '' || gt.value === '') return;
  }
  // compute sums
  let sumGot = 0, sumBid = 0;
  for(let p=0;p<4;p++){
    sumGot += Number(document.getElementById(`got_${g}_${r}_${p}`).value)||0;
    sumBid += Number(document.getElementById(`bid_${g}_${r}_${p}`).value)||0;
  }
  if(sumGot > 13){
    setRowMessage(g,r, `<div class="inline-err">Error: total Got > 13 (current ${sumGot}). Fix values.</div>`);
    return;
  }
  if(sumGot < 13){
    setRowMessage(g,r, `<div class="inline-note">Total Got = ${sumGot} (must reach 13). Waiting...</div>`);
    return;
  }
  // sumGot === 13 -> good; process (sumBid check handled earlier)
  setRowMessage(g,r,'');
  processRound(g,r);
}

/* inline message setter */
function setRowMessage(g,r, html){
  const tr = document.getElementById(`rowmsg_${g}_${r}`);
  if(!tr) return;
  tr.innerHTML = `<td colspan="${1+players.length*2}">${html}</td>`;
}

/* copy bids to gots (force) */
function copyBidsToGots(g,r){
  for(let p=0;p<4;p++){
    const b = document.getElementById(`bid_${g}_${r}_${p}`);
    const gt = document.getElementById(`got_${g}_${r}_${p}`);
    if(b && gt){
      gt.value = b.value;
      gt.disabled = true;
    }
  }
  setRowMessage(g,r,'');
  // after copying, check sum==13 before process
  let sumGot = 0;
  for(let p=0;p<4;p++) sumGot += Number(document.getElementById(`got_${g}_${r}_${p}`).value)||0;
  if(sumGot === 13) processRound(g,r);
  else setRowMessage(g,r, `<div class="inline-err">After copying, sum Got = ${sumGot} not 13 — fix or Cancel.</div>`);
}

/* user insisted to proceed ignoring low bid rule */
function forceProcess(g,r){
  setRowMessage(g,r,'');
  processRoundForced(g,r);
}

/* forced processing: read whatever is in inputs/cells and compute points; used when user forced */
function processRoundForced(g,r){
  const game = games[g]; if(!game || game.finished) return;
  const pts = [0,0,0,0];
  for(let p=0;p<4;p++){
    const bidVal = readBidValue(g,r,p);
    const gotVal = readGotValue(g,r,p);
    // replace bid cell with text
    const bidCell = cellElem(g,r,2+p*2); if(bidCell) bidCell.innerText = String(bidVal);
    // compute points
    const score = computePoints(bidVal, gotVal);
    const gotCell = cellElem(g,r,3+p*2);
    if(score < 0){
      if(gotCell) gotCell.innerHTML = `<span class="fail">-${Math.abs(Math.round(score))}</span>`;
      pts[p] = score;
    } else {
      if(gotCell) gotCell.innerText = formatFloat(score);
      pts[p] = score;
    }
  }
  game.roundResults[r] = pts;
  recomputeTotals(g);
  if(r === BASE_ROUNDS && game.rounds === BASE_ROUNDS){ addFinal(g); return; }
  if(r === game.rounds && game.rounds > BASE_ROUNDS){ finalizeGame(g); return; }
}

/* normal processing (when sumGot === 13 and not forced) */
function processRound(g,r){
  const game = games[g]; if(!game || game.finished) return;
  const pts = [0,0,0,0];
  for(let p=0;p<4;p++){
    const bidEl = document.getElementById(`bid_${g}_${r}_${p}`);
    const gotEl = document.getElementById(`got_${g}_${r}_${p}`);
    const bid = Number(bidEl.value)||0;
    const got = Number(gotEl.value)||0;
    // replace bid input with text
    const bidCell = cellElem(g,r,2+p*2);
    if(bidCell) bidCell.innerText = String(bid);
    const gotCell = cellElem(g,r,3+p*2);
    const score = computePoints(bid, got);
    if(score < 0){
      if(gotCell) gotCell.innerHTML = `<span class="fail">-${Math.abs(Math.round(score))}</span>`;
      pts[p] = score;
    } else {
      if(gotCell) gotCell.innerText = formatFloat(score);
      pts[p] = score;
    }
  }
  game.roundResults[r] = pts;
  recomputeTotals(g);
  setRowMessage(g,r,'');
  if(r === BASE_ROUNDS && game.rounds === BASE_ROUNDS){ addFinal(g); return; }
  if(r === game.rounds && game.rounds > BASE_ROUNDS){ finalizeGame(g); return; }
}

/* compute float scoring:
   if got >= bid: points = bid + (got - bid) * 0.1
   else: negative of bid (fail)
   Return number (float) or negative integer.
*/
function computePoints(bid, got){
  bid = Number(bid)||0;
  got = Number(got)||0;
  if(got >= bid){
    const pts = bid + (got - bid) * 0.1;
    return Number(pts.toFixed(1)); // one decimal
  } else {
    return -Math.abs(Math.round(bid)); // negative integer
  }
}

/* read cell/input helpers */
function readBidValue(g,r,p){
  const input = document.getElementById(`bid_${g}_${r}_${p}`);
  if(input) return Number(input.value)||0;
  // otherwise read cell text
  const t = cellText(g,r,2+p*2).replace(/[^\d-]/g,'')||'0';
  return Number(t)||0;
}
function readGotValue(g,r,p){
  const input = document.getElementById(`got_${g}_${r}_${p}`);
  if(input) return Number(input.value)||0;
  // cell may be fail "-30" or text value
  const txt = cellText(g,r,3+p*2).trim();
  if(txt === '') return 0;
  const n = Number(txt.replace(/[^\d-]/g,'')) || 0;
  return n;
}

/* recompute totals by summing stored roundResults */
function recomputeTotals(g){
  const game = games[g];
  game.totals = [0,0,0,0];
  Object.keys(game.roundResults).forEach(k=>{
    game.roundResults[k].forEach((v,i)=> game.totals[i] += Number(v)||0);
  });
  for(let i=0;i<4;i++){
    const cell = document.getElementById(`total_${g}_${i}`);
    if(cell) cell.innerText = formatFloat(game.totals[i]);
  }
}

/* after 4 rounds add final 5th row */
function addFinal(g){
  const game = games[g]; game.rounds = BASE_ROUNDS + 1;
  const totRow = document.getElementById(`tot_${g}`);
  const tr = document.createElement('tr'); tr.id = `g${g}_r${game.rounds}`;
  let inner = `<td>Final</td>`;
  for(let p=0;p<4;p++){
    inner += `<td><input id="bid_${g}_${game.rounds}_${p}" type="number"
                 oninput="onBid(${g},${game.rounds},${p})"
                 onwheel="this.blur()" onkeydown="if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();}"></td>
              <td><input id="got_${g}_${game.rounds}_${p}" type="number" disabled
                 oninput="onGot(${g},${game.rounds})"
                 onwheel="this.blur()" onkeydown="if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();}"></td>`;
  }
  tr.innerHTML = inner;
  totRow.parentElement.insertBefore(tr, totRow);
  const msgTr = document.createElement('tr'); msgTr.id = `rowmsg_${g}_${game.rounds}`; msgTr.innerHTML = `<td colspan="${1+players.length*2}"></td>`;
  totRow.parentElement.insertBefore(msgTr, totRow);
}

/* finalize settlement: use sorted betAmounts (already sorted desc) */
function finalizeGame(g){
  const game = games[g]; if(!game || game.finished) return;
  // totals are current
  const ranked = game.totals.map((v,i)=>({i,v})).sort((a,b)=>b.v - a.v || a.i - b.i);
  const highest = Number(betAmounts[0])||0, second = Number(betAmounts[1])||0, lowest = Number(betAmounts[2])||0;
  const payments = [0,0,0,0];
  // pos0 winner, pos1 second, pos2 third, pos3 last
  ranked.forEach((o,pos)=>{
    if(pos === 1) payments[o.i] = -lowest;
    if(pos === 2) payments[o.i] = -second;
    if(pos === 3) payments[o.i] = (game.totals[o.i] < 0) ? -(2*highest) : -highest;
  });
  // winner gets sum of others
  payments[ranked[0].i] = -payments.reduce((s,x)=>s+x,0);
  for(let i=0;i<4;i++) balances[i] += payments[i];

  // show summary + Next/Reset controls
  const summ = document.getElementById(`summary_${g}`);
  summ.innerHTML = `<div class="muted">Used amounts — highest=${highest}, second=${second}, lowest=${lowest}</div>
    <div style="margin-top:8px">${players.map((p,i)=>`<span class="bal ${balances[i]>=0?'pos':'neg'}">${esc(p)}: ${balances[i]>=0?'+':''}${formatFloat(balances[i])}</span>`).join(' ')}</div>
    <div style="margin-top:8px">Payments: ${players.map((p,i)=>`${esc(p)} ${payments[i]>=0? '+'+payments[i] : payments[i]}`).join(' | ')}</div>
    <div style="margin-top:10px"><button class="btn" onclick="createGameAfter(${g})">➕ Next Game</button>
    <button class="btn" style="background:#6b7280" onclick="resetAll()">Reset All</button></div>`;

  renderBalances(g); game.finished = true;
  // ensure no inputs remain enabled
  for(let r=1;r<=game.rounds;r++) for(let p=0;p<4;p++){
    const b = document.getElementById(`bid_${g}_${r}_${p}`); if(b) b.disabled = true;
    const gt = document.getElementById(`got_${g}_${r}_${p}`); if(gt) gt.disabled = true;
  }
}

function createGameAfter(prevG){
  createGame();
}

/* UI helpers */
function renderBalances(g){
  const el = document.getElementById('bal_'+g);
  if(!el) return;
  el.innerHTML = players.map((p,i)=>`<span class="bal ${balances[i]>=0?'pos':'neg'}">${esc(p)}: ${balances[i]>=0?'+':''}${formatFloat(balances[i])}</span>`).join(' ');
}
function resetAll(){
  players = []; balances = [0,0,0,0]; betAmounts = []; gameId = 0; games = {};
  document.getElementById('gamesArea').innerHTML = '';
  p0.value='P1'; p1.value='P2'; p2.value='P3'; p3.value='P4';
  b1.value=50; b2.value=40; b3.value=30;
}
function cellElem(g,r,childIndex){
  const row = document.getElementById(`g${g}_r${r}`); if(!row) return null;
  const tds = row.getElementsByTagName('td'); return tds[childIndex-1] || null;
}
function cellText(g,r,childIndex){ const c = cellElem(g,r,childIndex); return c ? c.innerText : ''; }
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function formatFloat(v){ return Number.isInteger(Number(v)) ? String(v) : String(Number(v).toFixed(1)); }
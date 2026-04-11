import { MAPS } from './maps.js';

const TILE = 32;
const VP_COLS = 20;
const VP_ROWS = 15;

export function initGame(canvas, callbacks) {
  const ctx = canvas.getContext('2d');
  const { onHudUpdate, onMapName, onPhase, onDialog, onDialogClear, onBattleUpdate, onBattleEnd } = callbacks;

  // ── State ────────────────────────────────────────────────────
  let gameState = 'explore';
  let perry = {
    x: 5, y: 7, dir: 'down',
    hp: 30, maxHp: 30, atk: 5, def: 5, spd: 6, level: 1, exp: 0, expNext: 10,
    moves: [
      { name: 'Fedora Toss', power: 12, type: 'physical', desc: 'Flings his fedora like a frisbee' },
      { name: 'Banshee Voice', power: 18, type: 'special', desc: 'Unleashes an unholy shriek', effect: 'confuse', effectChance: 0.5 },
      { name: 'Belly Bump', power: 15, type: 'physical', desc: 'A devastating stomach check', accuracy: 0.8 },
      { name: 'Snack Break', power: 0, type: 'heal', desc: 'Eats a Filet-O-Fish or Skittles to heal', healAmt: 10 },
    ],
  };
  let currentMapId = 'apartment';
  let currentMap = null;
  let camera = { x: 0, y: 0 };
  let currentEnemy = null;
  let battleTurn = 'player';
  let dialogQueue = [];
  let dialogCallback = null;
  let dialogTypeInterval = null;
  let dialogAdvanceKey = null;
  let encounterCooldown = 0;
  let mapTransitionCooldown = 0;
  let mapItems = [];
  let mapNpcs = [];
  let rafId = null;

  // ── HUD ──────────────────────────────────────────────────────
  function updateHUD() {
    onHudUpdate({ level: perry.level, hp: perry.hp, maxHp: perry.maxHp, exp: perry.exp, expNext: perry.expNext });
  }

  // ── Map loading ──────────────────────────────────────────────
  function loadMap(mapId, playerX, playerY) {
    currentMapId = mapId;
    currentMap = MAPS[mapId];
    perry.x = playerX !== undefined ? playerX : currentMap.startPos.x;
    perry.y = playerY !== undefined ? playerY : currentMap.startPos.y;
    mapItems = currentMap.items.map(i => ({ ...i, collected: false }));
    mapNpcs = currentMap.npcs.map(n => ({ ...n }));
    encounterCooldown = 5;
    mapTransitionCooldown = 3;
    onMapName(currentMap.name);
    updateCamera();
    render();
    if (mapId !== 'apartment') showDialog([`— ${currentMap.name} —`]);
  }

  function getTile(x, y) {
    if (!currentMap || y < 0 || y >= currentMap.height || x < 0 || x >= currentMap.width) return '#';
    return currentMap.tileData[y][x];
  }

  function isSolid(x, y) {
    return currentMap.solidTiles.has(getTile(x, y));
  }

  function updateCamera() {
    camera.x = Math.max(0, Math.min(perry.x - Math.floor(VP_COLS / 2), currentMap.width - VP_COLS));
    camera.y = Math.max(0, Math.min(perry.y - Math.floor(VP_ROWS / 2), currentMap.height - VP_ROWS));
  }

  // ── Drawing ──────────────────────────────────────────────────
  function drawTile(tile, sx, sy) {
    ctx.fillStyle = currentMap.tileColors[tile] || '#333';
    ctx.fillRect(sx, sy, TILE, TILE);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.strokeRect(sx, sy, TILE, TILE);

    if (currentMapId === 'apartment' && tile === '.' && ((sy / TILE * 7 + sx / TILE * 13) % 11 === 0)) {
      ctx.font = '10px serif'; ctx.textAlign = 'center';
      const trash = ['📦', '🍕', '📰', '🧦', '🥫', '🍺'];
      ctx.fillText(trash[((sy + sx) / TILE | 0) % trash.length], sx + 16, sy + 16);
    }

    const deco = currentMap.tileDecorations && currentMap.tileDecorations[tile];
    if (deco) {
      ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(deco, sx + 16, sy + 16);
    }

    if (tile === 'R') {
      ctx.strokeStyle = '#ff0'; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(sx, sy + 16); ctx.lineTo(sx + TILE, sy + 16); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (tile === 'r') {
      ctx.strokeStyle = '#ff0'; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(sx + 16, sy); ctx.lineTo(sx + 16, sy + TILE); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (tile === '+') {
      ctx.strokeStyle = '#ff0'; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(sx, sy + 16); ctx.lineTo(sx + TILE, sy + 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + 16, sy); ctx.lineTo(sx + 16, sy + TILE); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (tile === 'T') {
      ctx.fillStyle = '#1a5e0e'; ctx.beginPath();
      ctx.arc(sx + 16, sy + 12, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(sx + 14, sy + 22, 4, 10);
    }
    if (tile === 'P') {
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(sx + 14, sy + 10, 4, 22);
      ctx.fillStyle = '#2a8a1a';
      ctx.beginPath(); ctx.moveTo(sx + 16, sy + 4); ctx.lineTo(sx + 4, sy + 14); ctx.lineTo(sx + 16, sy + 10); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx + 16, sy + 4); ctx.lineTo(sx + 28, sy + 14); ctx.lineTo(sx + 16, sy + 10); ctx.fill();
      ctx.beginPath(); ctx.moveTo(sx + 16, sy + 2); ctx.lineTo(sx + 6, sy + 8); ctx.lineTo(sx + 26, sy + 8); ctx.fill();
    }
    if (tile === 'W' || tile === 'Y' || tile === 'O') {
      const t = Date.now() / 600;
      ctx.fillStyle = tile === 'O' ? 'rgba(100,200,255,0.3)' : 'rgba(255,255,255,0.15)';
      for (let i = 0; i < 3; i++) {
        const wx = sx + 5 + (i * 9 + Math.sin(t + i) * 3);
        ctx.fillRect(wx, sy + 10 + i * 6, 6, 2);
      }
    }
    if (tile === 'B' || tile === 'H' || tile === 'M' || tile === 'J') {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(sx + 2, sy + 2, TILE - 4, 3);
      ctx.fillStyle = 'rgba(200,220,255,0.5)';
      ctx.fillRect(sx + 8, sy + 10, 6, 6); ctx.fillRect(sx + 18, sy + 10, 6, 6);
    }
    if (tile === 'C') {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#cc3333'; ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 8, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx + 16, sy + 16, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    if (tile === 'b' || tile === 'h' || tile === 'm' || tile === 'c' || tile === 'j') {
      ctx.fillStyle = '#654321'; ctx.fillRect(sx + 10, sy + 8, 12, 24);
      ctx.fillStyle = '#876543'; ctx.fillRect(sx + 12, sy + 10, 8, 20);
      ctx.fillStyle = '#ff0'; ctx.beginPath(); ctx.arc(sx + 18, sy + 20, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    if (tile === 'D') {
      ctx.fillStyle = 'rgba(255,255,0,0.3)'; ctx.fillRect(sx, sy, TILE, TILE);
      ctx.font = '10px monospace'; ctx.fillStyle = '#ff0'; ctx.textAlign = 'center';
      ctx.fillText('EXIT', sx + 16, sy + 20);
    }
    if (tile === '^') {
      ctx.fillStyle = '#7a6a5a';
      ctx.beginPath(); ctx.moveTo(sx, sy + TILE); ctx.lineTo(sx + 16, sy); ctx.lineTo(sx + TILE, sy + TILE); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(sx + 12, sy + 6); ctx.lineTo(sx + 16, sy); ctx.lineTo(sx + 20, sy + 6); ctx.fill();
    }
    if (tile === 'X') {
      ctx.fillStyle = '#3a7a2a';
      ctx.fillRect(sx + 13, sy + 6, 6, 22); ctx.fillRect(sx + 6, sy + 10, 8, 4);
      ctx.fillRect(sx + 6, sy + 8, 4, 6); ctx.fillRect(sx + 18, sy + 14, 8, 4); ctx.fillRect(sx + 22, sy + 10, 4, 8);
    }
    if (tile === 'I') {
      ctx.fillStyle = '#ddd'; ctx.fillRect(sx + 15, sy + 8, 2, 24);
      ctx.strokeStyle = '#eee'; ctx.lineWidth = 2;
      const t2 = Date.now() / 1000;
      for (let i = 0; i < 3; i++) {
        const a = t2 * 2 + i * Math.PI * 2 / 3;
        ctx.beginPath(); ctx.moveTo(sx + 16, sy + 8);
        ctx.lineTo(sx + 16 + Math.cos(a) * 12, sy + 8 + Math.sin(a) * 12); ctx.stroke();
      }
      ctx.lineWidth = 1;
    }
    if (tile === 'U') {
      ctx.fillStyle = '#ccc'; ctx.fillRect(sx + 2, sy + 8, 28, 18);
      ctx.fillStyle = '#aaa'; ctx.fillRect(sx + 2, sy + 6, 28, 4);
      ctx.fillStyle = 'rgba(150,200,255,0.6)'; ctx.fillRect(sx + 6, sy + 12, 8, 6);
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(sx + 10, sy + 28, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + 22, sy + 28, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawMap() {
    for (let r = 0; r < VP_ROWS; r++) {
      for (let c = 0; c < VP_COLS; c++) {
        const tile = getTile(camera.x + c, camera.y + r);
        drawTile(tile, c * TILE, r * TILE);
      }
    }
  }

  function drawPerry() {
    const px = (perry.x - camera.x) * TILE;
    const py = (perry.y - camera.y) * TILE;
    const skin = '#c9956a';
    const skinShad = '#b07858';

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(px+16, py+30, 12, 4, 0, 0, Math.PI*2); ctx.fill();

    // Pants (dark jeans)
    ctx.fillStyle = '#2a2a5a';
    ctx.fillRect(px+9, py+22, 6, 9); ctx.fillRect(px+17, py+22, 6, 9);
    // Shoes
    ctx.fillStyle = '#111';
    ctx.fillRect(px+8, py+29, 7, 3); ctx.fillRect(px+17, py+29, 7, 3);

    // Wide chubby shirtless torso
    ctx.fillStyle = skin;
    ctx.fillRect(px+5, py+12, 22, 11);
    // Beer gut / belly bulge
    ctx.beginPath(); ctx.ellipse(px+16, py+22, 12, 6, 0, 0, Math.PI*2); ctx.fill();
    // Chubby arms
    ctx.fillRect(px+1, py+12, 5, 11); ctx.fillRect(px+26, py+12, 5, 11);
    // Hands (slightly darker)
    ctx.fillStyle = skinShad;
    ctx.fillRect(px+1, py+22, 5, 3); ctx.fillRect(px+26, py+22, 5, 3);
    // Chest / pec crease
    ctx.fillStyle = skinShad;
    ctx.fillRect(px+8, py+17, 7, 1); ctx.fillRect(px+17, py+17, 7, 1);
    // Belly button
    ctx.fillRect(px+15, py+22, 2, 2);
    // Nipples
    ctx.fillStyle = '#9a6040';
    ctx.fillRect(px+10, py+16, 2, 1); ctx.fillRect(px+20, py+16, 2, 1);

    // Neck
    ctx.fillStyle = skin;
    ctx.fillRect(px+13, py+13, 6, 4);
    // Head (round, slightly large)
    ctx.beginPath(); ctx.ellipse(px+16, py+8, 8, 8, 0, 0, Math.PI*2); ctx.fill();

    if (perry.dir !== 'up') {
      // Stubble / jaw shadow
      ctx.fillStyle = 'rgba(60,30,10,0.42)';
      ctx.fillRect(px+10, py+10, 12, 5);
      // Eyes (beady)
      ctx.fillStyle = '#111';
      ctx.fillRect(px+11, py+5, 2, 2); ctx.fillRect(px+19, py+5, 2, 2);
      // Eye gleam
      ctx.fillStyle = '#fff';
      ctx.fillRect(px+12, py+5, 1, 1); ctx.fillRect(px+20, py+5, 1, 1);
      // Nose
      ctx.fillStyle = skinShad;
      ctx.fillRect(px+15, py+8, 3, 2);
      // Big toothy grin
      ctx.fillStyle = '#111';
      ctx.fillRect(px+11, py+11, 10, 3);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px+12, py+12, 8, 1);
    }

    // Fedora brim (wide, very dark)
    ctx.fillStyle = '#111';
    ctx.fillRect(px+2, py+1, 28, 3);
    // Fedora crown
    ctx.fillRect(px+7, py-5, 18, 7);
    // Hat band
    ctx.fillStyle = '#1a1010';
    ctx.fillRect(px+7, py+1, 18, 2);
    // Crown pinch
    ctx.fillStyle = '#0a0808';
    ctx.fillRect(px+10, py-5, 12, 1);
  }

  function drawItems() {
    ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    mapItems.forEach(item => {
      if (!item.collected) {
        const sx = (item.x - camera.x) * TILE + 16;
        const sy = (item.y - camera.y) * TILE + 16;
        if (sx > -TILE && sx < canvas.width + TILE && sy > -TILE && sy < canvas.height + TILE) {
          ctx.fillStyle = 'rgba(255,255,100,0.25)';
          ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();
          ctx.fillText(item.emoji, sx, sy);
        }
      }
    });
  }

  function drawNPCs() {
    ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    mapNpcs.forEach(npc => {
      const sx = (npc.x - camera.x) * TILE + 16;
      const sy = (npc.y - camera.y) * TILE + 16;
      if (sx > -TILE && sx < canvas.width + TILE && sy > -TILE && sy < canvas.height + TILE) {
        ctx.fillText(npc.emoji, sx, sy);
      }
    });
  }

  function drawExits() {
    if (!currentMap.exits) return;
    const t = Date.now() / 500;
    currentMap.exits.forEach(exit => {
      const sx = (exit.x - camera.x) * TILE;
      const sy = (exit.y - camera.y) * TILE;
      if (sx > -TILE && sx < canvas.width + TILE && sy > -TILE && sy < canvas.height + TILE) {
        ctx.fillStyle = `rgba(255,255,0,${0.15 + Math.sin(t) * 0.1})`;
        ctx.fillRect(sx, sy, TILE, TILE);
        ctx.font = '8px monospace'; ctx.fillStyle = '#ff0'; ctx.textAlign = 'center';
        ctx.fillText('▶EXIT', sx + 16, sy + 16);
      }
    });
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (gameState === 'explore' || gameState === 'dialog') {
      drawMap(); drawItems(); drawExits(); drawNPCs(); drawPerry();
    }
  }

  // ── Dialog ───────────────────────────────────────────────────
  function showDialog(messages, callback) {
    dialogQueue = Array.isArray(messages) ? [...messages] : [messages];
    dialogCallback = callback || null;
    gameState = 'dialog';
    showNextDialog();
  }

  function showNextDialog() {
    if (dialogQueue.length === 0) {
      gameState = 'explore';        // always reset first; showDialog() in callback will re-set if needed
      onDialogClear();
      const cb = dialogCallback;
      dialogCallback = null;
      if (cb) cb();
      return;
    }
    const msg = dialogQueue.shift();
    let i = 0;
    if (dialogTypeInterval) clearInterval(dialogTypeInterval);
    if (dialogAdvanceKey) document.removeEventListener('keydown', dialogAdvanceKey);

    function advance() {
      if (i < msg.length) {
        if (dialogTypeInterval) clearInterval(dialogTypeInterval);
        i = msg.length;
        onDialog(msg, true);
      } else {
        if (dialogAdvanceKey) document.removeEventListener('keydown', dialogAdvanceKey);
        onDialog('', false);
        showNextDialog();
      }
    }

    dialogTypeInterval = setInterval(() => {
      if (i < msg.length) { i++; onDialog(msg.slice(0, i), i === msg.length); }
      else { clearInterval(dialogTypeInterval); }
    }, 25);

    dialogAdvanceKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'z') advance();
    };
    document.addEventListener('keydown', dialogAdvanceKey);

    // return advance so UI can call it on click
    return advance;
  }

  // ── Movement ─────────────────────────────────────────────────
  function tryMove(dx, dy) {
    if (gameState !== 'explore') return;
    const nx = perry.x + dx;
    const ny = perry.y + dy;
    if (dx < 0) perry.dir = 'left';
    if (dx > 0) perry.dir = 'right';
    if (dy < 0) perry.dir = 'up';
    if (dy > 0) perry.dir = 'down';
    if (nx < 0 || nx >= currentMap.width || ny < 0 || ny >= currentMap.height) return;

    const npc = mapNpcs.find(n => n.x === nx && n.y === ny);
    if (npc) {
      showDialog(npc.dialog, () => {
        if (npc.action === 'heal') { perry.hp = perry.maxHp; updateHUD(); showDialog(["Perry's health was fully restored!"]); }
      });
      return;
    }

    if (isSolid(nx, ny)) {
      const tile = getTile(nx, ny);
      if (currentMap.interactTiles?.[tile]) showDialog(currentMap.interactTiles[tile]);
      return;
    }

    perry.x = nx; perry.y = ny;
    updateCamera();

    if (mapTransitionCooldown > 0) { mapTransitionCooldown--; }
    else if (currentMap.exits) {
      const exit = currentMap.exits.find(e => e.x === nx && e.y === ny);
      if (exit) {
        showDialog([`Heading to ${exit.label}...`], () => loadMap(exit.toMap, exit.toX, exit.toY));
        return;
      }
    }

    const item = mapItems.find(it => it.x === nx && it.y === ny && !it.collected);
    if (item) {
      item.collected = true;
      if (item.type === 'heal') { perry.hp = Math.min(perry.maxHp, perry.hp + item.value); updateHUD(); showDialog([`Found ${item.name}! Restored ${item.value} HP!`]); }
      else if (item.type === 'atkUp') { perry.atk += item.value; showDialog([`Found ${item.name}! Attack +${item.value}!`]); }
      return;
    }

    if (encounterCooldown > 0) { encounterCooldown--; return; }
    const tile = getTile(nx, ny);
    if (currentMap.encounterTiles.has(tile) && Math.random() < currentMap.encounterRate) triggerEncounter();
  }

  // ── Battle ───────────────────────────────────────────────────
  function triggerEncounter() {
    const eligible = currentMap.enemies.filter(e => e.level <= perry.level + 4);
    if (!eligible.length) return;
    const weights = eligible.map(e => Math.max(1, 6 - Math.abs(e.level - perry.level)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let chosen = eligible[0];
    for (let i = 0; i < eligible.length; i++) { r -= weights[i]; if (r <= 0) { chosen = eligible[i]; break; } }
    const sf = 1 + (perry.level - chosen.level) * 0.12;
    currentEnemy = {
      ...chosen,
      hp: Math.round(chosen.hp * Math.max(0.8, sf)),
      maxHp: Math.round(chosen.hp * Math.max(0.8, sf)),
      atk: Math.round(chosen.atk * Math.max(0.8, sf)),
      def: Math.round(chosen.def * Math.max(0.8, sf)),
      confused: false,
    };
    encounterCooldown = 5;
    startBattle();
  }

  function getBattleState(log, menuPhase) {
    return {
      enemy: currentEnemy,
      perry: { hp: perry.hp, maxHp: perry.maxHp, level: perry.level, moves: perry.moves },
      log, menuPhase,
    };
  }

  function startBattle() {
    gameState = 'battle'; battleTurn = 'player';
    onBattleUpdate(getBattleState(currentEnemy.flavor, 'menu'));
  }

  function playerAttack(mi) {
    if (battleTurn !== 'player') return;
    battleTurn = 'animating';
    const move = perry.moves[mi];
    onBattleUpdate(getBattleState('...', 'waiting'));

    if (move.type === 'heal') {
      const h = Math.min(move.healAmt, perry.maxHp - perry.hp);
      perry.hp += h;
      updateHUD();
      onBattleUpdate(getBattleState(`Perry uses ${move.name}! Healed ${h} HP!`, 'waiting'));
      setTimeout(() => enemyTurn(), 1200);
      return;
    }
    if (Math.random() > (move.accuracy || 1.0)) {
      onBattleUpdate(getBattleState(`Perry uses ${move.name}! But it missed!`, 'waiting'));
      setTimeout(() => enemyTurn(), 1200);
      return;
    }
    const v = 0.85 + Math.random() * 0.3;
    let dmg = Math.max(1, Math.round((move.power + perry.atk) * v - currentEnemy.def * 0.5));
    let crit = false;
    if (Math.random() < 0.1) { dmg = Math.round(dmg * 1.5); crit = true; }
    currentEnemy.hp = Math.max(0, currentEnemy.hp - dmg);
    let msg = `Perry uses ${move.name}! ${dmg} damage!`;
    if (crit) msg += ' CRITICAL HIT!';
    if (move.effect === 'confuse' && Math.random() < (move.effectChance || 0.3)) {
      currentEnemy.confused = true; msg += ` ${currentEnemy.name} is confused!`;
    }
    onBattleUpdate(getBattleState(msg, 'waiting'));
    if (currentEnemy.hp <= 0) setTimeout(() => battleWin(), 1000);
    else setTimeout(() => enemyTurn(), 1200);
  }

  function enemyTurn() {
    battleTurn = 'enemy';
    if (currentEnemy.confused && Math.random() < 0.4) {
      const sd = Math.round(currentEnemy.atk * 0.3);
      currentEnemy.hp = Math.max(0, currentEnemy.hp - sd);
      onBattleUpdate(getBattleState(`${currentEnemy.name} is confused and hurt itself for ${sd}!`, 'waiting'));
      if (currentEnemy.hp <= 0) { setTimeout(() => battleWin(), 1000); return; }
      setTimeout(() => { battleTurn = 'player'; onBattleUpdate(getBattleState('Your turn!', 'menu')); }, 1000);
      return;
    }
    const mn = currentEnemy.moves[Math.floor(Math.random() * currentEnemy.moves.length)];
    const v = 0.85 + Math.random() * 0.3;
    let dmg = Math.max(1, Math.round(currentEnemy.atk * v - perry.def * 0.4));
    perry.hp = Math.max(0, perry.hp - dmg);
    updateHUD();
    onBattleUpdate(getBattleState(`${currentEnemy.name} uses ${mn}! ${dmg} damage to Perry!`, 'waiting'));
    if (perry.hp <= 0) setTimeout(() => battleLose(), 1000);
    else setTimeout(() => { battleTurn = 'player'; onBattleUpdate(getBattleState('Your turn!', 'menu')); }, 1000);
  }

  function battleWin() {
    const xp = currentEnemy.exp;
    perry.exp += xp;
    onBattleUpdate(getBattleState(`${currentEnemy.name} was defeated! +${xp} EXP!`, 'waiting'));
    setTimeout(() => {
      let leveled = false;
      while (perry.exp >= perry.expNext) {
        perry.exp -= perry.expNext; perry.level++;
        perry.maxHp += 5; perry.hp = perry.maxHp;
        perry.atk += 2; perry.def += 1; perry.spd += 1;
        perry.expNext = Math.round(perry.expNext * 1.4);
        leveled = true;
      }
      updateHUD();
      if (leveled) {
        onBattleUpdate(getBattleState(`LEVEL UP! Perry is now Lv.${perry.level}!`, 'waiting'));
        setTimeout(() => endBattle(), 1500);
      } else endBattle();
    }, 1000);
  }

  function battleLose() {
    onBattleUpdate(getBattleState('Perry blacked out! He wakes up on the couch...', 'waiting'));
    setTimeout(() => {
      perry.hp = Math.round(perry.maxHp * 0.5);
      loadMap('apartment', 3, 5);
      updateHUD();
      endBattle();
    }, 2000);
  }

  function endBattle() {
    currentEnemy = null;
    gameState = 'explore';
    onBattleEnd();
    render();
  }

  function tryRun() {
    if (Math.random() < 0.6 + perry.spd * 0.02) {
      onBattleUpdate(getBattleState('Got away safely!', 'waiting'));
      setTimeout(() => { encounterCooldown = 8; endBattle(); }, 800);
    } else {
      onBattleUpdate(getBattleState("Can't escape!", 'waiting'));
      setTimeout(() => enemyTurn(), 1000);
    }
  }

  // ── Input ────────────────────────────────────────────────────
  function handleKeyDown(e) {
    if (gameState === 'explore') {
      let moved = false;
      switch (e.key) {
        case 'ArrowUp': case 'w': tryMove(0, -1); moved = true; break;
        case 'ArrowDown': case 's': tryMove(0, 1); moved = true; break;
        case 'ArrowLeft': case 'a': tryMove(-1, 0); moved = true; break;
        case 'ArrowRight': case 'd': tryMove(1, 0); moved = true; break;
      }
      if (moved) render();
    }
  }

  // ── Game loop ────────────────────────────────────────────────
  function gameLoop() {
    if (gameState === 'explore') render();
    rafId = requestAnimationFrame(gameLoop);
  }

  // ── Start ────────────────────────────────────────────────────
  function startGame() {
    loadMap('apartment');
    gameState = 'explore';
    updateHUD();
    render();
    showDialog([
      "Perry Caravello wakes up in his apartment...",
      "The place is a disaster. Trash everywhere. Things are... moving.",
      "🎩 'What the hell happened in here?!'",
      "Use WASD or Arrow Keys to move. Walk into objects to inspect them.",
      "Watch out — creatures lurk among the mess!",
      "Find the EXIT to explore Reseda City!",
    ]);
  }

  document.addEventListener('keydown', handleKeyDown);
  rafId = requestAnimationFrame(gameLoop);

  return {
    startGame,
    playerAttack,
    tryRun,
    move: (dx, dy) => {
      if (gameState === 'explore') { tryMove(dx, dy); render(); }
    },
    advanceDialog: () => {
      // called when user clicks the dialog box
      if (dialogAdvanceKey) {
        dialogAdvanceKey({ key: 'Enter' });
      }
    },
    cleanup: () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (dialogAdvanceKey) document.removeEventListener('keydown', dialogAdvanceKey);
      if (dialogTypeInterval) clearInterval(dialogTypeInterval);
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}

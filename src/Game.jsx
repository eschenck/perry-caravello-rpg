import { useEffect, useRef, useState, useCallback } from 'react';
import { initGame } from './game/engine.js';
import './Game.css';

function DPad({ onMove }) {
  const repeatRef = useRef(null);

  const startMove = useCallback((dx, dy, e) => {
    e.preventDefault();
    onMove(dx, dy);
    repeatRef.current = setInterval(() => onMove(dx, dy), 150);
  }, [onMove]);

  const stopMove = useCallback((e) => {
    e.preventDefault();
    clearInterval(repeatRef.current);
  }, []);

  const btn = (label, dx, dy, cls) => (
    <button
      className={`dpad-btn ${cls}`}
      onPointerDown={(e) => startMove(dx, dy, e)}
      onPointerUp={stopMove}
      onPointerLeave={stopMove}
      onPointerCancel={stopMove}
    >
      {label}
    </button>
  );

  return (
    <div className="dpad">
      {btn('▲', 0, -1, 'dpad-up')}
      {btn('◀', -1, 0, 'dpad-left')}
      <div className="dpad-center" />
      {btn('▶', 1, 0, 'dpad-right')}
      {btn('▼', 0, 1, 'dpad-down')}
    </div>
  );
}

export default function Game() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const [phase, setPhase] = useState('title'); // title | explore | battle
  const [hud, setHud] = useState({ level: 1, hp: 30, maxHp: 30, exp: 0, expNext: 10 });
  const [mapName, setMapName] = useState('');
  const [dialog, setDialog] = useState({ text: '', done: false, visible: false });
  const [battle, setBattle] = useState(null); // null | { enemy, perry, log, menuPhase }
  const [battleMenu, setBattleMenu] = useState('menu'); // menu | moves

  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = initGame(canvas, {
      onHudUpdate: (h) => setHud(h),
      onMapName: (n) => setMapName(n),
      onPhase: (p) => setPhase(p),
      onDialog: (text, done) => setDialog({ text, done, visible: true }),
      onDialogClear: () => setDialog(d => ({ ...d, visible: false })),
      onBattleUpdate: (state) => {
        setBattle(state);
        setBattleMenu('menu');
        setPhase('battle');
      },
      onBattleEnd: () => {
        setBattle(null);
        setPhase('explore');
      },
    });
    engineRef.current = engine;

    return engine.cleanup;
  }, []);

  const handleStart = useCallback(() => {
    setPhase('explore');
    engineRef.current?.startGame();
  }, []);

  const handleDialogClick = useCallback(() => {
    engineRef.current?.advanceDialog();
  }, []);

  const handleFight = useCallback(() => setBattleMenu('moves'), []);

  const handleRun = useCallback(() => {
    setBattleMenu('menu');
    engineRef.current?.tryRun();
  }, []);

  const handleMove = useCallback((i) => {
    setBattleMenu('menu');
    engineRef.current?.playerAttack(i);
  }, []);

  const handleBack = useCallback(() => setBattleMenu('menu'), []);

  const hpPct = (hp, max) => Math.max(0, (hp / max) * 100);

  return (
    <div className="game-container">
      <canvas ref={canvasRef} width={640} height={480} />

      {/* ── Title screen ── */}
      {phase === 'title' && (
        <div className="title-screen">
          <h1>PERRY CARAVELLO&apos;S<br />APARTMENT RPG</h1>
          <h2>~ A Messy Adventure ~</h2>
          <button className="btn-primary" onClick={handleStart}>START GAME</button>
        </div>
      )}

      {/* ── HUD ── */}
      {phase !== 'title' && (
        <div className="hud">
          <div>🎩 Perry Lv.{hud.level}</div>
          <div>HP: {hud.hp}/{hud.maxHp}</div>
          <div>EXP: {hud.exp}/{hud.expNext}</div>
        </div>
      )}

      {/* ── Map name ── */}
      {phase !== 'title' && mapName && (
        <div className="map-label">{mapName}</div>
      )}

      {/* ── Dialog ── */}
      {dialog.visible && (
        <div
          className="dialog-box"
          onPointerDown={(e) => { e.preventDefault(); handleDialogClick(); }}
        >
          {dialog.text}{dialog.done ? ' ▼' : ''}
        </div>
      )}

      {/* ── Virtual D-pad (touch / mobile) ── */}
      {phase === 'explore' && (
        <DPad onMove={(dx, dy) => engineRef.current?.move(dx, dy)} />
      )}

      {/* ── Action button: advance dialog on touch ── */}
      {phase === 'dialog' && dialog.visible && (
        <button
          className="action-btn"
          onPointerDown={(e) => { e.preventDefault(); handleDialogClick(); }}
        >
          A
        </button>
      )}

      {/* ── Battle overlay ── */}
      {phase === 'battle' && battle && (
        <div className="battle-overlay">
          <div className="battle-scene">
            {/* Enemy */}
            <div className="battle-name">{battle.enemy.name} Lv.{battle.enemy.level}</div>
            <div className="hp-row">
              HP:
              <div className="hp-bar-wrap">
                <div
                  className={`hp-bar${hpPct(battle.enemy.hp, battle.enemy.maxHp) < 25 ? ' low' : ''}`}
                  style={{ width: `${hpPct(battle.enemy.hp, battle.enemy.maxHp)}%` }}
                />
              </div>
              {battle.enemy.hp}/{battle.enemy.maxHp}
            </div>
            <span className="battle-sprite">{battle.enemy.emoji}</span>

            <hr className="battle-divider" />

            {/* Perry */}
            <span className="battle-sprite">🎩🚶</span>
            <div className="battle-name">Perry Lv.{battle.perry.level}</div>
            <div className="hp-row">
              HP:
              <div className="hp-bar-wrap">
                <div
                  className={`hp-bar${hpPct(battle.perry.hp, battle.perry.maxHp) < 25 ? ' low' : ''}`}
                  style={{ width: `${hpPct(battle.perry.hp, battle.perry.maxHp)}%` }}
                />
              </div>
              {battle.perry.hp}/{battle.perry.maxHp}
            </div>
          </div>

          {/* Menu */}
          {battleMenu === 'menu' && battle.menuPhase === 'menu' && (
            <div className="battle-menu">
              <button onClick={handleFight}>⚔️ Fight</button>
              <button onClick={handleRun}>🏃 Run</button>
            </div>
          )}

          {/* Moves */}
          {battleMenu === 'moves' && (
            <div className="moves-list">
              {battle.perry.moves.map((m, i) => (
                <button key={i} onClick={() => handleMove(i)}>
                  {m.name} <span className="move-type">[{m.type}] {m.desc}</span>
                </button>
              ))}
              <button onClick={handleBack}>← Back</button>
            </div>
          )}

          <div className="battle-log">{battle.log}</div>
        </div>
      )}
    </div>
  );
}

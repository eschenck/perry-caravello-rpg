import { useEffect, useRef, useState, useCallback } from 'react';
import { initGame } from './game/engine.js';
import { playMusic } from './audio/musicManager.js';
import Perry3D from './Perry3D.jsx';
import './Game.css';

const MAP_MUSIC = {
  "Perry's Apartment": 'apartment',
  'Reseda City':       'reseda',
  'Palm Springs':      'palmsprings',
};

function DPad({ onMove }) {
  const intervalsRef = useRef(new Map());

  // Clear all running intervals when the component unmounts (e.g. battle starts mid-press)
  useEffect(() => {
    return () => {
      intervalsRef.current.forEach((id) => clearInterval(id));
      intervalsRef.current.clear();
    };
  }, []);

  const startMove = useCallback((dx, dy, e) => {
    e.preventDefault();
    // Capture this pointer so pointerup/cancel fire on this element even if finger drifts
    e.currentTarget.setPointerCapture(e.pointerId);
    // Clear any stale interval for this pointer before starting a new one
    if (intervalsRef.current.has(e.pointerId)) {
      clearInterval(intervalsRef.current.get(e.pointerId));
    }
    onMove(dx, dy);
    const id = setInterval(() => onMove(dx, dy), 150);
    intervalsRef.current.set(e.pointerId, id);
  }, [onMove]);

  const stopMove = useCallback((e) => {
    e.preventDefault();
    if (intervalsRef.current.has(e.pointerId)) {
      clearInterval(intervalsRef.current.get(e.pointerId));
      intervalsRef.current.delete(e.pointerId);
    }
  }, []);

  const btn = (label, dx, dy, cls) => (
    <button
      className={`dpad-btn ${cls}`}
      onPointerDown={(e) => startMove(dx, dy, e)}
      onPointerUp={stopMove}
      onPointerCancel={stopMove}
      // onPointerLeave intentionally omitted: pointerleave bypasses setPointerCapture
      // and would fire on any tiny finger drift, killing the interval prematurely.
      // pointerUp/Cancel are sufficient because setPointerCapture routes them here.
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
  const [battlePhase, setBattlePhase] = useState('entering'); // entering | fighting | won | lost
  const [attackAnimation, setAttackAnimation] = useState(null); // { attacker, move, target }
  const [hitAnimation, setHitAnimation] = useState(null); // 'perry' | 'enemy' | null
  const [battleLocked, setBattleLocked] = useState(false); // Prevent input during animations

  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = initGame(canvas, {
      onHudUpdate: (h) => setHud(h),
      onMapName: (n) => setMapName(n),
      onPhase: (p) => setPhase(p),
      onDialog: (text, done) => setDialog({ text, done, visible: true }),
      onDialogClear: () => setDialog(d => ({ ...d, visible: false })),
      onBattleUpdate: (state) => {
        setBattle(prevBattle => {
          // Only reset to entering if this is a new battle (no previous battle)
          if (!prevBattle) {
            setBattlePhase('entering');
            setTimeout(() => setBattlePhase('fighting'), 2000);
            return state;
          }
          
          // Check if this is an enemy attack — log must start with the enemy's name
          // (Perry's attack messages start with "Perry uses ..." and must not trigger this)
          const isEnemyAttack = state.enemy &&
            state.enemy.hp > 0 &&
            state.log &&
            state.log.startsWith(state.enemy.name + ' uses ');

          if (isEnemyAttack) {
            const enemyName = state.enemy.name;
            const logText = state.log;
            
            // Extract move name from log: "Cockroach uses Skitter! 5 damage to Perry!"
            const moveMatch = logText.match(/uses ([^!]+)!/);
            const moveName = moveMatch ? moveMatch[1] : '';
            
            console.log('Enemy attack detected:', enemyName, 'uses', moveName);
            
            // DELAY enemy animation until Perry's attack finishes (if one is playing)
            const delay = attackAnimation ? 1500 : 0; // Wait for Perry's animation + buffer
            
            setTimeout(() => {
              // Trigger enemy attack animation
              setAttackAnimation({ 
                attacker: 'enemy', 
                move: moveName, 
                target: 'perry',
                enemyEmoji: state.enemy.emoji
              });
              
              // Show Perry getting hit after enemy attack animation
              setTimeout(() => {
                setHitAnimation('perry');
                setTimeout(() => setHitAnimation(null), 500);
                setAttackAnimation(null);
                setBattleLocked(false); // Unlock battle after enemy animation completes
              }, 1200);
            }, delay);
          }
          
          return state;
        });
        setBattleMenu('menu');
        setPhase('battle');
      },
      onBattleEnd: () => {
        setBattle(null);
        setBattlePhase('entering');
        setAttackAnimation(null);
        setHitAnimation(null);
        setPhase('explore');
      },
    });
    engineRef.current = engine;

    return engine.cleanup;
  }, []);

  // Music: switch tracks on map change (during exploration)
  useEffect(() => {
    if (phase === 'explore' && mapName) {
      playMusic(MAP_MUSIC[mapName] || 'apartment');
    }
  }, [mapName, phase]);

  // Debug: log when attackAnimation changes
  useEffect(() => {
    console.log('attackAnimation state changed:', attackAnimation);
  }, [attackAnimation]);

  // Music: battle track / restore map track
  useEffect(() => {
    if (phase === 'battle') playMusic('battle');
  }, [phase]);

  const handleStart = useCallback(() => {
    playMusic('apartment');
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
    if (battleLocked) return; // Prevent input during animations
    
    setBattleMenu('menu');
    setBattleLocked(true); // Lock battle during sequence
    const move = battle.perry.moves[i];
    
    console.log('Attack triggered:', move.name);
    
    // Trigger attack animation
    setAttackAnimation({ attacker: 'perry', move: move.name, target: 'enemy' });
    
    // Show hit animation after attack animation, then clear
    setTimeout(() => {
      if (move.name !== 'Snack Break') { // Healing move doesn't hit enemy
        setHitAnimation('enemy');
        setTimeout(() => setHitAnimation(null), 500);
      }
      setAttackAnimation(null);
      
      // Call engine AFTER Perry's animation is completely done
      setTimeout(() => {
        engineRef.current?.playerAttack(i);
        // Battle will be unlocked after enemy responds (or immediately if no enemy response)
        setTimeout(() => setBattleLocked(false), 3000); // Failsafe unlock
      }, 500);
      
    }, 1200);
  }, [battle, battleLocked]);

  const handleBack = useCallback(() => setBattleMenu('menu'), []);

  const hpPct = (hp, max) => Math.max(0, (hp / max) * 100);

  return (
    <div className="game-wrapper">
    <div className="game-container">
      <canvas ref={canvasRef} width={640} height={480} />

      {/* ── Title screen ── */}
      {phase === 'title' && (
        <div className="title-screen" onPointerDown={() => playMusic('title')}>
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

      {/* ── Battle overlay ── */}
      {phase === 'battle' && battle && (
        <div className="battle-overlay">
          {/* Comic Book Battle Scene */}
          <div className="comic-battle-arena">
            {/* VS Animation (only at start) */}
            {battlePhase === 'entering' && !attackAnimation && (
              <div className="vs-animation">
                <div className="vs-text">VS</div>
                <div className="vs-sparks">⚡💥⚡</div>
              </div>
            )}

            {/* Perry Side (Upper Left) */}
            <div className={`fighter perry-fighter upper-left ${battlePhase === 'entering' ? 'slide-in-left' : 'fighting'} ${hitAnimation === 'perry' ? 'hit-shake' : ''}`}>
              <div className="fighter-portrait perry-portrait">
                <div className="comic-bubble perry-bubble">
                  <Perry3D />
                </div>
                <div className="fighter-info perry-info">
                  <div className="fighter-name">Perry Lv.{battle.perry.level}</div>
                  <div className="hp-display">
                    <div className="hp-bar-container">
                      <div 
                        className={`hp-bar ${hpPct(battle.perry.hp, battle.perry.maxHp) < 25 ? 'low' : ''}`}
                        style={{ width: `${hpPct(battle.perry.hp, battle.perry.maxHp)}%` }}
                      />
                    </div>
                    <span className="hp-text">{battle.perry.hp}/{battle.perry.maxHp}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Attack Animations */}
            {attackAnimation && (
              <div className={`attack-effect ${attackAnimation.attacker}-attack ${attackAnimation.move.toLowerCase().replace(/\s+/g, '-')}`}>
                {console.log('Animation classes:', `attack-effect ${attackAnimation.attacker}-attack ${attackAnimation.move.toLowerCase().replace(/\s+/g, '-')}`)}
                
                {/* Perry's Attacks */}
                {attackAnimation.attacker === 'perry' && (
                  <>
                    {attackAnimation.move === 'Fedora Toss' && <div className="fedora-projectile">🎩</div>}
                    {attackAnimation.move === 'Banshee Voice' && <div className="banshee-waves">👻💨🌪️</div>}
                    {attackAnimation.move === 'Belly Bump' && <div className="belly-impact">💥</div>}
                    {attackAnimation.move === 'Snack Break' && <div className="healing-food">🐟✨</div>}
                  </>
                )}
                
                {/* Enemy Attacks */}
                {attackAnimation.attacker === 'enemy' && (
                  <>
                    {/* Basic Attacks */}
                    {attackAnimation.move === 'Bite' && <div className="bite-attack">🦷💥</div>}
                    {attackAnimation.move === 'Sting' && <div className="sting-attack">💉⚡</div>}
                    {attackAnimation.move === 'Howl' && <div className="howl-attack">🌊🔊</div>}
                    {attackAnimation.move === 'Skitter' && <div className="skitter-attack">💨🏃</div>}
                    {attackAnimation.move === 'Kickflip' && <div className="kickflip-attack">🛹⚡</div>}
                    
                    {/* Projectile Attacks */}
                    {(attackAnimation.move === 'Garbage Toss' || attackAnimation.move === 'Textbook Throw') && 
                      <div className="projectile-attack">📚💥</div>}
                    
                    {/* Area Attacks */}
                    {(attackAnimation.move === 'Spore Cloud' || attackAnimation.move === 'Stink Cloud' || attackAnimation.move === 'Disease Cloud') && 
                      <div className="cloud-attack">☁️🤢</div>}
                    
                    {/* Energy/Magic Attacks */}
                    {(attackAnimation.move === 'Dazzle' || attackAnimation.move === 'Camera Flash') && 
                      <div className="flash-attack">✨💫⚡</div>}
                    
                    {/* Swarm Attacks */}
                    {(attackAnimation.move === 'Swarm Rush' || attackAnimation.move === 'Rat Swarm') && 
                      <div className="swarm-attack">{attackAnimation.enemyEmoji}{attackAnimation.enemyEmoji}{attackAnimation.enemyEmoji}</div>}
                    
                    {/* Default for unhandled moves - show enemy emoji attacking */}
                    {!['Bite', 'Sting', 'Howl', 'Skitter', 'Kickflip', 'Garbage Toss', 'Textbook Throw', 'Spore Cloud', 'Stink Cloud', 'Disease Cloud', 'Dazzle', 'Camera Flash', 'Swarm Rush', 'Rat Swarm'].includes(attackAnimation.move) && 
                      <div className="generic-attack">{attackAnimation.enemyEmoji}💥</div>}
                  </>
                )}
              </div>
            )}

            {/* Enemy Side (Lower Right) */}
            <div className={`fighter enemy-fighter lower-right ${battlePhase === 'entering' ? 'slide-in-right' : 'fighting'} ${hitAnimation === 'enemy' ? 'hit-shake' : ''}`}>
              <div className="fighter-portrait enemy-portrait">
                <div className="comic-bubble enemy-bubble">
                  <span className="battle-emoji">{battle.enemy.emoji}</span>
                </div>
                <div className="fighter-info enemy-info">
                  <div className="fighter-name">{battle.enemy.name} Lv.{battle.enemy.level}</div>
                  <div className="hp-display">
                    <div className="hp-bar-container">
                      <div 
                        className={`hp-bar ${hpPct(battle.enemy.hp, battle.enemy.maxHp) < 25 ? 'low' : ''}`}
                        style={{ width: `${hpPct(battle.enemy.hp, battle.enemy.maxHp)}%` }}
                      />
                    </div>
                    <span className="hp-text">{battle.enemy.hp}/{battle.enemy.maxHp}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Battle Log */}
          <div className="battle-log-container">
            <div className="battle-log">{battle.log}</div>
          </div>

          {/* Modal Battle Menu */}
          {battlePhase === 'fighting' && (
            <>
              {battleMenu === 'menu' && battle.menuPhase === 'menu' && (
                <div className="battle-modal">
                  <div className="battle-menu-modal">
                    <h3>Choose Action</h3>
                    <button onClick={handleFight} className="menu-btn fight-btn">⚔️ Fight</button>
                    <button onClick={handleRun} className="menu-btn run-btn">🏃 Run</button>
                  </div>
                </div>
              )}

              {battleMenu === 'moves' && (
                <div className="battle-modal">
                  <div className="moves-menu-modal">
                    <h3>Select Move</h3>
                    <div className="moves-grid">
                      {battle.perry.moves.map((m, i) => (
                        <button key={i} onClick={() => handleMove(i)} className="move-btn">
                          <span className="move-name">{m.name}</span>
                          <span className="move-details">[{m.type}] {m.desc}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={handleBack} className="back-btn">← Back</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>

      {/* ── Mobile controls below game window ── */}
      <div className="mobile-controls">
        {phase === 'explore' && (
          <DPad onMove={(dx, dy) => engineRef.current?.move(dx, dy)} />
        )}
        {phase === 'dialog' && dialog.visible && (
          <button
            className="action-btn"
            onPointerDown={(e) => { e.preventDefault(); handleDialogClick(); }}
          >
            A
          </button>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { createGame } from '../engine/Game';
import { Unit as EngineUnit, UnitType } from '../engine/Unit';
import { getLogs, subscribeLogs } from '../engine/logs';

type Snapshot = {
  units: EngineUnit[];
  towers: any[];
  width: number;
  height: number;
  energy: { player: number; enemy: number };
  cooldowns: any;
};

export default function GameCanvas({ onExit }: { onExit?: () => void }) {
  const width = 900;
  const height = 400;
  const groundHeight = 56;
  const baselineY = height - groundHeight - 6;

  const gameRef = useRef<any | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const [, setTick] = useState(0);
  const [uiLogs, setUiLogs] = useState<string[]>([]);
  const snapshotRef = useRef<Snapshot | null>(null);

  useEffect(() => {
    const game = createGame(width, height);
    gameRef.current = game;

    // inicializar logs en UI
    const initial = getLogs();
    setUiLogs(initial);
    const unsub = subscribeLogs(() => setUiLogs(getLogs()));

    function loop(t: number) {
      if (lastRef.current == null) lastRef.current = t;
      const deltaMs = t - lastRef.current;
      lastRef.current = t;
      const delta = Math.min(0.05, deltaMs / 1000);

      game.update(delta);
      snapshotRef.current = game.getSnapshot();
      setTick(t => t + 1); // trigger re-render to update SVG

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      unsub();
    };
  }, []);

  if (!snapshotRef.current) return <div>Loading...</div>;

  const snap = snapshotRef.current;
  const kills = (snapshotRef.current as any).kills ?? { player: 0, enemy: 0 };

  const handleSpawn = (team: 'player' | 'enemy', type: UnitType) => {
    const g = gameRef.current;
    if (!g) return;
    g.spawnUnit(team, type);
  };

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ position: 'relative' }}>
        <svg width={snap.width} height={snap.height} style={{ background: '#0b1220' }}>
        {/* ground */}
        <rect x={0} y={snap.height - groundHeight} width={snap.width} height={groundHeight} fill="#2b2b2b" />

        {/* towers */}
        {snap.towers.map(t => (
          <g key={t.id} transform={`translate(${t.pos.x}, ${baselineY})`}>
            {/* tower body - draw from baseline upwards */}
            <rect x={-22} y={-56} width={44} height={56} fill={t.team === 'player' ? '#1e3a8a' : '#991b1b'} />
            {/* base */}
            <rect x={-30} y={0} width={60} height={8} fill="#111" />
            {/* hp bar */}
            <rect x={-20} y={-64} width={40} height={6} fill="#111" />
            <rect x={-20} y={-64} width={40 * (t.hp / t.maxHp)} height={6} fill="#10b981" />
          </g>
        ))}

        {/* units */}
        {snap.units.map(u => {
          const isRanged = !!u.isRanged;

  const setOrder = (order: 'attack' | 'advance' | 'retreat' | 'moveToFlag') => {
    const g = gameRef.current;
    if (!g) return;
    g.setPlayerOrder(order);
  };

  const [placingFlag, setPlacingFlag] = useState(false);

  const onSvgClick = (e: React.MouseEvent<SVGElement, MouseEvent>) => {
    if (!placingFlag) return;
    const svg = e.currentTarget as SVGElement;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const g = gameRef.current;
    if (!g) return;
    g.placeFlag(x, y);
    setPlacingFlag(false);
  };
          // ranged are taller (height > width) to visually differ
          const w = isRanged ? u.size * 0.8 : u.size;
          const h = isRanged ? u.size * 1.6 : u.size;
          return (
            <g key={u.id} transform={`translate(${u.pos.x}, ${baselineY})`}>
              {/* unit body */}
              <rect x={-w / 2} y={-h} width={w} height={h} fill={u.team === 'player' ? '#6ee7b7' : '#fca5a5'} rx={2} />
              {/* hp bar above head */}
              <rect x={-w / 2} y={-h - 8} width={w} height={4} fill="#000" />
              <rect x={-w / 2} y={-h - 8} width={w * Math.max(0, u.hp / u.maxHp)} height={4} fill="#10b981" />
            </g>
          );
        })}
      </svg>
        {/* floating mana counter top-left */}
        <div style={{ position: 'absolute', left: 8, top: 8, color: '#fff', background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: 6 }}>
          <div style={{ fontSize: 12 }}>Energy</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{snap.energy.player}</div>
        </div>
      </div>

      <div style={{ width: 260, color: '#fff' }}>
        <h3>Controles</h3>
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => handleSpawn('player', 'melee')}
            disabled={(snapshotRef.current?.cooldowns.player.melee ?? 0) > 0 || snap.energy.player < 100}
          >
            Melee — Cost: 100 — Respawn: 4s
          </button>
          <div>Cooldown: {Math.ceil(snapshotRef.current?.cooldowns.player.melee ?? 0)}s</div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => handleSpawn('player', 'ranged')}
            disabled={(snapshotRef.current?.cooldowns.player.ranged ?? 0) > 0 || snap.energy.player < 150}
          >
            Ranged — Cost: 150 — Respawn: 5s
          </button>
          <div>Cooldown: {Math.ceil(snapshotRef.current?.cooldowns.player.ranged ?? 0)}s</div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div>Energy (Player): {snap.energy.player}</div>
          <div>Energy (Enemy): {snap.energy.enemy}</div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div>Kills (Player): {kills.player}</div>
          <div>Kills (Enemy): {kills.enemy}</div>
          <div>Elapsed: {Math.floor(snap.time)}s</div>
        </div>

        <hr style={{ borderColor: '#333', margin: '12px 0' }} />
        <h4>Enemy Spawn (manual)</h4>
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => handleSpawn('enemy', 'melee')}
            disabled={(snapshotRef.current?.cooldowns.enemy.melee ?? 0) > 0 || snap.energy.enemy < 100}
          >
            Enemy Melee — Cost: 100
          </button>
          <div>Cooldown: {Math.ceil(snapshotRef.current?.cooldowns.enemy.melee ?? 0)}s</div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => handleSpawn('enemy', 'ranged')}
            disabled={(snapshotRef.current?.cooldowns.enemy.ranged ?? 0) > 0 || snap.energy.enemy < 150}
          >
            Enemy Ranged — Cost: 150
          </button>
          <div>Cooldown: {Math.ceil(snapshotRef.current?.cooldowns.enemy.ranged ?? 0)}s</div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={() => onExit && onExit()}>Salir</button>
        </div>
        <hr style={{ borderColor: '#333', margin: '12px 0' }} />
        <h4>Logs (en pantalla)</h4>
        <div style={{ background: '#000', color: '#0f0', padding: 8, height: 200, overflow: 'auto', fontSize: 12, fontFamily: 'monospace' }}>
          {uiLogs.slice().reverse().map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

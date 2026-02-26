import { Unit, Team } from './Unit';

export type Tower = {
  id: string;
  team: Team;
  pos: { x: number; y: number };
  hp: number;
  maxHp: number;
};

export function distanceSq(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// Find first enemy in front (by direction) within attack range; prefer units, then tower
export type Target = { kind: 'unit'; unit: Unit } | { kind: 'tower'; tower: Tower } | null;

export function findTarget(unit: Unit, units: Unit[], towers: Tower[]): Target {
  const dir = unit.team === 'player' ? 1 : -1;

  // enemies ahead (same horizontal lane) - sort by distance along x
  const enemiesAhead = units
    .filter(u => u.alive && u.team !== unit.team && Math.sign(u.pos.x - unit.pos.x) === dir)
    .sort((a, b) => Math.abs(a.pos.x - unit.pos.x) - Math.abs(b.pos.x - unit.pos.x));

  if (enemiesAhead.length > 0) {
    const first = enemiesAhead[0];
    // compute edge-to-edge horizontal distance
    const centerDist = Math.abs(first.pos.x - unit.pos.x);
    const edgeDist = Math.max(0, centerDist - (first.size + unit.size) / 2);
    if (edgeDist <= unit.range) return { kind: 'unit', unit: first };
  }

  // if no unit in range, check tower of opposite team (horizontal distance)
  const enemyTower = towers.find(t => t.team !== unit.team);
  if (enemyTower) {
    const centerDistT = Math.abs(enemyTower.pos.x - unit.pos.x);
    const edgeDistT = Math.max(0, centerDistT - (unit.size / 2)); // tower has no size accounted except unit
    if (edgeDistT <= unit.range) return { kind: 'tower', tower: enemyTower };
  }

  return null;
}

export function applyDamageToUnit(target: Unit, dmg: number): Unit {
  const hp = Math.max(0, target.hp - dmg);
  return { ...target, hp, alive: hp > 0 };
}

export function applyDamageToTower(t: Tower, dmg: number): Tower {
  const hp = Math.max(0, t.hp - dmg);
  return { ...t, hp };
}

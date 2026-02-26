import { Unit, createUnit, updateUnit, UnitType, Team } from './Unit';
import { findTarget, applyDamageToUnit, applyDamageToTower, Tower } from './CombatSystem';
import { Log } from './logs';

export type GameState = {
  units: Unit[];
  towers: Tower[];
  time: number;
  width: number;
  height: number;
  energy: { player: number; enemy: number };
  cooldowns: {
    player: Record<UnitType, number>;
    enemy: Record<UnitType, number>;
  };
  kills: { player: number; enemy: number };
  flag?: { x: number; y: number } | null;
  gameOver?: { winner: 'player' | 'enemy' } | null;
  currentOrder?: 'attack' | 'advance' | 'retreat' | 'moveToFlag';
};

  const COST: Record<UnitType, number> = {
    melee: 100,
    ranged: 150,
  };

  const RESPAWN: Record<UnitType, number> = {
    melee: 4,
    ranged: 5,
  };

function makeTower(id: string, team: Team, x: number, y: number): Tower {
  return { id, team, pos: { x, y }, hp: 1000, maxHp: 1000 };
}

export function createGame(width: number, height: number) {
  const state: GameState = {
    units: [],
    towers: [],
    time: 0,
    width,
    height,
    energy: { player: 200, enemy: 200 },
    cooldowns: {
      player: { melee: 0, ranged: 0 },
      enemy: { melee: 0, ranged: 0 },
    },
    kills: { player: 0, enemy: 0 },
    flag: null,
    gameOver: null,
    currentOrder: 'attack',
  };

  const groundHeight = 56;
  const baselineY = height - groundHeight - 6; // units stand slightly above ground

  // towers: left (player base), right (enemy base) placed on ground baseline
  state.towers.push(makeTower('t1', 'player', 30, baselineY));
  state.towers.push(makeTower('t2', 'enemy', width - 30, baselineY));

  // no auto units at start — player and enemy must spawn units via spawnUnit

  // energy tick accumulator
  let energyTimer = 0;

  // enemy AI spawn accumulator (attempt spawn every 1s)
  let enemySpawnAccumulator = 0;

    function spawnUnit(team: Team, type: UnitType): boolean {
      Log.info('SPAWN', `Intento spawn: equipo=${team} tipo=${type} energia=${state.energy[team]} cooldown=${state.cooldowns[team][type]}`);
      const cost = COST[type];
      const cd = state.cooldowns[team][type];
      if (state.energy[team] < cost) return false;
      if (cd > 0) return false;

      state.energy[team] -= cost;
      state.cooldowns[team][type] = RESPAWN[type];

      const x = team === 'player' ? 60 : width - 60;
      const y = baselineY;
      const spawnOffset = team === 'player' ? -8 : 8;
      const u = createUnit(type, x + spawnOffset, y, team);
      // inherit current player order if spawning for player
      if (team === 'player' && state.currentOrder) u.order = state.currentOrder;
      state.units.push(u);
      Log.info('SPAWN', `Spawn realizado id=${u.id} equipo=${team} tipo=${type} pos=${u.pos.x.toFixed(1)},${u.pos.y.toFixed(1)}`);
      return true;
    }

    // set order for all player units
    function setPlayerOrder(order: 'attack' | 'advance' | 'retreat' | 'moveToFlag') {
      state.currentOrder = order;
      for (const u of state.units) {
        if (u.team === 'player') {
          u.order = order;
          if (order !== 'moveToFlag') u.flagTarget = null;
        }
      }
    }

    function placeFlag(x: number, y: number) {
      state.flag = { x, y };
      // set player units to moveToFlag
      state.currentOrder = 'moveToFlag';
      for (const u of state.units) {
        if (u.team === 'player') {
          u.order = 'moveToFlag';
          u.flagTarget = { x, y };
        }
      }
    }

    function update(delta: number) {
      // update time and basic timers
      state.time += delta;
      energyTimer += delta;

      // cooldowns
      for (const t of ['player', 'enemy'] as Team[]) {
        for (const k of Object.keys(state.cooldowns[t]) as UnitType[]) {
          state.cooldowns[t][k] = Math.max(0, state.cooldowns[t][k] - delta);
        }
      }

      // energy tick every 5 seconds -> +50
      if (energyTimer >= 5) {
        energyTimer -= 5;
        state.energy.player += 50;
        state.energy.enemy += 50;
        Log.info('ENERGY', `Tick +50 -> player=${state.energy.player} enemy=${state.energy.enemy}`);
      }

      // ---- increment attack timers for all units first ----
      for (const u of state.units) {
        if (!u.alive) continue;
        u.attackTimer = (u.attackTimer ?? 0) + delta;
      }

      // ---- Combat resolution first (so deaths affect movement same frame) ----
      const newUnits = state.units.map(u => ({ ...u }));
      const newTowers = state.towers.map(t => ({ ...t }));

      // accumulate damage per target to ensure simultaneous attacks sum
      const damageToUnit: Record<string, number> = {};
      const damageToTower: Record<string, number> = {};
      const attackersToReset: string[] = [];

      for (const u of state.units) {
        if (!u.alive) continue;
        const target = findTarget(u, state.units, state.towers);
        if (target && u.attackTimer >= u.attackCooldown) {
          if (target.kind === 'unit') {
            const tu = target.unit;
            damageToUnit[tu.id] = (damageToUnit[tu.id] || 0) + u.dmg;
            Log.debug('ATTACK', `unidad ${u.id} ataca unidad ${tu.id} dmg=${u.dmg}`);
          } else if (target.kind === 'tower') {
            const tower = target.tower;
            damageToTower[tower.id] = (damageToTower[tower.id] || 0) + u.dmg;
            Log.debug('ATTACK', `unidad ${u.id} ataca torre ${tower.id} dmg=${u.dmg}`);
          }
          attackersToReset.push(u.id);
        }
      }

      // apply accumulated unit damage
      for (const id of Object.keys(damageToUnit)) {
        const idx = newUnits.findIndex(x => x.id === id);
        if (idx < 0) continue;
        const total = damageToUnit[id];
        Log.info('DAMAGE', `Aplicando ${total} de daño a unidad id=${id}`);
        const damaged = applyDamageToUnit(newUnits[idx], total);
        if (!damaged.alive && newUnits[idx].alive) {
          // find which side got the kill: attackers may be mixed, but attribute to team with most recent attacker isn't tracked; approximate by comparing positions
          // For simplicity, increment killer count for enemy side opposite of damaged unit
          if (newUnits[idx].team === 'player') state.kills.enemy += 1; else state.kills.player += 1;
          Log.info('KILL', `Unidad ${id} muerta. Kills -> player=${state.kills.player} enemy=${state.kills.enemy}`);
        }
        newUnits[idx] = damaged;
      }

      // apply accumulated tower damage
      for (const id of Object.keys(damageToTower)) {
        const idxT = newTowers.findIndex(t => t.id === id);
        if (idxT < 0) continue;
        const total = damageToTower[id];
        Log.info('DAMAGE', `Aplicando ${total} de daño a torre id=${id}`);
        newTowers[idxT] = applyDamageToTower(newTowers[idxT], total);
      }

      // Check tower destruction -> end game and kill all units of that team
      for (const t of newTowers) {
        if (t.hp <= 0 && !state.gameOver) {
          const loser = t.team;
          const winner = loser === 'player' ? 'enemy' : 'player';
          state.gameOver = { winner };
          // kill all units of loser
          for (const nu of newUnits) {
            if (nu.team === loser) nu.alive = false;
          }
          Log.warn('GAME', `Torre ${t.id} destruida. Ganador: ${winner}`);
        }
      }

      if (state.gameOver) {
        // apply the final unit/tower state and stop further actions
        state.units = newUnits.filter(u => u.alive);
        state.towers = newTowers;
        return;
      }

      // reset attack timers for attackers
      for (const aid of attackersToReset) {
        const idxU = newUnits.findIndex(x => x.id === aid);
        if (idxU >= 0) newUnits[idxU] = { ...newUnits[idxU], attackTimer: 0 };
      }

      // purge dead units immediately so movement sees updated state
      state.units = newUnits.filter(u => u.alive);
      state.towers = newTowers;

      // ---- Enemy AI: simple automatic spawner every 1s attempt ----
      enemySpawnAccumulator += delta;
      if (enemySpawnAccumulator >= 1) {
        enemySpawnAccumulator = 0;
        // prefer to spawn melee if not enough energy for ranged
        if (state.energy.enemy >= COST.ranged && state.cooldowns.enemy.ranged <= 0) {
          spawnUnit('enemy', 'ranged');
        } else if (state.energy.enemy >= COST.melee && state.cooldowns.enemy.melee <= 0) {
          spawnUnit('enemy', 'melee');
        }
      }

      // ---- Movement: now that deaths are applied, move units and handle stacking ----
      for (const u of state.units) {
        if (!u.alive) continue;

        const dir = u.team === 'player' ? 1 : -1;

        // nearest enemy unit ahead
        const aheadUnits = state.units
          .filter(e => e.alive && e.id !== u.id && e.team !== u.team && Math.sign(e.pos.x - u.pos.x) === dir)
          .sort((a, b) => Math.abs(a.pos.x - u.pos.x) - Math.abs(b.pos.x - u.pos.x));

        const nearestAheadEnemy = aheadUnits[0];
        const enemyTower = state.towers.find(t => t.team !== u.team);

        // distance to nearest enemy unit (edge-to-edge)
        let distToNearestEnemy = Infinity;
        if (nearestAheadEnemy) distToNearestEnemy = Math.abs(nearestAheadEnemy.pos.x - u.pos.x) - (nearestAheadEnemy.size + u.size) / 2;
        const distToTower = enemyTower ? Math.abs(enemyTower.pos.x - u.pos.x) : Infinity;

        const inAttackRangeEnemy = distToNearestEnemy <= u.range;
        const inAttackRangeTower = distToTower <= u.range;

        // blocking occurs when a unit (friend or foe) is too close in front
        // only enemy units should block movement; allow passing through allies
        const blockingUnit = state.units
          .filter(e => e.alive && e.id !== u.id && e.team !== u.team && Math.sign(e.pos.x - u.pos.x) === dir)
          .sort((a, b) => Math.abs(a.pos.x - u.pos.x) - Math.abs(b.pos.x - u.pos.x))[0];

        const blockedByUnit = blockingUnit ? Math.abs(blockingUnit.pos.x - u.pos.x) <= (u.size + blockingUnit.size) / 2 + 1 : false;

        if (!blockedByUnit && !inAttackRangeEnemy && !inAttackRangeTower) {
          const updated = updateUnit(u, delta);
          u.pos = updated.pos;
          u.attackTimer = updated.attackTimer;
        } else {
          // stacking: if blocked by a unit, snap to just behind it
          if (blockedByUnit && blockingUnit) {
            const gap = (blockingUnit.size + u.size) / 2 + 1;
            u.pos.x = blockingUnit.pos.x - dir * gap;
          }
          // don't move, attackTimer already incremented
        }
      }
      // ensure minimal separation between same-team units (avoid visual overlap)
      const minGapAdjust = 1; // extra pixels between units
      // sort by x for processing (left to right)
      const sorted = state.units.slice().sort((a, b) => a.pos.x - b.pos.x);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (prev.team === cur.team) {
          const desired = (prev.size + cur.size) / 2 + minGapAdjust;
          const actual = Math.abs(cur.pos.x - prev.pos.x);
          if (actual < desired) {
            // push the trailing unit back to maintain gap
            const dirCur = cur.team === 'player' ? 1 : -1;
            // place cur behind prev according to its direction
            cur.pos.x = prev.pos.x - dirCur * desired;
          }
        }
      }
    }

  function getSnapshot() {
    // return shallow cloned snapshot suitable for rendering
    return {
      units: state.units.map(u => ({ ...u, pos: { ...u.pos } })),
      towers: state.towers.map(t => ({ ...t, pos: { ...t.pos } })),
      time: state.time,
      width: state.width,
      height: state.height,
      energy: { ...state.energy },
      cooldowns: {
        player: { ...state.cooldowns.player },
        enemy: { ...state.cooldowns.enemy },
      },
      kills: { ...state.kills },
      flag: state.flag,
      gameOver: state.gameOver,
      currentOrder: state.currentOrder,
    };
  }

  return {
    state,
    update,
    getSnapshot,
    spawnUnit,
    setPlayerOrder,
    placeFlag,
  };
}

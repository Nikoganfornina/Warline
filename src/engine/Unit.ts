// --------------------------
// Tipos y definiciones para las unidades
// Todo el archivo está comentado en español para facilitar futuras modificaciones.
// --------------------------

export type Team = 'player' | 'enemy';

export type Vec2 = { x: number; y: number };

// Tipos de unidad existentes en el juego (no se añaden nuevas unidades ahora)
export type UnitType = 'melee' | 'ranged';

// Categoría física / rol de la unidad (ej: terrestre o aérea).
// Este campo servirá como primer filtro cuando se busque objetivo.
export type UnitCategory = 'terrestre' | 'aerea';

// Preferencia de distancia al escoger objetivo: cercano, lejos o cualquiera.
export type DistancePreference = 'cercano' | 'lejos' | 'cualquiera';

// Efecto buscado en el objetivo: quita vida (daño), da vida (curación), o cualquiera.
export type EffectPreference = 'daño' | 'curacion' | 'cualquiera';

// Interfaz principal de una unidad.
export type Unit = {
  id: string;
  type: UnitType; // tipo base (melee/ranged)
  team: Team; // equipo propietario ('player' o 'enemy')
  pos: Vec2; // posición en el plano (x horizontal, y vertical)
  size: number; // tamaño visual / colisión
  speed: number; // velocidad horizontal en unidades por segundo
  hp: number; // puntos de vida actuales
  maxHp: number; // puntos de vida máximos
  dmg: number; // daño por ataque
  range: number; // alcance de ataque en píxeles (distancia horizontal considerada)
  attackCooldown: number; // segundos entre ataques

  // Atributos de juego ya existentes (economía / spawn)
  cost: number; // costo en energía para spawnear esta unidad
  respawn: number; // tiempo de respawn o cooldown asociado a esta unidad (por lado)
  isRanged: boolean; // indica si es unidad a distancia
  knockback: boolean; // indica si sus ataques aplican retroceso

  // Nuevo: categoría física de la unidad (terrestre / aerea)
  // - Este es el primer filtro que deberá comprobar el sistema de targeting.
  category: UnitCategory;

  // Nuevo: preferencias/filtros para seleccionar objetivos.
  // 1) filtro por categoría del objetivo (ej: priorizar aéreas o terrestres).
  // 2) filtro por distancia (cercano/lejos/cualquiera).
  // 3) filtro por efecto (quitar vida / dar vida / cualquiera).
  // Estos campos no cambian la lógica de ataque por ahora; son metadatos
  // pensados para que en una futura versión el sistema de combate use
  // una cadena de filtros al escoger diana.
  targetCategoryFilter: UnitCategory | 'cualquiera';
  targetDistanceFilter: DistancePreference;
  targetEffectFilter: EffectPreference;

  // Controles de orden y objetivo (existentes)
  order: 'attack' | 'advance' | 'retreat' | 'moveToFlag';
  flagTarget?: Vec2 | null; // objetivo de bandera para la orden moveToFlag

  // Temporizador interno para ataques
  attackTimer: number; // segundos desde el último ataque
  alive: boolean; // marca si la unidad sigue viva
};

// Generador simple de IDs incrementales para unidades.
let _id = 1;
function nextId() {
  return String(_id++);
}

// Factory para crear una unidad con valores por defecto.
// NOTA: aquí no añadimos nuevas variantes de unidad, sino que
// inicializamos los nuevos campos (categoría y filtros) para poder
// utilizarlos más adelante en el sistema de targeting.
export function createUnit(type: UnitType, x: number, y: number, team: Team): Unit {
  if (type === 'melee') {
    return {
      id: nextId(),
      type,
      team,
      pos: { x, y },
      size: 20,
      // Melee: más vida y daño, pero más lento.
      speed: 36,
      hp: 140,
      maxHp: 140,
      dmg: 30,
      range: 18,
      attackCooldown: 1.2,
      cost: 100,
      respawn: 4,
      isRanged: false,
      knockback: false,
      // Por defecto las unidades actuales son terrestres.
      category: 'terrestre',
      // Preferencias por defecto: aceptar cualquier categoría/distancia/efecto.
      targetCategoryFilter: 'cualquiera',
      targetDistanceFilter: 'cualquiera',
      targetEffectFilter: 'daño',
      order: 'attack',
      flagTarget: null,
      attackTimer: 0,
      alive: true,
    };
  }

  // Ranged (a distancia)
  return {
    id: nextId(),
    type,
    team,
    pos: { x, y },
    size: 18,
    // Ranged: menos vida y daño, pero más rápido y con mayor alcance.
    speed: 48,
    hp: 80,
    maxHp: 80,
    dmg: 16,
    range: 110,
    attackCooldown: 1.0,
    cost: 150,
    respawn: 5,
    isRanged: true,
    knockback: false,
    category: 'terrestre',
    targetCategoryFilter: 'cualquiera',
    targetDistanceFilter: 'cualquiera',
    targetEffectFilter: 'daño',
    order: 'attack',
    flagTarget: null,
    attackTimer: 0,
    alive: true,
  };
}

// Actualiza solo la posición horizontal y el temporizador de ataque.
// Mantener esta función simple ayuda a que el bucle de juego sea determinista.
export function updateUnit(unit: Unit, delta: number): Unit {
  // delta está en segundos
  if (!unit.alive) return unit;

  const dir = unit.team === 'player' ? 1 : -1;
  const dx = unit.speed * delta * dir;

  return {
    ...unit,
    // Sólo movemos horizontalmente para mantener la perspectiva lateral.
    pos: { x: unit.pos.x + dx, y: unit.pos.y },
    attackTimer: unit.attackTimer + delta,
  };
}

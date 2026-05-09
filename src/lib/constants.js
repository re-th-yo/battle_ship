// Dimensions de la grille
export const GRID_COLS = 12
export const GRID_ROWS = 10

// Labels : lignes A-J (haut → bas), colonnes 1-12 (gauche → droite)
// Correspond au SVG battleship_board.svg fourni par l'utilisateur
export const ROW_LABELS = ['A','B','C','D','E','F','G','H','I','J']
export const COL_LABELS = ['1','2','3','4','5','6','7','8','9','10','11','12']

// Palette de couleurs (identique à tailwind.config.js)
export const COLORS = {
  lime:        '#C5FF00',
  magenta:     '#FF00FF',
  bluePx:      '#2c00ff',
  redRdr:      '#FF0000',
  purpleGltch: '#7B2CBF',
  pinkMsl:     '#FF1493',
  dark:        '#0A0A0A',
  darkMid:     '#111111',
  grayUnit:    '#333333',
}

// Définition des unités
// cells = [[col_offset, row_offset], ...] depuis l'origine de l'unité
export const UNIT_DEFINITIONS = {
  gn: {
    code: 'gn',
    name: 'Generator',
    desc: 'Core power source. Losing both generators means defeat.',
    color: COLORS.grayUnit,
    upgradeable: false,
    levels: {
      S1: { cells: [[0,0],[1,0]], w: 2, h: 1 },
    },
  },
  rdr: {
    code: 'rdr',
    name: 'Radar',
    desc: 'Reveals enemy cells in a cross pattern. Higher level = wider scan radius.',
    color: COLORS.redRdr,
    upgradeable: true,
    levels: {
      S1: { cells: [[0,0]],               w: 1, h: 1 },
      S2: { cells: [[0,0],[1,0]],          w: 2, h: 1 },
      S3: { cells: [[0,0],[1,0],[2,0]],    w: 3, h: 1 },
    },
    upgradeCost: { S1toS2: 10, S2toS3: 25 },
  },
  trll: {
    code: 'trll',
    name: 'Turret',
    desc: 'Defense cannon. Fires back when hit at higher levels.',
    color: COLORS.bluePx,
    upgradeable: true,
    levels: {
      S1: { cells: [[0,0],[1,0],[1,1]], w: 2, h: 2 },
      S2: { cells: [[0,0],[1,0],[2,0],[2,1]], w: 3, h: 2 },
      S3: { cells: [[0,0],[2,0],[0,1],[1,1],[2,1]], w: 3, h: 2 },
    },
    upgradeCost: { S1toS2: 15, S2toS3: 35 },
  },
  shld: {
    code: 'shld',
    name: 'Shield',
    desc: 'Armor plating. Absorbs shots and protects adjacent units.',
    color: COLORS.lime,
    upgradeable: true,
    levels: {
      S1: { cells: [[0,0],[1,0],[2,0]],                         w: 3, h: 1 },
      S2: { cells: [[0,0],[1,0],[0,1],[1,1]],                   w: 2, h: 2 },
      S3: { cells: [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]],       w: 3, h: 2 },
    },
    upgradeCost: { S1toS2: 10, S2toS3: 20 },
  },
  gltch: {
    code: 'gltch',
    name: 'Jammer',
    desc: 'Disrupts enemy sensors. Hides your layout from the bot for several turns.',
    color: COLORS.purpleGltch,
    upgradeable: true,
    levels: {
      S1: { cells: [[0,0],[1,0]],              w: 2, h: 1 },
      S2: { cells: [[0,0],[1,0],[2,0]],         w: 3, h: 1 },
      S3: { cells: [[0,0],[1,0],[1,1],[1,2]], w: 2, h: 3 },
    },
    upgradeCost: { S1toS2: 15, S2toS3: 40 },
  },
  msl: {
    code: 'msl',
    name: 'Missile Silo',
    desc: 'Launches area-of-effect strike. Higher level = larger blast zone.',
    color: COLORS.pinkMsl,
    upgradeable: true,
    levels: {
      S1: { cells: [[0,0],[1,0],[2,0],[1,1]], w: 3, h: 2 },
      S2: { cells: [[0,0],[1,0],[2,0],[3,0],[1,1]], w: 4, h: 2 },
      S3: { cells: [[0,0],[1,0],[2,0],[3,0],[4,0],[1,1],[3,1]], w: 5, h: 2 },
    },
    upgradeCost: { S1toS2: 20, S2toS3: 45 },
  },
}

// Économie
export const ECONOMY = {
  creditPerHit:       10,  // hit normal
  creditLastHit:      10,  // hit qui détruit l'unité
  creditDestroyBonus: 10,  // bonus supplémentaire sur la destruction
  creditPerRound:     2,   // revenu passif par round
  creditLostPerCell:  1,
  repairCostPerCell:  5,
  maxCredits:        999,
  abilityCost:        30,
}

// Ability definitions
export const ABILITIES = {
  rdr: {
    key: 'rdr',
    label: 'rdr.exe',
    desc: 'Radar — reveals cells around target',
    // arm length by radar unit level (S1/S2/S3)
    armLength: { S1: 1, S2: 2, S3: 3 },
    needsTarget: true,
  },
  gltch: {
    key: 'gltch',
    label: 'gltch.exe',
    desc: 'Jammer — hides shot results for N bot turns',
    // turns hidden by gltch level
    jamTurns: { S1: 2, S2: 4, S3: 6 },
    needsTarget: false,
  },
  msl: {
    key: 'msl',
    label: 'msl.exe',
    desc: 'Missile — area strike',
    needsTarget: true,
  },
}

// Routes
export const ROUTES = {
  home:    '/',
  lobby:   '/lobby',
  pregame: '/pregame',
  game:    '/game',
  result:  '/result',
}

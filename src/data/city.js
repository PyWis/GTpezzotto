// Geografia di Napoli in coordinate-tile (1 tile = TILE px). Tutto è nello stesso
// sistema di riferimento: ovest = Bagnoli, est = San Giovanni a Teduccio.

export const TILE = 32;
export const MAP_W = 354;
export const MAP_H = 112;

const road = (name, kind, width, path) => ({ name, kind, width, path });

/** Road classes, from the narrowest to the widest. */
export const ROAD_PRIORITY = { vicolo: 1, street: 2, main: 3, hwy: 4 };

export const COASTLINE = [[0, 92], [20, 94], [40, 99], [70, 101], [86, 106], [96, 100], [102, 95], [104, 92], [159, 92], [164, 93], [176, 93], [184, 87], [188, 83], [234, 83], [242, 88], [300, 88], [354, 90]];

export const ROADS = [
  road('Via Caracciolo', 'main', 3, [[106, 89], [156, 89]]),
  road('Via Partenope', 'main', 3, [[156, 89], [178, 89]]),
  road('Via Nazario Sauro', 'main', 3, [[178, 89], [186, 84], [200, 80]]),
  road('Via Marina', 'main', 3, [[200, 80], [298, 80]]),
  road('Riviera di Chiaia', 'main', 3, [[110, 78], [162, 78]]),
  road('Via Mergellina', 'street', 2, [[108, 89], [108, 78], [110, 78]]),
  road('Via Chiaia', 'street', 2, [[160, 77], [160, 64], [168, 60], [179, 61]]),
  road('Via Santa Lucia', 'street', 2, [[176, 87], [176, 76]]),
  road('Corso Vittorio Emanuele', 'street', 2, [[110, 86], [114, 70], [126, 60], [144, 56], [160, 48], [168, 38], [176, 33]]),
  road('Via Toledo', 'main', 3, [[181, 36], [181, 62]]),
  road('Via Pessina', 'main', 3, [[181, 14], [181, 36]]),
  road('Via Scarlatti', 'main', 3, [[120, 30], [160, 30]]),
  road('Via Luca Giordano', 'street', 2, [[138, 16], [138, 57]]),
  road('Via Cimarosa', 'street', 2, [[152, 22], [152, 52]]),
  road('Via Bernini', 'street', 2, [[128, 20], [128, 46], [126, 60]]),
  road('Via Morghen', 'street', 2, [[128, 40], [152, 40]]),
  road('Via San Carlo', 'main', 3, [[181, 62], [204, 62]]),
  road('Via Medina', 'street', 2, [[204, 50], [204, 64]]),
  road('Corso Umberto I', 'main', 3, [[204, 57], [236, 50]]),
  road('Via Foria', 'main', 3, [[181, 18], [254, 18]]),
  road('Via Duomo', 'main', 3, [[217, 18], [217, 80]]),
  road('Corso Garibaldi', 'main', 3, [[245, 18], [245, 80]]),
  road('Via Pasquale Scura', 'vicolo', 2, [[162, 46], [180, 46]]),
  road('Spaccanapoli', 'vicolo', 2, [[182, 46], [217, 46]]),
  road('Via dei Tribunali', 'vicolo', 2, [[187, 39], [217, 39]]),
  road('Via San Sebastiano', 'vicolo', 1, [[190.5, 36], [190.5, 46]]),
  road('Via Mezzocannone', 'vicolo', 1, [[195.5, 46], [195.5, 61]]),
  road('Via San Gregorio Armeno', 'vicolo', 1, [[202.5, 39], [202.5, 46]]),
  road('Vico dei Panettieri', 'vicolo', 1, [[209.5, 36], [209.5, 53]]),
  road('Vico Lungo Gelso', 'vicolo', 1, [[167.5, 40], [167.5, 61]]),
  road('Vico Tre Re a Toledo', 'vicolo', 1, [[171.5, 40], [171.5, 61]]),
  road('Vico Figurari', 'vicolo', 1, [[175.5, 40], [175.5, 61]]),
  road('Via Speranzella', 'vicolo', 1, [[164, 41.5], [181, 41.5]]),
  road('Vico Concordia', 'vicolo', 1, [[164, 50.5], [181, 50.5]]),
  road('Via Emanuele De Deo', 'vicolo', 1, [[164, 55.5], [181, 55.5]]),
  road('Via Eldorado', 'street', 2, [[167, 90], [167, 98]]),
  road('Via Cilea', 'street', 2, [[106, 50], [118, 46], [128, 46]]),
  road('Via Merliani', 'street', 2, [[128, 24], [152, 24]]),
  road('Via Kerbaker', 'street', 2, [[128, 8], [128, 20]]),
  road('Via Simone Martini', 'street', 2, [[106, 16], [138, 16]]),
  road('Via Belvedere', 'street', 2, [[106, 36], [120, 30]]),
  road('Via del Parco Margherita', 'street', 2, [[154, 77], [154, 51]]),
  road('Viale Augusto', 'main', 3, [[52, 66], [73, 66]]),
  road('Via Giulio Cesare', 'main', 3, [[80, 61], [80, 34]]),
  road('Via Leopardi', 'street', 2, [[52, 52], [80, 52]]),
  road('Via Lepanto', 'street', 2, [[64, 34], [64, 66]]),
  road('Via Terracina', 'main', 3, [[52, 92], [52, 30]]),
  road('Viale Kennedy', 'main', 3, [[44, 92], [85, 92]]),
  road('Discesa Coroglio', 'street', 2, [[85, 92], [85, 100], [88, 100]]),
  road('Via Posillipo', 'street', 2, [[88, 100], [96, 98], [102, 94], [107, 90]]),
  road('Galleria Quattro Giornate', 'main', 3, [[84, 67], [94, 72], [102, 80], [107, 84]]),
  road('Galleria Laziale', 'street', 2, [[84, 61], [96, 63], [104, 70], [109, 76]]),
  road('Tangenziale', 'hwy', 3, [[44, 34], [80, 34], [94, 22], [106, 12], [140, 12]]),
  road('Via Taddeo da Sessa', 'main', 3, [[254, 18], [298, 18]]),
  road('Corso Malta', 'main', 3, [[298, 18], [298, 80]]),
  road('Via Giovanni Porzio', 'main', 3, [[264, 18], [264, 66]]),
  road('Via Galileo Ferraris', 'main', 3, [[245, 66], [298, 66]]),
  road('Via Coroglio', 'main', 3, [[4, 86], [26, 89], [44, 92]]),
  road('Via Diocleziano', 'main', 3, [[24, 34], [24, 88]]),
  road('Tangenziale', 'hwy', 3, [[4, 34], [44, 34]]),
  road("Via Cavalleggeri d'Aosta", 'street', 2, [[24, 62], [52, 62]]),
  road('Via Nuova Agnano', 'street', 2, [[4, 48], [24, 48]]),
  road('Via Bagnoli', 'street', 2, [[24, 74], [52, 74]]),
  road('Via Nisida', 'street', 2, [[8, 88], [8, 102]]),
  road('Via Taddeo da Sessa', 'main', 3, [[298, 18], [352, 18]]),
  road('Via Gianturco', 'main', 3, [[298, 40], [352, 40]]),
  road('Via Galileo Ferraris', 'main', 3, [[298, 66], [352, 66]]),
  road('Corso San Giovanni a Teduccio', 'main', 3, [[298, 80], [352, 80]]),
  road('Via Ponte dei Francesi', 'street', 2, [[316, 18], [316, 80]]),
  road("Via Brecce a Sant'Erasmo", 'street', 2, [[336, 18], [336, 80]]),
];

export const PLAZAS = [
  { name: 'Piazza del Plebiscito', rect: [168, 63, 184, 77], paving: 'basalt' },
  { name: 'Piazza Dante', rect: [174, 29, 188, 37] },
  { name: 'Piazza Vanvitelli', rect: [134, 26, 143, 34] },
  { name: 'Piazza Garibaldi', rect: [232, 46, 253, 62], palms: true },
  { name: 'Piazza del Gesù Nuovo', rect: [183, 42, 189, 49] },
  { name: 'Piazza Municipio', rect: [200, 65, 211, 78] },
  { name: "Piazza Medaglie d'Oro", rect: [112, 12, 120, 20] },
  { name: 'Piazza Fuga', rect: [146, 33, 151, 37] },
  { name: 'Piazzale Tecchio', rect: [73, 60, 85, 72] },
  { name: 'Centro Direzionale', rect: [267, 21, 297, 63] },
  { name: 'Piazza Bagnoli', rect: [26, 76, 33, 82] },
  { name: 'Edenlandia', rect: [42, 78, 50, 88] },
];

export const PARKS = [
  { name: 'Villa Comunale', rect: [116, 80, 160, 87] },
  { name: 'Villa Floridiana', rect: [142, 44, 150, 52] },
  { name: 'Orto Botanico', rect: [224, 8, 236, 16] },
  { name: "Mostra d'Oltremare", rect: [54, 68, 71, 89] },
  { name: 'Centro Direzionale', rect: [273, 42, 279, 47] },
];

export const QUAYS = [
  { name: 'Molo Beverello', rect: [200, 82, 208, 97] },
  { name: 'Stazione Marittima', rect: [212, 82, 224, 94] },
  { name: 'Porto', rect: [228, 82, 235, 96] },
  { name: 'Porticciolo di Mergellina', rect: [112, 92, 117, 99] },
  { name: 'Borgo Marinari', rect: [161, 96, 174, 107] },
  { name: 'Pontile Nord', rect: [13, 90, 16, 108] },
  { name: 'Darsena di San Giovanni', rect: [306, 88, 312, 98] },
  { name: 'Darsena Petroli', rect: [322, 88, 330, 96] },
];

export const LANDMARKS = [
  { name: "Castel dell'Ovo", rect: [163, 99, 173, 106], height: 2.6, color: '#bcae92', style: 'castle' },
  { name: 'Maschio Angioino', rect: [193, 71, 200, 78], height: 3.2, color: '#77706a', style: 'castle' },
  { name: 'Palazzo Reale', rect: [185, 65, 192, 78], height: 3, color: '#b4503d', style: 'palace' },
  { name: 'Teatro San Carlo', rect: [193, 65, 200, 70], height: 3, color: '#cfae72', style: 'palace' },
  { name: 'Galleria Umberto I', rect: [184, 51, 193, 59], height: 3.6, color: '#d9c9a8', style: 'glass' },
  { name: 'San Francesco di Paola', shape: 'circle', center: [166, 71], radius: 4.5, height: 3.4, color: '#dcd4c1', style: 'dome' },
  { name: "Castel Sant'Elmo", shape: 'star', center: [160, 38], radius: 5, height: 2.2, color: '#a39b86', style: 'fort' },
  { name: 'Certosa di San Martino', rect: [162, 31, 167, 35], height: 2.6, color: '#e2d8c0', style: 'church' },
  { name: 'Duomo di Napoli', rect: [219, 34, 225, 42], height: 3.4, color: '#dccfb3', style: 'church' },
  { name: 'Museo Archeologico', rect: [184, 8, 196, 15], height: 3, color: '#c25a3f', style: 'palace' },
  { name: 'Stazione Centrale', rect: [253, 42, 262, 64], height: 2.4, color: '#e8e6df', style: 'station' },
  { name: 'Stazione Marittima', rect: [214, 84, 222, 90], height: 2.4, color: '#dad6c9', style: 'palace' },
  { name: 'Stadio Collana', shape: 'ellipse', center: [112, 25], rx: 5, ry: 3.5, height: 1.6, color: '#9ab0bf', style: 'stadium' },
  { name: 'Stadio Diego Armando Maradona', shape: 'ellipse', center: [78, 80], rx: 7.5, ry: 9, height: 2.8, color: '#5fb0e8', style: 'stadium', ring: true },
  { name: 'Arena Flegrea', shape: 'circle', center: [58, 72], radius: 2.6, height: 1.6, color: '#d8cdb4', style: 'arena' },
  { name: 'Torre delle Nazioni', rect: [66, 69, 69, 72], height: 5.5, color: '#d8c9a8', style: 'tower' },
  { name: 'Torri ENEL', rect: [269, 23, 273, 27], height: 9, color: '#3e5a72', style: 'tower' },
  { name: 'Torri ENEL', rect: [275, 23, 279, 27], height: 9, color: '#3e5a72', style: 'tower' },
  { name: 'Torre Telecom', rect: [284, 22, 289, 27], height: 10.5, color: '#2f4e66', style: 'tower' },
  { name: 'Consiglio Regionale', rect: [269, 32, 274, 38], height: 7.5, color: '#5a7590', style: 'tower' },
  { name: 'Torre Francesco', rect: [284, 32, 288, 36], height: 8, color: '#6b8ba3', style: 'tower' },
  { name: 'Torre Saverio', rect: [290, 32, 294, 36], height: 8.5, color: '#56778f', style: 'tower' },
  { name: 'Torri INAIL', rect: [284, 42, 288, 46], height: 7, color: '#7690a4', style: 'tower' },
  { name: 'Torri INAIL', rect: [290, 42, 294, 46], height: 7.5, color: '#7690a4', style: 'tower' },
  { name: 'Palazzo di Giustizia', rect: [269, 50, 280, 60], height: 5, color: '#cbc4b6', style: 'tower' },
  { name: 'Tecnocity', rect: [284, 51, 294, 60], height: 4, color: '#8b9aa6', style: 'tower' },
  { name: 'Altoforno Italsider', rect: [8, 66, 12, 71], height: 6, color: '#6b4a3a', style: 'furnace' },
  { name: 'Ciminiera Italsider', shape: 'circle', center: [16, 64], radius: 1.3, height: 11, color: '#8a5040', style: 'chimney' },
  { name: 'Acciaieria Italsider', rect: [4, 74, 16, 81], height: 2.6, color: '#7d6a5a', style: 'shed' },
  { name: 'Città della Scienza', rect: [30, 82, 38, 86], height: 2.2, color: '#d8d2c4', style: 'palace' },
  { name: 'Gasometro', shape: 'circle', center: [306, 58], radius: 3.5, height: 5, color: '#7f8580', style: 'gasometer' },
  { name: 'Ciminiera', shape: 'circle', center: [326, 57], radius: 1.2, height: 11, color: '#9a5a44', style: 'chimney' },
  { name: 'Ciminiera', shape: 'circle', center: [344, 30], radius: 1.2, height: 10, color: '#9a5a44', style: 'chimney' },
  { name: 'Capannoni Ferroviari', rect: [300, 22, 313, 36], height: 2.4, color: '#8c8a84', style: 'shed' },
  { name: 'Officine', rect: [320, 22, 333, 36], height: 2.2, color: '#97806a', style: 'shed' },
  { name: 'Ex Cirio · Campus Federico II', rect: [318, 69, 332, 77], height: 2.6, color: '#c86a4a', style: 'palace' },
  { name: 'Depositi petroliferi', shape: 'circle', center: [341, 58], radius: 2.3, height: 2, color: '#ecebe4', style: 'tank' },
  { name: 'Depositi petroliferi', shape: 'circle', center: [347, 58], radius: 2.3, height: 2, color: '#ecebe4', style: 'tank' },
  { name: 'Depositi petroliferi', shape: 'circle', center: [341, 72], radius: 2.3, height: 2, color: '#ecebe4', style: 'tank' },
  { name: 'Depositi petroliferi', shape: 'circle', center: [347, 72], radius: 2.3, height: 2, color: '#ecebe4', style: 'tank' },
  { name: 'Teatro Mediterraneo', rect: [65, 74, 70, 78], height: 2.2, color: '#e6dfcf', style: 'palace' },
  { name: "Palazzo dell'Arte", rect: [54, 76, 59, 80], height: 2, color: '#d9cbb0', style: 'palace' },
  { name: "Cubo d'Oro", rect: [55, 86, 58, 89], height: 2, color: '#d4a73a', style: 'palace' },
  { name: 'Statua di Carlo III', rect: [175, 66, 176, 67], height: 1.4, color: '#d6cfbf', style: 'statue' },
  { name: 'Statua di Ferdinando I', rect: [175, 73, 176, 74], height: 1.4, color: '#d6cfbf', style: 'statue' },
];

export const FOUNTAINS = [{ center: [281.5, 31], radius: 1.5 }];

export const WATER_JETS = [[57.8, 82.6, 0.5], [59, 82.6, 0.5], [60.2, 82.6, 0.5], [61.4, 82.6, 0.5], [62.6, 82.6, 0.5], [63.8, 82.6, 0.5], [65, 82.6, 0.5], [66.2, 82.6, 0.5], [62.5, 86.2, 1.1], [62, 73.6, 0.6], [62, 76, 0.6], [62, 78.4, 0.6]];

export const FUNICULARS = [
  { name: 'Funicolare Centrale', color: '#c8262b', lower: { name: 'Augusteo', at: [178, 58] }, upper: { name: 'Piazza Fuga', at: [148, 35] } },
  { name: 'Funicolare di Chiaia', color: '#2f6fb5', lower: { name: 'Parco Margherita', at: [155.5, 66] }, upper: { name: 'Cimarosa', at: [150.5, 47] } },
  { name: 'Funicolare di Montesanto', color: '#3a9a5b', lower: { name: 'Montesanto', at: [177.5, 38.5] }, upper: { name: 'Morghen', at: [145, 38] } },
];

export const METRO_LINES = [
  { name: 'Linea 1', color: '#e8b400', stations: [
    { name: 'Garibaldi', at: [238, 60] },
    { name: 'Università', at: [214, 55] },
    { name: 'Municipio', at: [205, 72] },
    { name: 'Toledo', at: [183, 50] },
    { name: 'Dante', at: [178, 32] },
    { name: 'Museo', at: [183, 15] },
    { name: 'Salvator Rosa', at: [168, 26] },
    { name: 'Vanvitelli', at: [138, 30] },
    { name: "Medaglie d'Oro", at: [116, 16] },
  ] },
  { name: 'Linea 2', color: '#2f8fd8', stations: [
    { name: 'Bagnoli', at: [20, 84] },
    { name: "Cavalleggeri d'Aosta", at: [40, 62] },
    { name: 'Campi Flegrei', at: [75, 70] },
    { name: 'Leopardi', at: [70, 52] },
    { name: 'Mergellina', at: [108, 86] },
    { name: 'Piazza Amedeo', at: [153, 70] },
    { name: 'Montesanto', at: [174, 42] },
    { name: 'Cavour', at: [199, 18] },
    { name: 'Garibaldi', at: [244, 58] },
    { name: 'Gianturco', at: [304, 42] },
    { name: 'San Giovanni-Barra', at: [330, 83] },
  ] },
];

/** Colline e montagne: la collina di Posillipo/Vomero, il Vesuvio e Nisida. */
export const HILL = { x0: 86, x1: 104, y0: 24 };
export const VESUVIUS = { center: [255, 101], radius: 13 };
export const NISIDA = { center: [7, 106], radius: 4.5 };
export const BROWNFIELDS = [[2, 60, 22, 84]];
export const RAILYARD = { rect: [300, 44, 352, 52], trackY: 48 };

/** Quartieri, valutati in ordine: vince la prima regola che corrisponde. */
const DISTRICT_RULES = [
  ['Bagnoli', (x) => x < 40],
  ['San Giovanni a Teduccio', (x) => x >= 298],
  ['Fuorigrotta', (x) => x < HILL.x0],
  ['Posillipo', (x, y) => x < HILL.x1 && y >= HILL.y0],
  ['Vomero', (x) => x < HILL.x1],
  ['Centro Direzionale', (x, y) => x >= 262 && y < 72],
  ['Borgo Marinari', (x, y) => y >= 95 && x >= 159 && x < 176],
  ['Vesuvio', (x, y) => x >= 239 && y >= 86],
  ['Quartieri Spagnoli', (x, y) => x >= 163 && x < 180 && y >= 38 && y < 62],
  ['Mergellina', (x, y) => x < 124 && y >= 62],
  ['Vomero', (x, y) => x < 163 && y < 60],
  ['Chiaia', (x, y) => x < 170 && y >= 60],
  ['San Ferdinando', (x, y) => x < 212 && y >= 60 && y < 88],
  ['Porto', (x, y) => y >= 81 && x >= 200],
  ['Piazza Garibaldi', (x, y) => x >= 229 && y < 70],
  ['Museo · Foria', (x, y) => y < 22],
  ['Centro Storico', (x, y) => x >= 180 && x < 229 && y < 60],
  ['Porto', (x, y) => x >= 212 && y >= 60],
];

export function districtAt(x, y) {
  for (const [name, test] of DISTRICT_RULES) if (test(x, y)) return name;
  return 'Napoli';
}

/** Colori della mappa per quartiere. */
export const DISTRICT_COLORS = {
  Bagnoli: '#f3e2c7',
  Fuorigrotta: '#f1d9d0',
  Posillipo: '#d9ebc9',
  Vomero: '#e3dcf0',
  Mergellina: '#d7e9f2',
  Chiaia: '#f6e6c0',
  'Borgo Marinari': '#e6e0d0',
  'Quartieri Spagnoli': '#f2d3c9',
  'San Ferdinando': '#efe0cc',
  'Centro Storico': '#f0d8b8',
  'Museo · Foria': '#e9e3cf',
  Porto: '#dedcd4',
  'Piazza Garibaldi': '#e8d8e6',
  'Centro Direzionale': '#d4dde6',
  'San Giovanni a Teduccio': '#ddd4c8',
  Vesuvio: '#cbbfa8',
  Napoli: '#eeeeee',
};

/** Stile edilizio per quartiere: palette delle facciate e altezze [min, max] in piani. */
const ZONES = {
  industrial: {
    palette: ['#8d8a83', '#9b8f80', '#7d7a74', '#a6927a', '#8a7766', '#958e86'],
    heights: [1.5, 2.5],
    industrial: true, // capannoni: isolati più grandi
  },
  suburb: { palette: ['#d6c9b0', '#c4b49a', '#e0d2b4', '#b8ab95', '#d9b98e', '#cfa98a'], heights: [3, 6] },
  business: { palette: ['#9aa3ab', '#b3b8bc', '#8c97a1', '#c2c5c4'], heights: [4, 6] },
  vomero: { palette: ['#d8cfc0', '#c9b79a', '#e3d6b5', '#b9b4a8', '#d6b48c', '#cfc6b4'], heights: [3, 5] },
  chiaia: { palette: ['#e0b97a', '#d99872', '#e8d2a0', '#c98f5f', '#f0dcb0', '#d7a98a'], heights: [3, 4.5] },
  centro: {
    palette: ['#c9773f', '#d9a35b', '#b85c3c', '#e2b866', '#d4876a', '#a8673f', '#e0c08a'],
    heights: [2.5, 4],
  },
  sanFerdinando: { palette: ['#d9b178', '#c8865c', '#e6cfa0', '#cf9c74'], heights: [3, 4] },
  garibaldi: { palette: ['#bdb5a6', '#d2c3a0', '#a99f8c', '#c6b08a'], heights: [3, 5] },
  port: { palette: ['#8d8579', '#9a8f7a', '#7f7a70', '#a39a88'], heights: [1.5, 2.5] },
};

const DISTRICT_ZONE = {
  'San Giovanni a Teduccio': 'industrial',
  Fuorigrotta: 'suburb',
  Bagnoli: 'suburb',
  Posillipo: 'chiaia',
  'Centro Direzionale': 'business',
  Vomero: 'vomero',
  Chiaia: 'chiaia',
  Mergellina: 'chiaia',
  'Borgo Marinari': 'chiaia',
  'San Ferdinando': 'sanFerdinando',
  'Piazza Garibaldi': 'garibaldi',
  Porto: 'port',
};

export const zoneOf = (district) => ZONES[DISTRICT_ZONE[district] ?? 'centro'];
export const CENTRO_ZONE = ZONES.centro;

export function coastY(x) {
  const pts = COASTLINE;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    if (x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax);
  }
  return pts[pts.length - 1][1];
}

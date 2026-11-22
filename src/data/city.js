// Geografia di Napoli in coordinate-tile (1 tile = TILE px). Tutto è nello stesso
// sistema di riferimento: ovest = Bagnoli, est = San Giovanni a Teduccio.

// Due mappe: la 1 (quella classica, col radar) e la 2, «Napoli Grande»: la stessa città spostata più in
// basso di OY righe, con sopra la Napoli nord (Soccavo, Arenella, Capodimonte, Scampia, Capodichino) e
// senza radar. La scelta si fa nella schermata iniziale e vale dal caricamento della pagina.
const MAP_KEY = 'napule.mappa';

function readMapChoice() {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('mappa');
    if (q === '1' || q === '2') return Number(q);
    return globalThis.localStorage?.getItem(MAP_KEY) === '2' ? 2 : 1;
  } catch {
    return 1;
  }
}

/** Remembers the map for the next page load (the page must be reloaded to switch). */
export function chooseMap(id) {
  try {
    globalThis.localStorage?.setItem(MAP_KEY, String(id));
  } catch {
    // senza localStorage resta il parametro ?mappa= nell'indirizzo
  }
}

export const MAP_ID = readMapChoice();
export const OY = MAP_ID === 2 ? 64 : 0; // righe aggiunte a nord nella mappa 2
/** Nella mappa 2 il centro storico è più largo: DX colonne nuove subito a est di SPLIT. */
export const SPLIT = 213;
export const DX = MAP_ID === 2 ? 20 : 0;
export const HAS_RADAR = MAP_ID !== 2;
const X = (x) => (x > SPLIT ? x + DX : x);
/** Back from the map in use to the coordinates of map 1 (the new columns count as SPLIT). */
const unX = (x) => (x > SPLIT + DX ? x - DX : Math.min(x, SPLIT));
/** From the coordinates of map 1 (in tiles) to the map in use. */
export const at = (x, y) => [X(x), y + OY];

export const TILE = 32;
export const MAP_W = 354 + DX;
export const MAP_H = 112 + OY;

const road = (name, kind, width, path) => ({ name, kind, width, path });

/** Road classes, from the narrowest to the widest. */
export const ROAD_PRIORITY = { vicolo: 1, street: 2, main: 3, hwy: 4 };

export const COASTLINE = [[0, 97], [20, 98], [40, 100], [70, 100], [80, 101], [86, 106], [96, 100], [102, 95], [104, 92], [159, 92], [164, 93], [176, 93], [184, 87], [188, 83], [234, 83], [242, 88], [300, 88], [316, 89], [324, 93], [330, 100], [334, 112], [354, 112]];

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
  road('Via Pessina', 'main', 3, [[181, -30], [181, 36]]),
  road('Via Scarlatti', 'main', 3, [[120, 30], [160, 30]]),
  road('Via Luca Giordano', 'street', 2, [[138, 16], [138, 57]]),
  road('Via Cimarosa', 'street', 2, [[152, 22], [152, 52]]),
  road('Via Bernini', 'street', 2, [[128, 20], [128, 46], [126, 60]]),
  road('Via Morghen', 'street', 2, [[128, 40], [152, 40]]),
  road('Via San Carlo', 'main', 3, [[181, 62], [204, 62]]),
  road('Via Medina', 'street', 2, [[204, 50], [204, 64]]),
  road('Rettifilo · Corso Umberto I', 'main', 3, [[204, 57], [236, 50]]),
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
  road('Via Kerbaker', 'street', 2, [[128, -30], [128, 20]]),
  road('Via Simone Martini', 'street', 2, [[106, 16], [138, 16]]),
  road('Via Belvedere', 'street', 2, [[106, 36], [120, 30]]),
  road('Via del Parco Margherita', 'street', 2, [[154, 77], [154, 51]]),
  road('Viale Augusto', 'main', 3, [[52, 66], [73, 66]]),
  road('Via Giulio Cesare', 'main', 3, [[80, 61], [80, 34]]),
  road('Via Leopardi', 'street', 2, [[52, 52], [80, 52]]),
  road('Via Lepanto', 'street', 2, [[64, 34], [64, 66]]),
  road('Via Terracina', 'main', 3, [[52, 92], [52, -30]]),
  road('Viale Kennedy', 'main', 3, [[44, 92], [85, 92]]),
  road('Discesa Coroglio', 'street', 2, [[85, 92], [85, 100], [88, 100]]),
  road('Via Posillipo', 'street', 2, [[88, 100], [96, 98], [102, 94], [107, 90]]),
  road('Galleria Quattro Giornate', 'main', 3, [[84, 67], [94, 72], [102, 80], [107, 84]]),
  road('Galleria Laziale', 'street', 2, [[84, 61], [96, 63], [104, 70], [109, 76]]),
  road('Tangenziale', 'hwy', 3, [[44, 34], [80, 34], [94, 22], [106, 12], [140, 12], [150, 9], [156, 2], [157, -30]]),
  road('Via Taddeo da Sessa', 'main', 3, [[254, 18], [298, 18]]),
  road('Corso Malta', 'main', 3, [[298, 18], [298, 80]]),
  road('Via Giovanni Porzio', 'main', 3, [[264, 18], [264, 66]]),
  road('Via Poggioreale', 'main', 3, [[264, 18], [264, -30]]),
  road('Via Galileo Ferraris', 'main', 3, [[245, 66], [298, 66]]),
  road('Via Coroglio', 'main', 3, [[-30, 86], [4, 86], [26, 89], [44, 92]]),
  road('Via Diocleziano', 'main', 3, [[24, 34], [24, 88]]),
  road('Tangenziale', 'hwy', 3, [[-30, 34], [44, 34]]),
  road("Via Cavalleggeri d'Aosta", 'street', 2, [[24, 62], [52, 62]]),
  road('Via Nuova Agnano', 'street', 2, [[-30, 48], [24, 48]]),
  road('Via Bagnoli', 'street', 2, [[24, 74], [52, 74]]),
  road('Via Nisida', 'street', 2, [[20, 88], [20, 104]]),
  road('Via Taddeo da Sessa', 'main', 3, [[298, 18], [384, 18]]),
  road('Via Gianturco', 'main', 3, [[298, 40], [384, 40]]),
  road('Via Galileo Ferraris', 'main', 3, [[298, 66], [384, 66]]),
  road('Corso San Giovanni a Teduccio', 'main', 3, [[298, 80], [384, 80]]),
  road('Via Ponte dei Francesi', 'street', 2, [[316, 18], [316, 80]]),
  road("Via Brecce a Sant'Erasmo", 'street', 2, [[336, 18], [336, 80]]),
];

/** Parcheggi in fondo alle strade senza uscita: le auto ci entrano, sostano e ripartono. */
export const PARKINGS = [
  { name: "Parcheggio Sant'Elmo", rect: [160, 26, 167, 31] },
  { name: 'Parcheggio Medina', rect: [200, 47, 208, 50] },
  { name: 'Parcheggio Borgo Marinari', rect: [168, 96, 174, 99] },
  { name: 'Parcheggio Cilea', rect: [104, 50, 109, 54] },
  { name: 'Parcheggio Belvedere', rect: [104, 36, 109, 40] },
  { name: 'Parcheggio di Nisida', rect: [17, 104, 23, 107] },
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
  { name: 'Pontile Nord', rect: [5, 96, 8, 109] },
  { name: 'Darsena di San Giovanni', rect: [306, 88, 312, 98] },
  { name: 'Darsena Petroli', rect: [318, 90, 324, 98] },
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
  { name: 'Università Federico II', rect: [197, 51, 203, 56], height: 3.2, color: '#d8c7a4', style: 'palace' },
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
  { name: 'Carcere di Poggioreale', rect: [268, 3, 287, 15], height: 2.6, color: '#8f8a80', style: 'prison' },
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
export const VESUVIUS = { center: [342, 101], radius: 12 }; // a est, oltre San Giovanni a Teduccio
export const NISIDA = { center: [20, 107], radius: 4 }; // l'isolotto a est del Pontile Nord
/** Le spiagge: sabbia fra la strada e il mare. */
export const BEACHES = [{ name: 'Spiaggia di Bagnoli', rect: [2, 88, 44, 101] }];
export const BROWNFIELDS = [[2, 60, 22, 84]];
/**
 * L'ingresso nord dello Stadio Maradona, verso Piazzale Tecchio: un varco nelle tribune che si apre
 * solo per la missione segreta. Rettangolo in coordinate-tile [x0, y0, x1, y1).
 */
export const STADIUM_GATE = { rect: [77, 71, 80, 74], pitch: [78, 80] };
export const RAILYARD = { rect: [300, 44, 352, 52], trackY: 48 };

/** Quartieri, valutati in ordine: vince la prima regola che corrisponde. */
const DISTRICT_RULES = [
  ['Vesuvio', (x, y) => Math.hypot(x - VESUVIUS.center[0], (y - VESUVIUS.center[1]) * 1.1) < VESUVIUS.radius + 1],
  ['Bagnoli', (x) => x < 40],
  ['Bagnoli', (x, y) => x < HILL.x0 && y >= 95], // Coroglio e Nisida
  ['San Giovanni a Teduccio', (x) => x >= 298],
  ['Poggioreale', (x, y) => x >= 255 && y < 18],
  ['Fuorigrotta', (x) => x < HILL.x0],
  ['Posillipo', (x, y) => x < HILL.x1 && y >= HILL.y0],
  ['Vomero', (x) => x < HILL.x1],
  ['Centro Direzionale', (x, y) => x >= 262 && y < 72],
  ['Borgo Marinari', (x, y) => y >= 95 && x >= 159 && x < 176],
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
  x = unX(x);
  if (y < OY) for (const [name, test] of NORTH_DISTRICT_RULES) if (test(x, y)) return name;
  for (const [name, test] of DISTRICT_RULES) if (test(x, y - OY)) return name;
  return 'Napoli';
}

/** I quartieri della Napoli nord (solo mappa 2), in coordinate della mappa 2. */
const NORTH_DISTRICT_RULES = [
  ['Soccavo', (x) => x < 100],
  ['Arenella', (x) => x < 158],
  ['Scampia', (x, y) => y < 21 && x < 264],
  ['Capodimonte', (x) => x < 264],
  ['Capodichino', (x, y) => y < 52],
  ['Poggioreale', () => true],
];

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
  Poggioreale: '#d9d4cc',
  'San Giovanni a Teduccio': '#ddd4c8',
  Vesuvio: '#cbbfa8',
  Soccavo: '#efe1cf',
  Arenella: '#e6def0',
  Capodimonte: '#d9ead0',
  Scampia: '#d6d6d6',
  Capodichino: '#dedad0',
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
  Poggioreale: 'garibaldi',
  Porto: 'port',
  Soccavo: 'suburb',
  Arenella: 'vomero',
  Capodimonte: 'garibaldi',
  Scampia: 'business',
  Capodichino: 'industrial',
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

// ---------------------------------------------------------------------------
// Mappa 2: tutto più giù di OY righe, e sopra la Napoli nord con le sue strade
// ---------------------------------------------------------------------------
const EXIT = -30; // le strade che arrivano qui escono dalla città

function shiftAll() {
  const pt = (p) => (p[1] = p[1] + OY);
  const rect = (r) => ((r[1] += OY), (r[3] += OY));
  COASTLINE.forEach(pt);
  // Le strade che uscivano a nord ora attraversano la Napoli nord: le loro uscite restano fuori dalla mappa.
  for (const r of ROADS) for (const p of r.path) if (p[1] !== EXIT) pt(p);
  for (const list of [PARKINGS, PLAZAS, PARKS, QUAYS, BEACHES]) for (const x of list) rect(x.rect);
  BROWNFIELDS.forEach(rect);
  for (const lm of LANDMARKS) (lm.rect ? rect(lm.rect) : pt(lm.center));
  for (const f of FOUNTAINS) pt(f.center);
  WATER_JETS.forEach(pt);
  for (const f of FUNICULARS) (pt(f.lower.at), pt(f.upper.at));
  for (const line of METRO_LINES) for (const st of line.stations) pt(st.at);
  HILL.y0 += OY;
  pt(VESUVIUS.center);
  pt(NISIDA.center);
  rect(STADIUM_GATE.rect);
  pt(STADIUM_GATE.pitch);
  rect(RAILYARD.rect);
  RAILYARD.trackY += OY;
}

/** Ends a road that used to leave town to the north at `y` (map 2), where the new streets begin. */
function endAt(name, y) {
  for (const r of ROADS.filter((r) => r.name === name))
    for (const end of [r.path[0], r.path.at(-1)]) if (end[1] === EXIT) end[1] = y;
}

function addNorth() {
  endAt('Via Terracina', 44);
  endAt('Via Kerbaker', 44);
  endAt('Via Pessina', 52);
  endAt('Via Poggioreale', 52);
  ROADS.push(
    // Soccavo e Arenella (a ovest della Tangenziale, che sale dritta verso nord).
    road('Via Epomeo', 'street', 2, [[EXIT, 44], [52, 44]]),
    road('Via Pigna', 'street', 2, [[52, 44], [100, 44]]),
    road('Via Pietravalle', 'street', 2, [[100, 44], [128, 44]]),
    road('Viale Traiano', 'main', 3, [[52, 44], [52, EXIT]]),
    road('Via Domenico Fontana', 'street', 2, [[128, 44], [128, EXIT]]),
    road('Via Cinthia', 'street', 2, [[EXIT, 20], [52, 20]]),
    road('Via Camaldolilli', 'street', 2, [[52, 20], [128, 20]]),
    road('Via Piave', 'street', 2, [[100, 44], [100, 20]]),
    // Capodimonte, Scampia, Capodichino.
    road('Corso Amedeo di Savoia', 'main', 3, [[181, 52], [181, EXIT]]),
    road('Via Capodimonte', 'street', 2, [[181, 52], [264, 52]]),
    road('Calata Capodichino', 'main', 3, [[264, 52], [264, EXIT]]),
    road('Via Nuova Poggioreale', 'main', 3, [[264, 52], [384, 52]]),
    road('Via del Riposo', 'street', 2, [[298, 52], [298, 82]]),
    road('Via Santa Maria a Cubito', 'street', 2, [[181, 20], [264, 20]]),
    road('Corso Secondigliano', 'main', 3, [[264, 20], [384, 20]]),
    road('Via Labriola', 'street', 2, [[222, 20], [222, EXIT]]),
    road('Viale della Resistenza', 'street', 2, [[222, 10], [264, 10]]),
    road('Via Colli Aminei', 'street', 2, [[166, 30], [181, 30]]),
  );
  PARKINGS.push({ name: 'Parcheggio Colli Aminei', rect: [161, 28, 166, 33] });
  PLAZAS.push(
    { name: 'Tondo di Capodimonte', rect: [176, 54, 187, 60] },
    { name: 'Aeroporto di Capodichino', rect: [270, 24, 350, 48] },
    { name: 'Piazza Giovanni Paolo II', rect: [214, 22, 221, 28], palms: true },
  );
  PARKS.push(
    { name: 'Bosco di Capodimonte', rect: [186, 24, 258, 48] },
    { name: 'Parco dei Camaldoli', rect: [56, 24, 96, 40] },
    { name: 'Cimitero di Poggioreale', rect: [301, 56, 350, 78] },
  );
  LANDMARKS.push(
    { name: 'Reggia di Capodimonte', rect: [216, 38, 230, 45], height: 3.2, color: '#c9705a', style: 'palace' },
    { name: 'Ospedale Cardarelli', rect: [106, 26, 122, 38], height: 3.6, color: '#d8d0c0', style: 'palace' },
    { name: 'Vele di Scampia', rect: [228, 12, 236, 18], height: 6, color: '#bdb7ab', style: 'tower' },
    { name: 'Vele di Scampia', rect: [240, 12, 248, 18], height: 6, color: '#b3ada1', style: 'tower' },
    { name: 'Vele di Scampia', rect: [252, 12, 260, 18], height: 5.5, color: '#bdb7ab', style: 'tower' },
  );
  METRO_LINES[0].stations.push(
    { name: 'Rione Alto', at: [125, 47] },
    { name: 'Colli Aminei', at: [184, 40] },
    { name: 'Piscinola-Scampia', at: [224, 23] },
  );
}

/** Map 2: the city east of SPLIT moves DX columns to the right; what straddles the line gets longer. */
function stretchX() {
  const pt = (p) => (p[0] = X(p[0]));
  const rect = (r) => ((r[0] = X(r[0])), (r[2] = X(r[2])));
  COASTLINE.forEach(pt);
  for (const r of ROADS) r.path.forEach(pt);
  for (const list of [PARKINGS, PLAZAS, PARKS, QUAYS, BEACHES]) for (const x of list) rect(x.rect);
  BROWNFIELDS.forEach(rect);
  for (const lm of LANDMARKS) (lm.rect ? rect(lm.rect) : pt(lm.center));
  for (const f of FOUNTAINS) pt(f.center);
  WATER_JETS.forEach(pt);
  for (const f of FUNICULARS) (pt(f.lower.at), pt(f.upper.at));
  for (const line of METRO_LINES) for (const st of line.stations) pt(st.at);
  pt(VESUVIUS.center);
  pt(NISIDA.center);
  rect(STADIUM_GATE.rect);
  pt(STADIUM_GATE.pitch);
  rect(RAILYARD.rect);
}

/** The new columns of the centro storico: vicoli, San Lorenzo, Piazza Nicola Amore on the Rettifilo. */
function addCentro() {
  const y = (v) => v + OY;
  const x = (v) => SPLIT + v; // dentro le colonne nuove
  ROADS.push(
    road('Vico Sedil Capuano', 'vicolo', 1, [[x(3.5), y(39)], [x(3.5), y(55)]]),
    road('Vico Zuroli', 'vicolo', 1, [[x(9.5), y(39)], [x(9.5), y(54)]]),
    road('Vico Pallonetto a Santa Chiara', 'vicolo', 1, [[x(15.5), y(39)], [x(15.5), y(53)]]),
    road('Via Vicaria Vecchia', 'vicolo', 1, [[x(1), y(50.5)], [x(24), y(50.5)]]),
    road('Via Forcella', 'vicolo', 2, [[x(1), y(26)], [x(24), y(26)]]),
    road('Vico della Pace', 'vicolo', 1, [[x(9.5), y(18)], [x(9.5), y(39)]]),
  );
  PLAZAS.push({ name: 'Piazza Nicola Amore', rect: [x(10), y(52), x(15), y(57)] });
  LANDMARKS.push(
    { name: 'San Lorenzo Maggiore', rect: [x(5), y(41), x(9), y(45)], height: 3, color: '#d9c49e', style: 'church' },
    { name: 'Chiesa dei Girolamini', rect: [x(11), y(30), x(15), y(36)], height: 3, color: '#e0cfa8', style: 'church' },
  );
}

if (OY) {
  shiftAll();
  addNorth();
}
if (DX) {
  stretchX();
  addCentro();
}

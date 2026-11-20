/** Il menù, uguale in tutte le pizzerie. */
export const MENU = [
  { nome: 'Margherita', prezzo: 8.0 },
  { nome: 'Marinara', prezzo: 7.0 },
  { nome: 'Diavola', prezzo: 9.0 },
  { nome: 'Capricciosa', prezzo: 10.0 },
  { nome: 'Quattro Stagioni', prezzo: 10.0 },
  { nome: 'Salsiccia e Friarielli', prezzo: 12.0 },
  { nome: 'Cosacca', prezzo: 8.0 },
  { nome: 'Ripieno', prezzo: 12.0 },
];

/** Le cinque pizzerie (nomi di fantasia). `at` è in coordinate-tile. */
export const PIZZERIAS = [
  { id: 'ciccio', name: 'Pizzeria Don Ciccio', color: '#c8262b', at: [200, 38] },
  { id: 'scugnizzo', name: "'O Scugnizzo", color: '#2f8f4e', at: [171, 49] },
  { id: 'collina', name: 'Pizzeria La Collina', color: '#7b4fb0', at: [125, 27] },
  { id: 'stadio', name: "Pizzeria 'O Stadio", color: '#2f7fd0', at: [60, 63] },
  { id: 'ferrovia', name: "Pizzeria 'A Ferrovia", color: '#e07b1a', at: [242, 66] },
];

export const SURNAMES = [
  'Esposito',
  'Russo',
  'De Luca',
  'Romano',
  'Coppola',
  'Iovine',
  'Capasso',
  'Ruggiero',
  'Caputo',
  'Scognamiglio',
  'Improta',
  'Sannino',
  'Cuomo',
  'Gargiulo',
  'Starace',
  'Imparato',
  'Ascione',
  'Di Lorenzo',
  'Mazzarella',
  'Liguori',
  'Formisano',
  'Sorrentino',
  'Cozzolino',
  'Ferraiuolo',
];

/** Le regole del lavoro da fattorino. Tempi in secondi reali. */
export const RULES = Object.freeze({
  shiftLength: 20 * 60, // una giornata di consegne
  orderInterval: 150, // ogni 2 minuti e mezzo parte una nuova consegna
  orderTime: 180, // 3 minuti per consegnare tutto
  tipWindow: 60, // entro il primo minuto il cliente lascia la mancia…
  tipRange: [0.05, 0.2], // …dal 5% al 20% del suo ordine
  pizzasPerOrder: [3, 7],
  familiesPerOrder: 3,
  maxPizzasPerFamily: 4,
  firingChancePerPizza: 0.01, // per ogni pizza non consegnata
  basePay: 10, // € per ogni consegna
  commission: 0.2, // 20% del valore consegnato
  openings: 2, // pizzerie che assumono quando sei disoccupato
});

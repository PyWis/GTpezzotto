import { MAP_W, TILE } from './city.js';

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

/** Le regole del gioco. Tempi in secondi reali. */
export const RULES = Object.freeze({
  dayLength: 20 * 60, // una giornata
  orderInterval: 150, // ogni 2 minuti e mezzo parte una nuova consegna…
  earlyOrderDelay: [5, 15], // …ma se torni in pizzeria a mani vuote ne arriva una dopo 5-15 s
  orderTime: 180, // 3 minuti per consegnare tutto
  tipWindow: 60, // la famiglia servita entro un minuto (dal ritiro o dalla consegna precedente) lascia la mancia…
  tipRange: [0.05, 0.2], // …dal 5% al 20% della sua parte d'ordine
  pizzasPerOrder: [3, 7],
  familiesPerOrder: 3,
  maxPizzasPerFamily: 4,
  firingChancePerPizza: 0.01, // per ogni pizza non consegnata
  basePay: 10, // € per ogni consegna con almeno una famiglia servita
  commission: 0.2, // 20% del valore consegnato
  openings: 2, // pizzerie che assumono (segreto finché non chiedi)
  rehireAfterDays: 10, // dopo che te ne vai, quella pizzeria potrebbe riprenderti
  livingCost: [100, 200], // € al giorno per vivere
  maxDaysInRed: 3, // giorni di fila sotto zero prima del game over
  sideJob: {
    chance: 0.25, // un'altra pizzeria ha una consegna da affidarti
    cooldown: 150, // s prima di poter richiedere alla stessa pizzeria
    pizzas: 5, // per una sola famiglia…
    minDistance: (MAP_W * TILE) / 2, // …ad almeno metà mappa di distanza (px)
    time: 180,
  },
  footballer: {
    chance: 1 / 50, // al posto di un ordine normale
    name: 'Calciatore del Napoli',
    time: 90,
    maxDistance: 60 * TILE, // px: abita (o si allena) non troppo lontano
    bonus: 0.2, // +20% su tutti i guadagni…
    bonusDays: 2, // …per i 2 giorni successivi (si accumula)
  },
  tuning: {
    cost: 1000, // l'officina di Fuorigrotta
    speed: 1.2, // la Vespa modificata va il 20% più veloce
  },
});

/** L'officina di Fuorigrotta dove si modifica la Vespa. `at` è in coordinate-tile. */
export const GARAGE = { name: "Officina 'O Turbo", color: '#2b8fd6', at: [70, 54] };

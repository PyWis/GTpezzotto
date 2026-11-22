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
  { id: 'Garibaldi', name: 'Pizzeria Garibaldi', color: '#e07b1a', at: [242, 66] },
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
  orderTime: 150, // 2 minuti e mezzo per consegnare tutto
  tipWindow: 40, // la famiglia servita entro 40 secondi (dal ritiro o dalla consegna precedente) lascia la mancia…
  tipRange: [0.05, 0.2], // …dal 5% al 20% della sua parte d'ordine
  pizzasPerOrder: [3, 7],
  familiesPerOrder: 3,
  maxPizzasPerFamily: 4,
  firingChancePerPizza: 0.05, // per ogni pizza non consegnata
  basePay: 2, // € per ogni consegna con almeno una famiglia servita
  commission: 0.1, // 10% del valore consegnato
  openings: 2, // pizzerie che assumono (segreto finché non chiedi)
  rehireAfterDays: 10, // dopo che te ne vai, quella pizzeria potrebbe riprenderti
  livingCost: [100, 200], // € al giorno per vivere
  maxDaysInRed: 3, // giorni di fila sotto zero prima del game over
  schedule: {
    footballerAt: 11, // l'11° ordine del giorno è del calciatore (se oggi non è ancora venuto)…
    vipBy: [11, 12], // …o del cliente speciale: l'11° o il 12° ordine, se oggi non ha ancora chiamato
    maxOrders: 12, // dopo 12 ordini i clienti si sono mangiati tutto: la pizzeria chiude per oggi…
    sideJobChance: 1, // …e le altre pizzerie hanno sempre una consegna extra, fino a fine giornata
  },
  sideJob: {
    chance: 0.25, // un'altra pizzeria ha una consegna da affidarti
    cooldown: 150, // s prima di poter richiedere alla stessa pizzeria
    pizzas: 5, // per una sola famiglia…
    minDistance: (MAP_W * TILE) / 2, // …ad almeno metà mappa di distanza (px)
    time: 180,
    payMultiplier: 2, // la consegna extra paga il doppio di un ordine normale
  },
  footballer: {
    chance: 0.04, // al posto di un ordine normale
    name: 'Calciatore del Napoli',
    time: 90,
    maxDistance: 60 * TILE, // px: abita (o si allena) non troppo lontano
    bonus: 0.2, // +20% su tutti i guadagni…
    bonusDays: 2, // …per i 2 giorni successivi (si accumula)
    blessedTip: 10, // € in più da ogni calciatore, dopo aver servito il Dio del Calcio (per sempre)
  },
  tuning: {
    cost: 2000, // l'officina di Fuorigrotta, tutto subito…
    deposit: 1000, // …oppure 1000 € subito…
    installment: { amount: 150, days: 8 }, // …e 150 € al giorno per gli 8 giorni successivi
    speed: 1.2, // la Vespa modificata va il 20% più veloce
    familiesPerOrder: 5, // e con la Vespa truccata gli ordini arrivano fino a 5 famiglie…
    pizzasPerOrder: [5, 12], // …e fino a 12 pizze
  },
  ownShop: {
    fromDay: 12, // dal giorno 12 (se fidanzato con Filomena) Gennaro può aprire una pizzeria sua
    cost: 5000, // tutto subito…
    deposit: 2000, // …oppure 2000 € subito…
    installment: { amount: 150, days: 18 }, // …e 150 € al giorno per 18 giorni
    licence: 200, // € al giorno di licenza, per sempre
    share: 0.5, // il 50% di ogni consegna (niente fisso)
    livingCost: [150, 300], // da padrone si spende di più
    minDistance: 12 * TILE, // px dalle altre pizzerie
  },
  story: {
    visits: { 3: 2, 4: 3, 6: 1, 7: 1 }, // quante volte Filomena saluta Gennaro, per giorno
    callDay: 5, // il giorno della telefonata…
    callAfter: 15 * 60, // …dopo 15 minuti
    castleDay: 8, // a fine giornata, se la Vespa è truccata: Castel dell'Ovo
  },
  wear: {
    perBump: 0.001, // ogni urto la Vespa perde lo 0,1% della sua velocità (si accumula)
    minCondition: 0.5, // più ammaccata di così non va: almeno metà della velocità
    bumpSpeed: 60, // px/s: sotto questa velocità non è un urto
  },
  stage: {
    orders: 3, // le prime 3 consegne della partita sono di prova: il pizzaiolo spiega le regole, niente paga
  },
  repair: {
    costPerPoint: 3, // € per ogni punto percentuale di velocità da recuperare
  },
  vip: {
    fromDay: 2, // il primo giorno niente clienti speciali
    first: 'Lucia', // la prima è sempre lei
    afterOrders: 3, // dopo il terzo ordine della giornata…
    chance: 0.2, // …ogni nuovo ordine ha il 20% di essere un cliente speciale…
    lateWindow: 5 * 60, // …che diventa il 60% negli ultimi 5 minuti della giornata
    lateChance: 0.6,
    pizzas: 7, // un cliente speciale chiede sempre 7 pizze
    time: 80, // s per consegnarle, dal ritiro
    nextOrderAfterPickup: 30, // 30 s dopo il ritiro arriva già l'ordine successivo
  },
  legend: {
    day: 10, // la missione segreta: giorno 10…
    after: 10 * 60, // …dopo 10 minuti di gioco
    pizzeria: 'stadio', // da disoccupato le pizze si ritirano qui
    time: 5 * 60,
    tip: 115, // mancia extra
    name: 'Il Dio del Calcio',
    rumorsFrom: 8, // dal giorno 8 i passanti ne parlano
  },
});

/** L'officina di Fuorigrotta dove si modifica la Vespa. `at` è in coordinate-tile. */
export const GARAGE = { name: "Officina 'O Turbo", color: '#2b8fd6', at: [70, 54], tag: 'MODIFICA VESPA' };

/** L'unica officina che ripara la Vespa: Via Gianturco. */
export const REPAIR_SHOP = { name: 'Officina Don Peppe', color: '#3aa35b', at: [326, 42.5], tag: 'RIPARA VESPA' };

/** Cosa dicono i meccanici quando arriva Gennaro (e l'uno dell'altro). */
export const MECHANIC_LINES = {
  repair: [
    'Ccà se fanno sulo cose pulite, guagliò.',
    "Chillo 'e Fuorigrotta? Primma o poi te fa fernì a Poggioreale!",
    'Pezzi originali e fattura: io faccio cose pulite.',
    "'E marmitte truccate 'e Fuorigrotta? Poggioreale sta a dduje passi!",
    "Io t'aggiusto 'a Vespa comme Dio comanda. Chill'ato te porta 'n galera.",
  ],
  tuning: [
    "Gianturco? Chi sente a chilli là, i napoletani se magnano 'e pizze fredde!",
    "Cose pulite, dice isso... e 'a Margherita arriva gelata!",
    "Si dai retta 'e meccanici 'e Gianturco, a Napule 'a pizza s'arrefredda.",
    "Chillo 'e Gianturco va a passo d'ommo. Ccà se vola!",
    "Poggioreale? Ma qua' Poggioreale: ccà se fa 'a Vespa ca vola!",
  ],
};

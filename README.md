# Napule · Grand Theft Vespa

Un gioco in stile GTA2 (visuale dall'alto, palazzi in pseudo-3D) ambientato a Napoli, da Bagnoli a San Giovanni a Teduccio.

## Obiettivo

Sei **Gennaro**, disoccupato. Fatti assumere da una pizzeria, consegna le pizze in Vespa e non finire in rosso.

- Il tempo scorre sempre: **una giornata dura 20 minuti reali**. Ogni giorno Gennaro spende **da 100 a 200 €** per vivere.
  Se resta **sotto zero per 3 giorni di fila** è game over.
- Ci sono **5 pizzerie**; ogni giorno solo **2** cercano un fattorino, ma **non si sa quali**: bisogna fare il giro e
  chiedere (tasto E alla porta).
- Chi lascia una pizzeria (o viene licenziato) non può essere riassunto lì per **10 giorni**; dopo, quella pizzeria
  potrebbe tornare a cercarlo.
- Appena assunto arriva il primo ordine; poi ne arriva uno ogni **2 minuti e mezzo**. Se Gennaro ha finito le consegne
  e torna in pizzeria prima, il nuovo ordine arriva dopo **5-15 secondi**.
- Ogni ordine ha **da 3 a 7 pizze**, divise fra **tre famiglie** (massimo 4 pizze a famiglia) che abitano in palazzi a
  caso in tutta Napoli.
- Hai **3 minuti** per ritirare le pizze in pizzeria e consegnarle tutte.
- La mancia si calcola su **ogni singola consegna**: se servi una famiglia **entro un minuto** dal ritiro (o dalla
  consegna precedente) ti lascia una **mancia dal 5% al 20%** della sua parte d'ordine. Il minuto riparte dopo ogni
  famiglia.
- Paga per ogni ordine: **10 €** fissi (solo se hai servito almeno una famiglia) + il **20%** del valore delle pizze
  consegnate + le mance.
- Per ogni pizza non consegnata c'è il **5% di probabilità di essere licenziato**.

### Extra

- **Consegne extra**: chiedendo (E) a una pizzeria che non è la tua, nel **25%** dei casi ha una consegna da affidarti:
  **5 pizze per una sola famiglia**, ad **almeno metà mappa** di distanza, 3 minuti di tempo, pagata il **doppio** di un
  ordine normale. Una alla volta; alla stessa pizzeria si può richiedere dopo 2 minuti e mezzo. Funziona anche da disoccupati, e
  perderla non fa licenziare.
- **Il calciatore del Napoli**: nel **4%** dei casi, al posto di un ordine normale, «un calciatore del Napoli ti ha chiesto
  una pizza». Una pizza, **90 secondi**, nessun guadagno (la pizza è gratis), ma se arrivi in tempo per **i 2 giorni
  successivi** tutti i guadagni sono del **+20%**. Il bonus si accumula (due calciatori = +40%). Il calciatore aspetta
  per strada, in maglia azzurra, palleggiando.
- **Officina 'O Turbo** (Fuorigrotta, Via Leopardi): portaci la Vespa e per **1000 €** la modificano; quella Vespa va il
  **20% più veloce**.
- **Vespa ammaccata**: ogni urto (contro un muro o un'auto) la rallenta dell'**1%**, fino a un minimo del 50%. La si
  ripara solo all'**Officina Don Peppe in Via Gianturco**, per **3 € a punto** perso. I due meccanici non si sopportano:
  quello di Gianturco giura di fare solo cose pulite e che l'altro prima o poi ti fa finire a **Poggioreale** (c'è il
  carcere, in fondo a Via Poggioreale); quello di Fuorigrotta dice che a dare retta a Gianturco i napoletani mangiano le
  pizze fredde.
- **???**: c'è una missione segreta. Si sa solo che arriva una volta sola, e che c'entra lo stadio.

### Salvataggio e pausa

La partita si salva da sola ogni 15 secondi, quando si mette in pausa e quando si chiude la pagina (nel browser, con
`localStorage`). Alla riapertura il tasto diventa «CONTINUA»; «NUOVA PARTITA» cancella il salvataggio. **P** o **Esc**
(o il tasto ⏸) mettono in pausa; il gioco va in pausa anche quando si cambia scheda.

Le pizze si caricano passando davanti alla porta della pizzeria e si consegnano passando piano davanti al portone del
cliente. La freccia attorno a Gennaro indica l'obiettivo più vicino.

## Comandi

| Tasto | Azione |
| --- | --- |
| ↑ / W, ↓ / S | avanti / indietro (accelera, frena) |
| ← → / A D | gira |
| Shift | corri (a piedi) |
| Spazio | freno a mano |
| E | Vespa, pizzeria, officina, funicolare, metro |
| H | clacson |
| M | stradario (rotella / pizzica per lo zoom) |
| N | audio on/off |
| P / Esc | pausa |

Su telefono compaiono i tasti a schermo.

## Avvio

Il gioco usa moduli ES, quindi va servito via HTTP (non con un doppio clic sul file):

```bash
npm start          # oppure: npx serve .
```

e apri `http://localhost:8080`. Funziona così com'è anche su GitHub Pages.

## Test

```bash
npm test
```

I test (`tests/career.test.js`) verificano le regole: assunzioni segrete, riassunzione dopo 10 giorni, ordini e ordini anticipati, mance per singola consegna, paga, licenziamenti, consegne extra, il calciatore e il suo bonus, l'officina, la riparazione, la missione segreta, il salvataggio, spese giornaliere e game over.

## La città

Il traffico gira da una strada all'altra agli incroci e attraversa le piazze. Le strade che escono dalla mappa
(Tangenziale, Via Coroglio, Via Nuova Agnano, Via Terracina, Via Pessina, Via Kerbaker e le strade di San Giovanni)
continuano oltre il bordo: le auto escono dalla città e ne entrano altre. Le strade senza uscita dentro la città finiscono
in un parcheggio (Sant'Elmo, Medina, Borgo Marinari, Cilea, Belvedere, Nisida), dove le auto sostano e poi ripartono.
A ovest c'è la spiaggia di Bagnoli: da sinistra il Pontile Nord e poi Nisida, collegata da Via Nisida; il Vesuvio
è a est, oltre San Giovanni a Teduccio.

## Struttura del codice

```
src/
  main.js              ciclo di gioco: input → simulazione → rendering
  core/                matematica, colori, formattazione, tempo
  data/                dati puri: geografia di Napoli, persone, menù e regole delle pizzerie
  world/               costruzione della mappa a tile, collisioni, alberi; roadnet.js: incroci, uscite dalla città e
                       parcheggi per il traffico
  entities/            Gennaro, Vespe, pedoni, traffico, funicolari e metro
  game/
    career.js          regole del lavoro (logica pura, testata)
    addresses.js       indirizzi casuali dei clienti
    save.js            salvataggio nel browser (localStorage)
    job.js             collega la carriera al gioco: pizzerie, notifiche, dialoghi
  render/              disegno su canvas: suolo, palazzi, monumenti, sprite, HUD, mappe
  ui/dialog.js         finestre di dialogo in stile pixel
```

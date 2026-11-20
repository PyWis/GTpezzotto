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
- Se consegni **entro il primo minuto** la famiglia ti lascia una **mancia dal 5% al 20%** del suo ordine.
- Paga per ogni ordine: **10 €** fissi (solo se hai servito almeno una famiglia) + il **20%** del valore delle pizze
  consegnate + le mance.
- Per ogni pizza non consegnata c'è l'**1% di probabilità di essere licenziato**.

Le pizze si caricano passando davanti alla porta della pizzeria e si consegnano passando piano davanti al portone del
cliente. La freccia attorno a Gennaro indica l'obiettivo più vicino.

## Comandi

| Tasto | Azione |
| --- | --- |
| ↑ / W, ↓ / S | avanti / indietro (accelera, frena) |
| ← → / A D | gira |
| Shift | corri (a piedi) |
| Spazio | freno a mano |
| E | Vespa, pizzeria, funicolare, metro |
| H | clacson |
| M | stradario (rotella / pizzica per lo zoom) |
| N | audio on/off |

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

I test (`tests/career.test.js`) verificano le regole: assunzioni segrete, riassunzione dopo 10 giorni, ordini e ordini anticipati, mance, paga, licenziamenti, spese giornaliere e game over.

## Struttura del codice

```
src/
  main.js              ciclo di gioco: input → simulazione → rendering
  core/                matematica, colori, formattazione, tempo
  data/                dati puri: geografia di Napoli, persone, menù e regole delle pizzerie
  world/               costruzione della mappa a tile, collisioni, alberi
  entities/            Gennaro, Vespe, pedoni, traffico, funicolari e metro
  game/
    career.js          regole del lavoro (logica pura, testata)
    addresses.js       indirizzi casuali dei clienti
    job.js             collega la carriera al gioco: pizzerie, notifiche, dialoghi
  render/              disegno su canvas: suolo, palazzi, monumenti, sprite, HUD, mappe
  ui/dialog.js         finestre di dialogo in stile pixel
```

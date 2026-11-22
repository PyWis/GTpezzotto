import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Career } from '../src/game/career.js';
import { Phase, Story } from '../src/game/story.js';
import { MENU, PIZZERIAS, RULES, SURNAMES } from '../src/data/pizza.js';

const DAY = RULES.dayLength;
const PIER = { x: 100, y: 9000, label: 'Pontile Nord' };
const CASTLE = { meet: [7000, 9000], door: [7100, 9100] };
const far = { x: -1e6, y: -1e6, speed: 0, onFoot: false };
const at = ([x, y], onFoot = false) => ({ x, y, speed: 0, onFoot });

function makeStory() {
  const pizzerias = PIZZERIAS.map((p, i) => ({ ...p, pos: [i * 1000, 0] }));
  let n = 0;
  const events = [];
  const career = new Career({
    pizzerias,
    menu: MENU,
    surnames: SURNAMES,
    rules: { ...RULES, stage: null, livingCost: [0, 0] },
    findAddress: () => ({ x: 5000 + 500 * n++, y: 3000, label: 'Via Test' }),
    rng: () => 0.5,
    onEvent: (e) => events.push(e),
  });
  const story = new Story({ career, pier: PIER, castle: CASTLE, onEvent: (e) => events.push(e) });
  const tick = (seconds, where = far) => {
    for (let t = 0; t < seconds; t++) {
      career.update(1, where);
      story.update(where);
    }
  };
  return { career, story, events, tick };
}

const ofType = (events, type) => events.filter((e) => e.type === type);

test('Filomena passa 2 volte il giorno 3, 3 volte il giorno 4, una volta il 6 e il 7', () => {
  const { career, events, tick } = makeStory();
  career.wallet = 1e6;
  tick(2 * DAY);
  assert.equal(ofType(events, 'filomenaVisit').length, 0);
  tick(DAY);
  assert.deepEqual(
    ofType(events, 'filomenaVisit').map((e) => e.day),
    [3, 3],
  );
  tick(DAY);
  assert.equal(ofType(events, 'filomenaVisit').filter((e) => e.day === 4).length, 3);
});

test('giorno 5: telefonata dopo 15 minuti, licenziato al ritiro, tempo fermo fino al pontile, poi il giorno finisce', () => {
  const { career, story, events, tick } = makeStory();
  career.wallet = 1e6;
  career.time = 4 * DAY;
  const id = career.openings[0];
  career.hire(id);
  const shop = career.pizzeria(id);
  tick(RULES.story.callAfter - 1, far);
  assert.equal(story.phase, Phase.START);
  tick(2, far);
  assert.equal(story.phase, Phase.CALL);
  const order = story.order;
  assert.equal(order.pizzeria, shop);
  assert.deepEqual(
    order.stops[0].pizzas.map((p) => p.nome),
    ['Margherita', 'Margherita'],
  );
  // Ritiro: licenziato e il giorno si ferma.
  career.update(0, at(shop.pos));
  story.update(at(shop.pos));
  assert.equal(career.status, 'unemployed');
  assert.equal(ofType(events, 'storyFired').length, 1);
  assert.equal(story.phase, Phase.PIER);
  const frozenAt = career.time;
  tick(600, far);
  assert.equal(career.time, frozenAt, 'il tempo è fermo');
  // Al pontile: la scena, poi il giorno finisce.
  tick(1, at([PIER.x, PIER.y]));
  assert.equal(story.phase, Phase.PIER_SCENE);
  assert.equal(order.pay.total, 16, 'le 2 Margherite gliele pagano');
  story.finishPier();
  tick(1, far);
  assert.equal(career.day, 6);
  assert.equal(ofType(events, 'dayEnded').at(-1).ledger.day, 5);
  assert.equal(story.phase, Phase.MET);
});

function toDay8End({ tuned }) {
  const s = makeStory();
  s.career.wallet = 1e6;
  if (tuned) s.career.tunedVespas.add({});
  s.story.phase = Phase.MET;
  s.career.time = 8 * DAY - 5;
  s.tick(10, far);
  return s;
}

test('giorno 8 senza Vespa truccata: la storia finisce', () => {
  const { career, story } = toDay8End({ tuned: false });
  assert.equal(story.phase, Phase.OVER);
  assert.equal(career.day, 9);
});

test('giorno 8 con la Vespa truccata: il giorno non finisce finché non salgono su Castel dell’Ovo', () => {
  const { career, story, events, tick } = toDay8End({ tuned: true });
  assert.equal(story.phase, Phase.CASTLE);
  assert.equal(career.day, 8);
  tick(1000, far);
  assert.equal(career.day, 8, 'il tempo è fermo');
  tick(1, at(CASTLE.meet));
  assert.equal(story.phase, Phase.CLIMB);
  tick(1, at(CASTLE.door, false));
  assert.equal(story.phase, Phase.CLIMB, 'in Vespa non si sale');
  tick(1, at(CASTLE.door, true));
  assert.equal(story.phase, Phase.TOP);
  story.finishCastle();
  assert.equal(story.phase, Phase.ENGAGED);
  assert.equal(ofType(events, 'engaged').length, 1);
  tick(2, far);
  assert.equal(career.day, 9);
});

test('dal giorno 12, da fidanzato, Gennaro apre la sua pizzeria dove vuole', () => {
  const { career, story, tick } = makeStory();
  story.phase = Phase.ENGAGED;
  career.time = 10 * DAY;
  career.wallet = 6000;
  assert.equal(story.canBuyShop, false, 'non prima del giorno 12');
  career.time = 11 * DAY;
  assert.ok(story.canBuyShop);
  assert.ok(story.buyShop('full'));
  assert.equal(career.wallet, 1000);
  const t = career.time;
  tick(300, far);
  assert.equal(career.time, t, 'il tempo si ferma mentre sceglie il posto');
  assert.equal(story.openShopAt([0, 100]), false, 'troppo vicino a una pizzeria');
  assert.ok(story.openShopAt([60000, 9000]));
  assert.equal(story.phase, Phase.OWNER);
  tick(5, far);
  assert.ok(career.time > t);
  assert.equal(career.employer, 'gennaro');
});

test('salvataggio della storia; un salvataggio vecchio salta la storia se il giorno 5 è passato', () => {
  const { career, story } = makeStory();
  story.phase = Phase.PIER_SCENE;
  story.visits = { 3: 2 };
  const copy = makeStory();
  copy.career.time = career.time;
  copy.story.restore(JSON.parse(JSON.stringify(story.serialize())));
  assert.equal(copy.story.phase, Phase.MET, 'la scena interrotta si considera fatta');
  assert.deepEqual(copy.story.visits, { 3: 2 });
  const old = makeStory();
  old.career.time = 6 * DAY;
  old.story.restore(null);
  assert.equal(old.story.phase, Phase.OVER);
});

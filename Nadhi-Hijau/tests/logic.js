const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const source = existsSync(join(__dirname, '../dist/app.js')) ? '../dist' : '..';
const { calculateDeposit, addDeposit, createState, getPeriod, normalizeState } = require(join(__dirname, source, 'app.js'));
const { SORT_ITEMS, QUIZ_QUESTIONS, makeSortRound, makeQuizRound } = require(join(__dirname, source, 'game-data.js'));
const now = Date.UTC(2026, 8, 18);
const input = {
  items: [{ waste: 'sesari', weight: 2 }, { waste: 'canang', weight: 3 }, { waste: 'daun', weight: 1 }],
  origin: 'gotong', banjar: 'sari'
};

test('Combined types count once, with distinct weights and one community bonus', () => {
  const original = createState(now);
  const { result, state } = addDeposit(original, input, now);
  assert.equal(result.grams, 6000);
  assert.equal(result.base, 62);
  assert.equal(result.bonus, 12);
  assert.equal(result.points, 74);
  assert.deepEqual(state.rows.sari.waste, { sesari: 2000, canang: 3000, daun: 1000 });
  assert.equal(state.rows.sari.origins.gotong, 6000);
  assert.equal(state.rows.sari.deposits, 1);
  assert.equal(original.rows.sari.grams, 0);
  const repeated = addDeposit(state, { ...input, origin: 'rutin' }, now).state.rows.sari;
  assert.equal(repeated.points, 136);
  assert.equal(repeated.grams, 12000);
  assert.equal(repeated.deposits, 2);
});

test('Single selections and decimal weights preserve rounding and legacy input support', () => {
  assert.equal(calculateDeposit({ waste: 'sesari', weight: 5, origin: 'rutin' }).points, 60);
  const result = calculateDeposit({ items: [{ waste: 'sesari', weight: '0,1' }, { waste: 'daun', weight: '0.1' }], origin: 'acara' });
  assert.equal(result.grams, 200);
  assert.equal(result.base, 1);
  assert.equal(result.bonus, 0);
  assert.equal(calculateDeposit({ ...input, items: [{ waste: 'canang', weight: 1000 }] }).grams, 1000000);
});

test('Empty, duplicated, unsupported and overweight selections cannot create a deposit', () => {
  const invalid = [[], [{ waste: 'daun', weight: '' }], [{ waste: 'sesari', weight: 0 }],
    [{ waste: 'canang', weight: 0.11 }], [{ waste: 'daun', weight: Infinity }],
    [{ waste: 'plastic', weight: 1 }], [{ waste: 'daun', weight: 2 }, { waste: 'daun', weight: 3 }],
    [{ waste: 'sesari', weight: 700 }, { waste: 'canang', weight: 300.1 }]];
  invalid.forEach(items => assert.throws(() => addDeposit(createState(now), { ...input, items }, now)));
  assert.throws(() => calculateDeposit({ ...input, origin: 'unknown' }));
  assert.throws(() => addDeposit(createState(now), { ...input, banjar: 'unknown' }, now));
});

test('Combined totals still reset at midnight WITA including year and leap-day boundaries', () => {
  const before = Date.UTC(2026, 11, 31, 15, 59, 59, 999);
  const after = before + 1;
  assert.equal(getPeriod(before).key, '2026-12');
  assert.equal(getPeriod(after).key, '2027-01');
  const state = addDeposit(createState(before), input, before).state;
  assert.deepEqual(normalizeState(state, after), createState(after));
  assert.equal(getPeriod(Date.UTC(2028, 1, 29, 15)).key, '2028-02');
  assert.equal(getPeriod(Date.UTC(2028, 1, 29, 16)).key, '2028-03');
});

function seededRandom() {
  let seed = 90210;
  return () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
}

test('Each sorting round has eight unique balanced cards and a changed selection on replay', () => {
  const snapshot = JSON.stringify(SORT_ITEMS);
  const seen = new Set();
  for (const rng of [seededRandom(), () => 0, () => 0.999999]) {
    let previous = [];
    for (let round = 0; round < 150; round += 1) {
      const items = makeSortRound(previous, rng);
      const ids = items.map(item => item.id);
      assert.equal(new Set(ids).size, 8);
      assert.equal(items.filter(item => item.bin === 'organik').length, 4);
      assert.equal(items.filter(item => item.bin === 'anorganik').length, 4);
      if (previous.length) {
        assert.notEqual(ids[0], previous[0]);
        assert.ok(ids.some(id => !previous.includes(id)));
      }
      ids.forEach(id => seen.add(id));
      previous = ids;
    }
  }
  assert.equal(seen.size, 24);
  assert.equal(JSON.stringify(SORT_ITEMS), snapshot);
});

test('Quiz replay changes questions and preserves the correct answer through option shuffling', () => {
  const snapshot = JSON.stringify(QUIZ_QUESTIONS);
  const seen = new Set();
  const answerPositions = new Set();
  for (const rng of [seededRandom(), () => 0, () => 0.999999]) {
    let previous = [];
    for (let round = 0; round < 150; round += 1) {
      const questions = makeQuizRound(previous, rng);
      const ids = questions.map(question => question.id);
      assert.equal(new Set(ids).size, 5);
      if (previous.length) {
        assert.notEqual(ids[0], previous[0]);
        assert.ok(ids.some(id => !previous.includes(id)));
      }
      for (const question of questions) {
        const original = QUIZ_QUESTIONS.find(item => item.id === question.id);
        assert.equal(question.answers[question.correct], original.answers[original.correct]);
        assert.deepEqual([...question.answers].sort(), [...original.answers].sort());
        seen.add(question.id);
        answerPositions.add(question.correct);
      }
      previous = ids;
    }
  }
  assert.equal(seen.size, 18);
  assert.equal(answerPositions.size, 4);
  assert.equal(JSON.stringify(QUIZ_QUESTIONS), snapshot);
});

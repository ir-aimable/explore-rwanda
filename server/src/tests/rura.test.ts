// Unit tests: RURA 2026 fare network, the place map, and location / transport question parsing (no server).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cheapestRoute, planJourney, routeStops, STOPS, UNMAPPED_STOPS, RURA_TARIFF, stopOf } from '../services/geo/rura/network.js';
import { RURA_FARES } from '../services/geo/rura/fares.data.js';
import { findPlace, placeTerms } from '../services/geo/rwanda.js';
import { parseGeoQuestion, parseIntent, buildLexicon } from '../services/ai/nlp.js';

test('RURA tariff: every route and stop is loaded and on the map', () => {
  assert.equal(RURA_TARIFF.routes, 605); assert.equal(RURA_FARES.length, 605);
  assert.deepEqual(UNMAPPED_STOPS, [], 'every stop has a place with district + province');
  assert.ok(STOPS.length >= 160);
  for (const s of STOPS) { assert.ok(s.district && s.province, s.name); assert.ok(s.lat < -1 && s.lat > -2.9 && s.lng > 28.8 && s.lng < 31, `${s.name} inside Rwanda`); }
  // Spelling variants in the source collapse to one stop
  assert.ok(!RURA_FARES.some(([a, b, v]) => [a, b, v].includes('Congo Nile') || [a, b, v].includes('Kirambo') || [a, b, v].includes('Nyanza (South)')));
});

test('RURA journeys: direct, transfers, Kigali bus parks, last mile', () => {
  assert.equal(cheapestRoute('Nyabugogo', 'Huye')?.fare, 5068);
  assert.equal(cheapestRoute('Huye', 'Nyabugogo')?.fare, 5068, 'fares are the same in both directions');
  const kinigi = planJourney({ name: 'Kigali' }, { name: 'Kinigi' })!;
  assert.deepEqual(routeStops(kinigi), ['Nyabugogo', 'Musanze', 'Kinigi']); assert.equal(kinigi.one_way, 4257); assert.equal(kinigi.official, true);
  assert.equal(planJourney({ name: 'Kigali' }, { name: 'Nyamata' })!.board.stop, 'Nyanza (Kicukiro)');
  // A small saving is not worth a change of bus: direct Nyabugogo -> Rubavu
  assert.deepEqual(routeStops(planJourney({ name: 'Kigali' }, { name: 'Lake Kivu' })!), ['Nyabugogo', 'Rubavu']);
  const remera = planJourney({ name: 'Remera' }, { name: 'Musanze' })!;
  assert.equal(remera.board.stop, 'Nyabugogo'); assert.ok(remera.board.fare > 0, 'local ride to the bus park'); assert.equal(remera.official, false);
  const nyungwe = planJourney({ name: 'Huye' }, { name: 'Nyungwe National Park' })!;
  assert.equal(nyungwe.alight.stop, 'Pindura'); assert.ok(nyungwe.alight.km > 0);
});

test('Map: stops are their own places; district towns keep their names', () => {
  assert.equal(findPlace('Kamembe')?.name, 'Kamembe'); assert.equal(findPlace('Cyangugu')?.name, 'Rusizi');
  assert.equal(findPlace('Nyabugogo')?.province, 'Kigali'); assert.equal(stopOf('Nyabugogo'), 'Nyabugogo');
  assert.equal(findPlace('Kirambo (Burera)')?.district, 'Burera'); assert.equal(findPlace('Kirambo (Nyamasheke)')?.district, 'Nyamasheke');
  assert.equal(findPlace('Rusumo Falls')?.kind, 'site'); assert.equal(findPlace('Rusumo')?.name, 'Rusumo');
});

test('Questions: where is / bus fare / how to get there (EN + RW); trip searches unaffected', () => {
  const terms = placeTerms().sort((a, b) => b.term.length - a.term.length);
  assert.deepEqual(parseGeoQuestion('where is kitabi', terms), { action: 'place_info', placeQuery: 'Kitabi' });
  assert.deepEqual(parseGeoQuestion('kitabi iherereye he', terms), { action: 'place_info', placeQuery: 'Kitabi' });
  assert.deepEqual(parseGeoQuestion('how much is the bus from kigali to huye', terms), { action: 'route_info', routeTo: 'Huye', routeFrom: 'Kigali' });
  assert.deepEqual(parseGeoQuestion('itike kuva i musanze ujya i rubavu ni angahe', terms), { action: 'route_info', routeTo: 'Rubavu', routeFrom: 'Musanze' });
  assert.deepEqual(parseGeoQuestion('nagera ate i nyamata', terms), { action: 'route_info', routeTo: 'Nyamata', routeFrom: undefined });
  assert.deepEqual(parseGeoQuestion('how far is huye from kigali', terms), { action: 'route_info', routeTo: 'Huye', routeFrom: 'Kigali' });
  assert.equal(parseGeoQuestion('hiking trips from kigali to musanze', terms), undefined, 'a trip search stays a search');
  const lex = buildLexicon([{ slug: 'hiking', name_en: 'Hiking', name_rw: 'Gutembera' }], [], []);
  const save = parseIntent('I want to save money on a hike', lex);
  assert.equal(save.location, undefined, '"save" is not the town of Save in a search'); assert.equal(save.action, 'search');
});

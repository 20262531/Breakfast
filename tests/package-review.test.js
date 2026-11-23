import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewBatch, minimizePackageComment, hasConditionalPackageComment, sameRateEvidence, validateReviewBatch, validatedSuggestions } from '../package-review.js';
import { reviewWithOpenAI } from '../openai-package-review.js';
import { createBreakfastServer } from '../server.js';

const entry = { id: 0, locked: false, signals: [{ source: 'Reservation', text: 'breakfast included' }] };

test('minimization retains package terms and drops names, contact details and real room numbers', () => {
  assert.equal(minimizePackageComment('Alice Jackson alice@example.com 1107 2RB / breakfast included'), '… . … rb / breakfast included');
  assert.equal(minimizePackageComment('Alice Jackson 1107'), '');
  assert.equal(hasConditionalPackageComment('Requested RB for next stay'), true);
  assert.equal(hasConditionalPackageComment('no RB; RO'), true);
  assert.equal(hasConditionalPackageComment('RB confirmed'), false);
  assert.equal(validateReviewBatch([entry]), true);
  assert.equal(validateReviewBatch([{ ...entry, signals: [{ source: 'General', text: 'breakfast Alice 1107' }] }]), false);
});

test('only confirmed rooms from the same report support the rate comparison', () => {
  const rooms = {
    1101: { room: '1101', rates: ['J-TRVBB*'], pkg: 'REVIEW', evidence: [], issues: [], packageComments: [] },
    1102: { room: '1102', rates: ['J-TRVBB*'], pkg: 'RB' },
    5101: { room: '5101', rates: ['J-TRVBB*'], pkg: 'RO' }
  };
  const report = { source: 'RDL', records: [
    { room: '1101', rate: 'J-TRVBB*', evidence: [] },
    { room: '1102', rate: 'J-TRVBB*', evidence: [{ pkg: 'RB' }] },
    { room: '1102', rate: 'J-TRVBB*', evidence: [{ pkg: 'RB' }] }
  ] };
  const other = { source: 'LRR', records: [{ room: '5101', rate: 'J-TRVBB*', evidence: [{ pkg: 'RO' }] }] };
  const comparison = sameRateEvidence(rooms, [report, other]);
  assert.deepEqual(comparison.get('1101'), [{ rate: 'J-TRVBB*', counts: { RO: 0, RB: 1 } }]);
  assert.deepEqual(buildReviewBatch(rooms, comparison).entries, []);
  rooms[1101].packageComments.push({ kind: 'General', text: 'breakfast included' });
  const batch = buildReviewBatch(rooms, comparison);
  assert.equal(JSON.stringify(batch.entries).includes('1101'), false);
  assert.equal(JSON.stringify(batch.entries).includes('J-TRVBB'), false);
  assert.equal(validatedSuggestions(batch.entries, [{ id: 0, pkg: 'RB', evidence: 1 }]).size, 0);
});

test('rejects fabricated citations, duplicate results and suggestions for locked rooms', () => {
  const answer = { id: 0, pkg: 'RB', evidence: 0 };
  assert.equal(validatedSuggestions([entry], [answer]).get(0).pkg, 'RB');
  assert.equal(validatedSuggestions([entry], [{ ...answer, evidence: 5 }]).size, 0);
  assert.equal(validatedSuggestions([entry], [answer, answer]).size, 0);
  assert.equal(validatedSuggestions([{ ...entry, locked: true }], [answer]).size, 0);
  assert.equal(validatedSuggestions([entry], [{ ...answer, pkg: 'REVIEW' }]).size, 0);
});

test('OpenAI wrapper uses Responses structured output and validates model results', async () => {
  const results = [{ id: 0, pkg: 'RB', evidence: 0 }, { id: 3, pkg: 'RO', evidence: 0 }];
  const response = await reviewWithOpenAI([entry], { apiKey: 'test-key', model: 'gpt-5-mini', fetchResponse: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.deepEqual(JSON.parse(body.input), [entry]);
    return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ results }) }] }] });
  } });
  assert.deepEqual(response, [results[0]]);
});

test('loopback server serves assets and accepts only same-origin, minimized JSON requests', async t => {
  const server = createBreakfastServer({ apiKey: 'test-key', review: async entries => {
    assert.deepEqual(entries, [entry]);
    return [{ id: 0, pkg: 'RB', evidence: 0 }];
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const origin = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(origin)).status, 200);
  assert.equal((await fetch(origin + '/package-review.js')).status, 200);
  assert.equal((await fetch(origin + '/.env')).status, 404);
  const request = (requestOrigin, entries) => fetch(origin + '/api/package-review', {
    method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ entries })
  });
  assert.equal((await request('https://example.com', [entry])).status, 403);
  assert.equal((await request(origin, [{ ...entry, signals: [{ source: 'Reservation', text: 'Alice, breakfast included' }] }])).status, 400);
  const response = await request(origin, [entry]);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { results: [{ id: 0, pkg: 'RB', evidence: 0 }] });
});

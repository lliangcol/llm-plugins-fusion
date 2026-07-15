import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const fixture = readJson('tests/fixtures/review-route-stability.json');
const behaviorV1 = readJson('workflow-specs/behaviors.json');
const behaviorV2 = readJson('workflow-specs/behaviors.v2.json');
const workflows = readJson('workflow-specs/workflows.v6.json');
const routeV1 = behaviorV1.behaviors.find((entry) => entry.id === 'route');
const routeV2 = behaviorV2.behaviors.find((entry) => entry.id === 'route');
const workflowById = new Map(workflows.workflows.map((entry) => [entry.id, entry]));
const boundaryRoute = new Map([
  ['findings-only', 'review-only'],
  ['general', 'review'],
  ['lite', 'review-lite'],
  ['strict', 'review-strict'],
]);

test('review route paraphrases cover every boundary in English Chinese and bilingual form', () => {
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.cases.length, 12);
  for (const route of boundaryRoute.values()) {
    const cases = fixture.cases.filter((entry) => entry.expectedRoute === route);
    assert.deepEqual(cases.map((entry) => entry.language).sort(), ['bilingual', 'en', 'zh']);
  }
  for (const entry of fixture.cases) {
    assert.equal(entry.expectedRoute, boundaryRoute.get(entry.boundary), `${entry.id}: boundary route drift`);
    assert.deepEqual(entry.expectedRequiredInputs, workflowById.get(entry.expectedRoute).compatibilityProjection.requiredInputs, `${entry.id}: required input drift`);
  }
});

test('source behavior gives findings-only review precedence over the general review hub', () => {
  const routes = routeV1.decisionTable.map((entry) => entry.route);
  const reviewOrder = ['review-strict', 'review-lite', 'review-only', 'review'];
  assert.deepEqual(routes.filter((route) => reviewOrder.includes(route)), reviewOrder);
  const reviewOnly = routeV1.decisionTable.find((entry) => entry.route === 'review-only');
  const review = routeV1.decisionTable.find((entry) => entry.route === 'review');
  assert.match(reviewOnly.when, /read-only or findings-only review/iu);
  assert.match(reviewOnly.when, /prohibits implementation or modification/iu);
  assert.match(reviewOnly.when, /severity grouping is not required/iu);
  assert.match(review.when, /does not specify a read-only, findings-only, no-change/iu);
  assert.ok(routeV1.invariants.some((entry) => /complete ordered set/iu.test(entry) && /never emit only unresolved inputs/iu.test(entry)));
});

test('review route source projects exactly into runtime and assistant surfaces', () => {
  const runtime = readJson('nova-plugin/runtime/contracts/route.json');
  assert.deepEqual(routeV2.decisionTable, routeV1.decisionTable.map(({ when, predicate, ...entry }) => ({
    ...entry,
    when: predicate ?? { op: 'semantic-condition', condition: when },
  })));
  assert.deepEqual(runtime.behaviorContract.decisionTable, routeV2.decisionTable);
  assert.deepEqual(runtime.behaviorContract.invariants, routeV2.invariants);
  const adapter = readFileSync(resolve(root, 'adapters/codex/AGENTS.md'), 'utf8');
  for (const route of ['review-only', 'review']) {
    const decision = routeV2.decisionTable.find((entry) => entry.route === route);
    assert.ok(adapter.includes(JSON.stringify(decision.when)), `${route}: Codex adapter decision drift`);
  }
  assert.match(adapter, /complete ordered set[\s\S]*never return only unresolved inputs/iu);
  const skill = readFileSync(resolve(root, 'nova-plugin/skills/nova-route/SKILL.md'), 'utf8');
  assert.match(skill, /complete ordered required-input set[\s\S]*never list only unresolved inputs/iu);
  assert.match(skill, /Prefer `review-only` whenever[\s\S]*Use the broader `review` hub only/iu);
});

test('stability fixture is independent from critical live prompts and production sources do not branch on case ids', () => {
  const critical = readJson('evals/critical-live/cases.json');
  const criticalRequests = new Set(critical.cases.map((entry) => entry.request.trim().toLowerCase()));
  for (const entry of fixture.cases) assert.equal(criticalRequests.has(entry.request.trim().toLowerCase()), false, `${entry.id}: copied critical request`);
  const criticalIds = critical.cases.map((entry) => entry.id);
  for (const path of ['workflow-specs/behaviors.json', 'scripts/generate-adapters.mjs', 'scripts/run-live-assistant-evals.mjs', 'nova-plugin/skills/nova-route/SKILL.md']) {
    const source = readFileSync(resolve(root, path), 'utf8');
    for (const id of criticalIds) assert.equal(source.includes(id), false, `${path}: branches on ${id}`);
  }
});

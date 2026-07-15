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
const boundaryVariant = new Map([
  ['findings-only', { LEVEL: 'standard', MODE: 'findings-only' }],
  ['general', {}],
  ['lite', { LEVEL: 'lite' }],
  ['strict', { LEVEL: 'strict' }],
]);

test('review route paraphrases cover every boundary in English Chinese and bilingual form', () => {
  assert.equal(fixture.schemaVersion, 2);
  assert.equal(fixture.cases.length, 12);
  for (const boundary of boundaryVariant.keys()) {
    const cases = fixture.cases.filter((entry) => entry.boundary === boundary);
    assert.deepEqual(cases.map((entry) => entry.language).sort(), ['bilingual', 'en', 'zh']);
  }
  for (const entry of fixture.cases) {
    assert.equal(entry.expectedRoute, 'review', `${entry.id}: route must remain canonical review`);
    assert.deepEqual(entry.expectedVariantParameters, boundaryVariant.get(entry.boundary), `${entry.id}: boundary variant drift`);
    assert.deepEqual(entry.expectedRequiredInputs, workflowById.get(entry.expectedRoute).compatibilityProjection.requiredInputs, `${entry.id}: required input drift`);
  }
});

test('source behavior gives findings-only review precedence over the general review hub', () => {
  const reviewDecisions = routeV1.decisionTable.filter((entry) => entry.route === 'review');
  const findingsOnly = reviewDecisions.find((entry) => entry.variantParameters?.MODE === 'findings-only');
  const general = reviewDecisions.find((entry) => Object.keys(entry.variantParameters).length === 0);
  assert.ok(routeV1.decisionTable.indexOf(findingsOnly) < routeV1.decisionTable.indexOf(general));
  assert.match(findingsOnly.when, /read-only or findings-only review/iu);
  assert.match(findingsOnly.when, /prohibits implementation or modification/iu);
  assert.match(findingsOnly.when, /severity grouping is not required/iu);
  assert.deepEqual(findingsOnly.variantParameters, { LEVEL: 'standard', MODE: 'findings-only' });
  assert.match(general.when, /does not specify a read-only, findings-only, no-change/iu);
  assert.ok(routeV1.decisionTable.every((entry) => workflowById.get(entry.route)?.compatibilityAlias === false));
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
  for (const variant of [{ LEVEL: 'standard', MODE: 'findings-only' }, {}]) {
    const decision = routeV2.decisionTable.find((entry) => entry.route === 'review' && JSON.stringify(entry.variantParameters) === JSON.stringify(variant));
    assert.ok(adapter.includes(JSON.stringify(decision.when)), `${JSON.stringify(variant)}: Codex adapter decision drift`);
    assert.ok(adapter.includes(JSON.stringify(variant)), `${JSON.stringify(variant)}: Codex adapter variant drift`);
  }
  assert.match(adapter, /complete ordered set[\s\S]*never return only unresolved inputs/iu);
  const skill = readFileSync(resolve(root, 'nova-plugin/skills/nova-route/SKILL.md'), 'utf8');
  assert.match(skill, /complete ordered required-input set[\s\S]*never list only unresolved inputs/iu);
  assert.match(skill, /select canonical `review`[\s\S]*MODE[\s\S]*findings-only/iu);
  const alias = readFileSync(resolve(root, 'nova-plugin/commands/review-only.md'), 'utf8');
  assert.match(alias, /disable-model-invocation: true/iu);
  assert.match(alias, /"LEVEL":"standard","MODE":"findings-only"/u);
});

test('stability fixture is independent from critical live prompts and production sources do not branch on case ids', () => {
  const critical = readJson('evals/critical-live/v5/cases.json');
  const criticalRequests = new Set(critical.cases.map((entry) => entry.request.trim().toLowerCase()));
  for (const entry of fixture.cases) assert.equal(criticalRequests.has(entry.request.trim().toLowerCase()), false, `${entry.id}: copied critical request`);
  const criticalIds = critical.cases.map((entry) => entry.id);
  for (const path of ['workflow-specs/behaviors.json', 'scripts/generate-adapters.mjs', 'scripts/run-live-assistant-evals.mjs', 'nova-plugin/skills/nova-route/SKILL.md']) {
    const source = readFileSync(resolve(root, path), 'utf8');
    for (const id of criticalIds) assert.equal(source.includes(id), false, `${path}: branches on ${id}`);
  }
});

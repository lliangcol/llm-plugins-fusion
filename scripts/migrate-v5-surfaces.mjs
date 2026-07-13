#!/usr/bin/env node
/** One-way 4.0 migration from one-skill-per-workflow to six canonical skills. */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const path = resolve(root, 'workflow-specs/workflows.json');
const behaviorsPath = resolve(root, 'workflow-specs/behaviors.json');
const mapping = Object.freeze({
  'backend-plan': ['produce-plan', { PLAN_PROFILE: 'java-backend' }],
  'codex-review-fix': ['implement-plan', { EXECUTION_PROFILE: 'codex-review-fix' }],
  'codex-review-only': ['review', { REVIEW_PROFILE: 'codex-review-only' }],
  'codex-verify-only': ['review', { REVIEW_PROFILE: 'codex-verify-only' }],
  explore: ['explore', {}],
  'explore-lite': ['explore', { PERSPECTIVE: 'observer', DEPTH: 'lite' }],
  'explore-review': ['explore', { PERSPECTIVE: 'reviewer' }],
  'finalize-lite': ['finalize-work', { DEPTH: 'lite' }],
  'finalize-work': ['finalize-work', {}],
  'implement-lite': ['implement-plan', { EXECUTION_PROFILE: 'lite' }],
  'implement-plan': ['implement-plan', {}],
  'implement-standard': ['implement-plan', { EXECUTION_PROFILE: 'standard' }],
  'plan-lite': ['produce-plan', { PLAN_PROFILE: 'lite' }],
  'plan-review': ['review', { REVIEW_PROFILE: 'plan' }],
  'produce-plan': ['produce-plan', {}],
  review: ['review', {}],
  'review-lite': ['review', { LEVEL: 'lite' }],
  'review-only': ['review', { LEVEL: 'standard' }],
  'review-strict': ['review', { LEVEL: 'strict' }],
  route: ['route', {}],
  'senior-explore': ['explore', { DEPTH: 'deep' }],
});
const canonicalPolicy = Object.freeze({
  explore: { permissionProfile: 'read-only', risk: 'none' },
  review: { permissionProfile: 'read-only', risk: 'none' },
  'implement-plan': { permissionProfile: 'implementation', risk: 'medium' },
});

export function migrate(spec) {
  return {
    ...spec,
    schemaVersion: 5,
    contractVersions: { workflow: '5.0.0', runtime: '3.0.0', adapter: '2.0.0' },
    workflows: spec.workflows.map((workflow) => {
      const mapped = mapping[workflow.id];
      if (!mapped) throw new Error(`missing v5 surface mapping for ${workflow.id}`);
      const [canonicalSurfaceId, variantPreset] = mapped;
      const policy = canonicalSurfaceId === workflow.id ? (canonicalPolicy[workflow.id] ?? {}) : {};
      return {
        ...workflow,
        ...policy,
        canonicalSurfaceId,
        variantPreset,
        compatibilityAlias: canonicalSurfaceId !== workflow.id,
        contractPath: `skills/nova-${canonicalSurfaceId}/SKILL.md`,
      };
    }),
  };
}

export function migrateBehaviors(spec) {
  return {
    ...spec,
    behaviors: spec.behaviors.map((behavior) => behavior.id !== 'route' ? behavior : {
      ...behavior,
      invariants: behavior.invariants.map((value) => value.replace('commands, skills, agents, and packs', 'canonical skills, compatibility command aliases, agents, and packs')),
      output: {
        ...behavior.output,
        fields: [
          { name: 'Canonical skill', required: true, description: 'One of the six canonical 4.0 skills.' },
          { name: 'Command alias (optional)', required: true, description: 'Existing generated compatibility wrapper or None.' },
          { name: 'Variant parameters', required: true, description: 'Exact preset parameters for the selected internal workflow.' },
          ...behavior.output.fields.filter((field) => !['Command', 'Skill', 'Canonical skill', 'Command alias (optional)', 'Variant parameters'].includes(field.name)),
        ],
        order: ['Canonical skill', 'Command alias (optional)', 'Variant parameters', ...behavior.output.order.filter((field) => !['Command', 'Skill', 'Canonical skill', 'Command alias (optional)', 'Variant parameters'].includes(field))],
      },
      validation: behavior.validation.map((value) => value.replace('commands and skills exist one-to-one', 'the canonical skill, compatibility alias, and preset exist in the generated catalog')),
    }),
  };
}

export function main(args = process.argv.slice(2)) {
  try {
    if (args.length !== 1 || args[0] !== '--write') throw new Error('Usage: node scripts/migrate-v5-surfaces.mjs --write');
    const migrated = migrate(JSON.parse(readFileSync(path, 'utf8')));
    writeFileSync(path, `${JSON.stringify(migrated, null, 2)}\n`, 'utf8');
    const migratedBehaviors = migrateBehaviors(JSON.parse(readFileSync(behaviorsPath, 'utf8')));
    writeFileSync(behaviorsPath, `${JSON.stringify(migratedBehaviors, null, 2)}\n`, 'utf8');
    console.log('Migrated workflow surfaces to schema v5');
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();

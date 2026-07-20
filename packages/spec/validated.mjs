import { dirname } from 'node:path';
import { validateProductProtocolCoherence } from '../../framework/core/protocol-coherence.mjs';
import { ownRecordValue } from '../../framework/core/own-record.mjs';
import { buildVariantResolutionIndex, resolveVariantWorkflow } from '../../framework/core/variant-contracts.mjs';
import { validateContractCoherence } from '../../framework/migrate/contract-coherence.mjs';
import { migrateBehaviorSpec, migrateWorkflowSpec } from '../../framework/migrate/v6.mjs';
import { defaultLayout, readJson, resolveContainedFile } from './internal.mjs';

export const SPEC_ERROR = Object.freeze({
  CONFIGURATION: 'SPEC_VALIDATOR_REQUIRED',
  LAYOUT: 'SPEC_LAYOUT_INVALID',
  SCHEMA: 'SPEC_SCHEMA_INVALID',
  INVARIANT: 'SPEC_INVARIANT_INVALID',
});

/** @typedef {{ code?: string, domain?: string, details?: unknown[], cause?: unknown }} SpecBundleErrorOptions */

export class SpecBundleError extends Error {
  /** @param {string} message @param {SpecBundleErrorOptions} [options] */
  constructor(message, { code, domain, details = [], cause } = {}) {
    super(message, { cause });
    this.name = 'SpecBundleError';
    this.code = code;
    this.domain = domain;
    this.details = details;
  }
}

/** @param {unknown} result @returns {unknown[]} */
function validationDetails(result) {
  if (result === true) return [];
  if (result === false) return ['validator returned false'];
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object') {
    const record = /** @type {{ valid?: boolean, errors?: unknown[], then?: unknown }} */ (result);
    if (typeof record.then === 'function') return ['validator returned an asynchronous result'];
    if (record.valid === true) {
      if (record.errors === undefined || (Array.isArray(record.errors) && record.errors.length === 0)) return [];
      return Array.isArray(record.errors) ? record.errors : ['validator returned valid=true with invalid errors'];
    }
    if (record.valid === false) return record.errors?.length ? record.errors : ['validator returned valid=false'];
    return ['validator returned an unsupported object result'];
  }
  return [`validator returned an unsupported ${result === null ? 'null' : typeof result} result`];
}

const COMPATIBILITY_ALIAS_REMOVAL_GATES = Object.freeze([
  'real-benchmark-evidence',
  'native-permission-and-invocation-parity',
  'plugin-major-release',
  'governed-release-decision',
  'migration-documentation',
]);
const PATH_LIKE_INPUT_TYPES = new Set(['path', 'artifact-reference', 'review-reference']);
const PORTABLE_IDENTITY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const INPUT_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

function invalidInventoryValues(values, predicate) {
  return values.filter((value) => typeof value !== 'string' || !predicate(value));
}

function describeValues(values) {
  return values.map((value) => JSON.stringify(value) ?? String(value)).join(', ');
}

function predicateNodes(predicate, nodes = []) {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) return nodes;
  nodes.push(predicate);
  if (Array.isArray(predicate.args)) for (const child of predicate.args) predicateNodes(child, nodes);
  if (predicate.arg) predicateNodes(predicate.arg, nodes);
  return nodes;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/** @param {{ framework: any, product: any, workflows: any, behaviors: any, adapters: any[], provenance?: { workflowSource: string, behaviorSource: string } }} bundle @returns {string[]} */
function validateInvariants(bundle) {
  const failures = validateContractCoherence(bundle.workflows, bundle.behaviors);
  const workflows = Array.isArray(bundle.workflows?.workflows) ? bundle.workflows.workflows : [];
  const behaviors = Array.isArray(bundle.behaviors?.behaviors) ? bundle.behaviors.behaviors : [];
  const workflowIds = workflows.map((entry) => entry.id);
  const behaviorIdList = behaviors.map((entry) => entry.id);
  const behaviorIds = new Set(behaviorIdList);
  const behaviorById = new Map(behaviors.map((entry) => [entry.id, entry]));
  const duplicateWorkflows = workflowIds.filter((id, index) => workflowIds.indexOf(id) !== index);
  if (duplicateWorkflows.length > 0) failures.push(`duplicate workflow ids: ${[...new Set(duplicateWorkflows)].sort().join(', ')}`);
  const duplicateBehaviors = behaviorIdList.filter((id, index) => behaviorIdList.indexOf(id) !== index);
  if (duplicateBehaviors.length > 0) failures.push(`duplicate behavior ids: ${[...new Set(duplicateBehaviors)].sort().join(', ')}`);
  const missingBehaviors = [...new Set(workflowIds.filter((id) => !behaviorIds.has(id)))].sort();
  if (missingBehaviors.length > 0) failures.push(`workflows missing behaviors: ${missingBehaviors.join(', ')}`);
  const workflowIdSet = new Set(workflowIds);
  const workflowById = new Map(workflows.map((entry) => [entry.id, entry]));
  const orphanBehaviors = [...new Set(behaviorIdList.filter((id) => !workflowIdSet.has(id)))].sort();
  if (orphanBehaviors.length > 0) failures.push(`behaviors without workflows: ${orphanBehaviors.join(', ')}`);
  if (typeof bundle.product?.expectedWorkflowCount === 'number' && workflowIds.length !== bundle.product.expectedWorkflowCount) {
    failures.push('loaded workflow count does not match product.expectedWorkflowCount');
  }
  if (Array.isArray(bundle.product?.primaryEntrypoints)) {
    const unknownEntrypoints = bundle.product.primaryEntrypoints.filter((id) => !workflowIdSet.has(id)).sort();
    if (unknownEntrypoints.length > 0) failures.push(`unknown primary entrypoints: ${unknownEntrypoints.join(', ')}`);
  }
  const canonicalWorkflowIds = workflows.filter((workflow) => !workflow.compatibilityAlias).map((workflow) => workflow.id).sort();
  if (workflows.some((workflow) => workflow.compatibilityAlias === true)) {
    const policy = bundle.product?.compatibilityAliasPolicy;
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
      failures.push('products with compatibility aliases must declare compatibilityAliasPolicy');
    } else {
      if (policy.status !== 'evidence-gated') {
        failures.push('compatibilityAliasPolicy.status must be evidence-gated');
      }
      const removalRequires = Array.isArray(policy.removalRequires)
        ? [...policy.removalRequires].sort()
        : null;
      if (removalRequires === null
        || JSON.stringify(removalRequires) !== JSON.stringify([...COMPATIBILITY_ALIAS_REMOVAL_GATES].sort())) {
        failures.push('compatibilityAliasPolicy.removalRequires must declare the complete adapter-neutral retirement gates');
      }
    }
  }
  const automaticTargets = bundle.product?.automaticRouting?.canonicalTargets;
  if (!Array.isArray(automaticTargets)) failures.push('product.automaticRouting.canonicalTargets must be an array');
  else if (JSON.stringify([...automaticTargets].sort()) !== JSON.stringify(canonicalWorkflowIds)) {
    failures.push('automatic routing targets must equal the canonical workflow inventory');
  }
  const automaticTargetSet = new Set(automaticTargets ?? []);
  if (Array.isArray(bundle.product?.stages)) {
    const unknownStages = [...new Set(workflows.map((workflow) => workflow.stage).filter((stage) => !bundle.product.stages.includes(stage)))].sort();
    if (unknownStages.length > 0) failures.push(`workflows use unknown product stages: ${unknownStages.join(', ')}`);
  }
  const productAgentsList = Array.isArray(bundle.product?.agents) ? bundle.product.agents : [];
  const productPacksList = Array.isArray(bundle.product?.packs) ? bundle.product.packs : [];
  const productToolsList = Array.isArray(bundle.product?.tools) ? bundle.product.tools : [];
  if (!Array.isArray(bundle.product?.agents)) failures.push('product.agents must be an array');
  else {
    if (productAgentsList.length === 0) failures.push('product.agents must contain at least one portable identity');
    const invalidAgents = invalidInventoryValues(productAgentsList, (value) => PORTABLE_IDENTITY_PATTERN.test(value));
    if (invalidAgents.length > 0) failures.push(`product.agents contains invalid portable identities: ${describeValues(invalidAgents)}`);
  }
  if (!Array.isArray(bundle.product?.packs)) failures.push('product.packs must be an array');
  else {
    const invalidPacks = invalidInventoryValues(productPacksList, (value) => PORTABLE_IDENTITY_PATTERN.test(value));
    if (invalidPacks.length > 0) failures.push(`product.packs contains invalid portable identities: ${describeValues(invalidPacks)}`);
  }
  if (!Array.isArray(bundle.product?.tools)) failures.push('product.tools must be an array');
  else {
    if (productToolsList.length === 0) failures.push('product.tools must contain at least one non-empty identity');
    const invalidTools = invalidInventoryValues(productToolsList, (value) => value.trim().length > 0);
    if (invalidTools.length > 0) failures.push(`product.tools contains empty identities: ${describeValues(invalidTools)}`);
  }
  const productTools = new Set(productToolsList);
  const permissionProfiles = bundle.workflows?.permissionProfiles;
  if (permissionProfiles && typeof permissionProfiles === 'object' && !Array.isArray(permissionProfiles)) {
    for (const [profileId, profile] of Object.entries(permissionProfiles)) {
      const allowedTools = Array.isArray(profile?.allowedTools) ? profile.allowedTools : [];
      const disallowedTools = Array.isArray(profile?.disallowedTools) ? profile.disallowedTools : [];
      if (!Array.isArray(profile?.allowedTools)) failures.push(`permission profile ${profileId} allowedTools must be an array`);
      if (!Array.isArray(profile?.disallowedTools)) failures.push(`permission profile ${profileId} disallowedTools must be an array`);
      const unknownAllowed = [...new Set(allowedTools.filter((tool) => !productTools.has(tool)))].sort();
      if (unknownAllowed.length > 0) failures.push(`permission profile ${profileId} has unknown allowed product tools: ${unknownAllowed.join(', ')}`);
      const unknownDisallowed = [...new Set(disallowedTools.filter((tool) => !productTools.has(tool)))].sort();
      if (unknownDisallowed.length > 0) failures.push(`permission profile ${profileId} has unknown disallowed product tools: ${unknownDisallowed.join(', ')}`);
      const disallowedToolSet = new Set(disallowedTools);
      const overlap = [...new Set(allowedTools.filter((tool) => disallowedToolSet.has(tool)))].sort();
      if (overlap.length > 0) failures.push(`permission profile ${profileId} has overlapping allowed and disallowed tools: ${overlap.join(', ')}`);
    }
  }
  const productAgents = new Set(productAgentsList);
  const productPacks = new Set(productPacksList);
  for (const workflow of workflows) {
    if (!ownRecordValue(bundle.workflows?.permissionProfiles, workflow.permissionProfile)) {
      failures.push(`${workflow.id}: unknown permission profile ${workflow.permissionProfile}`);
    }
    if (!Array.isArray(workflow.ownerAgents)) failures.push(`${workflow.id}: ownerAgents must be an array`);
    else {
      if (workflow.ownerAgents.length === 0) failures.push(`${workflow.id}: ownerAgents must contain at least one portable identity`);
      const invalidAgents = invalidInventoryValues(workflow.ownerAgents, (value) => PORTABLE_IDENTITY_PATTERN.test(value));
      if (invalidAgents.length > 0) failures.push(`${workflow.id}: ownerAgents contains invalid portable identities: ${describeValues(invalidAgents)}`);
      const unknownAgents = [...new Set(workflow.ownerAgents.filter((agent) => !productAgents.has(agent)))].sort();
      if (unknownAgents.length > 0) failures.push(`${workflow.id}: unknown product owner agents: ${unknownAgents.join(', ')}`);
    }
    if (!Array.isArray(workflow.recommendedPacks)) failures.push(`${workflow.id}: recommendedPacks must be an array`);
    else {
      const invalidPacks = invalidInventoryValues(workflow.recommendedPacks, (value) => PORTABLE_IDENTITY_PATTERN.test(value));
      if (invalidPacks.length > 0) failures.push(`${workflow.id}: recommendedPacks contains invalid portable identities: ${describeValues(invalidPacks)}`);
      const unknownPacks = [...new Set(workflow.recommendedPacks.filter((pack) => !productPacks.has(pack)))].sort();
      if (unknownPacks.length > 0) failures.push(`${workflow.id}: unknown product recommended packs: ${unknownPacks.join(', ')}`);
    }
    if (!Array.isArray(workflow.requiredInputs)) failures.push(`${workflow.id}: requiredInputs must be an array`);
    else {
      const invalidInputs = invalidInventoryValues(workflow.requiredInputs, (value) => INPUT_NAME_PATTERN.test(value));
      if (invalidInputs.length > 0) failures.push(`${workflow.id}: requiredInputs contains invalid input identities: ${describeValues(invalidInputs)}`);
    }
    const projectedInputs = workflow.compatibilityProjection?.requiredInputs;
    if (projectedInputs !== undefined) {
      if (!Array.isArray(projectedInputs)) failures.push(`${workflow.id}: compatibilityProjection.requiredInputs must be an array`);
      else {
        const invalidProjectedInputs = invalidInventoryValues(projectedInputs, (value) => INPUT_NAME_PATTERN.test(value));
        if (invalidProjectedInputs.length > 0) failures.push(`${workflow.id}: compatibilityProjection.requiredInputs contains invalid input identities: ${describeValues(invalidProjectedInputs)}`);
      }
    }
    const behavior = behaviorById.get(workflow.id);
    if (!behavior || !Array.isArray(behavior.inputs)) continue;
    const canonicalBehavior = behaviorById.get(workflow.canonicalSurfaceId);
    const canonicalInputs = new Map((canonicalBehavior?.inputs ?? []).map((input) => [input.name, input]));
    for (const [name, value] of Object.entries(workflow.variantPreset ?? {})) {
      const input = canonicalInputs.get(name);
      if (!input) failures.push(`${workflow.id}: variant preset ${name} is not a canonical ${workflow.canonicalSurfaceId} input`);
      else if (Array.isArray(input.exactValues) && !input.exactValues.some((allowed) => Object.is(allowed, value))) failures.push(`${workflow.id}: variant preset ${name} has unsupported value ${JSON.stringify(value)}`);
    }
  }
  for (const behavior of behaviors) {
    const inputByName = new Map((behavior.inputs ?? []).map((input) => [input.name, input]));
    const inputNames = new Set(inputByName.keys());
    for (const [index, decision] of (behavior.decisionTable ?? []).entries()) {
      const predicate = decision.predicate ?? (typeof decision.when === 'object' ? decision.when : null);
      const nodes = predicateNodes(predicate);
      const unknownInputs = [...new Set(nodes
        .map((node) => node.input)
        .filter((input) => typeof input === 'string' && !inputNames.has(input)))].sort();
      if (unknownInputs.length > 0) failures.push(`${behavior.id}: decision ${index} predicates reference unknown inputs: ${unknownInputs.join(', ')}`);
      for (const node of nodes) {
        if (!['path-readable', 'path-writable'].includes(node.op) || !inputNames.has(node.input)) continue;
        const input = inputByName.get(node.input);
        if (!PATH_LIKE_INPUT_TYPES.has(input?.type)) {
          failures.push(`${behavior.id}: decision ${index} ${node.op} input ${node.input} must be path-like`);
          continue;
        }
        const permission = node.op === 'path-readable' ? 'readable' : 'writable';
        if (input.pathPolicy?.[permission] !== true) {
          failures.push(`${behavior.id}: decision ${index} ${node.op} input ${node.input} pathPolicy.${permission} must be true`);
        }
      }
      if (!decision.route) continue;
      const target = workflowById.get(decision.route);
      if (!target) failures.push(`${behavior.id}: decision ${index} routes to unknown workflow ${decision.route}`);
      else if (target.compatibilityAlias) failures.push(`${behavior.id}: decision ${index} routes to compatibility alias ${decision.route}`);
      else if (!automaticTargetSet.has(decision.route)) failures.push(`${behavior.id}: decision ${index} route ${decision.route} is not automatic-routing eligible`);
      if (!decision.variantParameters || typeof decision.variantParameters !== 'object' || Array.isArray(decision.variantParameters)) {
        failures.push(`${behavior.id}: decision ${index} lacks structured variantParameters`);
      } else if (target && !target.compatibilityAlias) {
        try {
          const resolved = resolveVariantWorkflow(
            workflows,
            bundle.behaviors,
            decision.route,
            decision.variantParameters,
          );
          if (resolved.workflow.canonicalSurfaceId !== decision.route) {
            failures.push(`${behavior.id}: decision ${index} variant parameters resolve outside canonical route ${decision.route}`);
          }
        } catch (error) {
          failures.push(`${behavior.id}: decision ${index} variant parameters do not resolve: ${errorMessage(error)}`);
        }
      }
    }
  }
  try {
    buildVariantResolutionIndex(workflows, bundle.behaviors);
  } catch (error) {
    failures.push(`variant resolution is invalid: ${errorMessage(error)}`);
  }
  if (bundle.workflows?.schemaVersion === 5 && bundle.behaviors?.schemaVersion === 1) {
    try {
      migrateWorkflowSpec(bundle.workflows, bundle.behaviors);
    } catch (error) {
      failures.push(`Contract v5 workflow migration is not ready: ${errorMessage(error)}`);
    }
    try {
      migrateBehaviorSpec(bundle.behaviors);
    } catch (error) {
      failures.push(`Contract v1 behavior migration is not ready: ${errorMessage(error)}`);
    }
  }
  if (!Array.isArray(bundle.product?.adapterDefinitions)) failures.push('product.adapterDefinitions must be an array');
  else if (bundle.product.adapterDefinitions.length !== bundle.adapters.length) failures.push('loaded adapter count does not match product.adapterDefinitions');
  const adapterIds = bundle.adapters.map((adapter) => adapter?.id);
  const duplicateAdapters = adapterIds.filter((id, index) => adapterIds.indexOf(id) !== index);
  if (duplicateAdapters.length > 0) failures.push(`duplicate adapter ids: ${[...new Set(duplicateAdapters)].sort().join(', ')}`);
  failures.push(...validateProductProtocolCoherence(bundle));
  return failures;
}

/**
 * @param {unknown} value
 * @param {string} domain
 * @param {(value: unknown, domain: string) => unknown} validateSchema
 */
function validateDomain(value, domain, validateSchema) {
  try {
    const details = validationDetails(validateSchema(value, domain));
    if (details.length > 0) {
      throw new SpecBundleError(`schema validation failed for ${domain}`, {
        code: SPEC_ERROR.SCHEMA,
        domain,
        details,
      });
    }
  } catch (cause) {
    if (cause instanceof SpecBundleError) throw cause;
    throw new SpecBundleError(`schema validation failed for ${domain}`, {
      code: SPEC_ERROR.SCHEMA,
      domain,
      cause,
    });
  }
}

/**
 * Load a spec bundle, validate each schema domain, then enforce package-level invariants.
 * The injected validator may throw, return a boolean, return an error array, or return
 * `{ valid, errors }`. Unknown and asynchronous results fail closed so a missing return
 * cannot silently disable schema validation.
 * @param {string} root
 * @param {{ validateSchema?: (value: unknown, domain: string) => unknown, layout?: typeof defaultLayout }} [options]
 */
export function validateAndLoadSpecBundle(root, { validateSchema, layout = defaultLayout } = {}) {
  if (typeof validateSchema !== 'function') {
    throw new SpecBundleError('validateSchema must be provided', {
      code: SPEC_ERROR.CONFIGURATION,
      domain: 'configuration',
    });
  }

  let bundle;
  try {
    bundle = {
      framework: readJson(root, layout.frameworkPath),
      product: readJson(root, layout.productPath),
      workflows: readJson(root, layout.workflowsPath),
      behaviors: readJson(root, layout.behaviorsPath),
      adapters: [],
      provenance: {
        workflowSource: layout.workflowsPath,
        behaviorSource: layout.behaviorsPath,
      },
    };
  } catch (cause) {
    throw new SpecBundleError('spec bundle layout could not be loaded', {
      code: SPEC_ERROR.LAYOUT,
      domain: 'layout',
      cause,
    });
  }

  const baseDomains = [
    ['framework', bundle.framework],
    ['product', bundle.product],
    ['workflows', bundle.workflows],
    ['behaviors', bundle.behaviors],
  ];
  for (const [domain, value] of baseDomains) validateDomain(value, domain, validateSchema);

  if (Array.isArray(bundle.product?.adapterDefinitions)) {
    try {
      const adapterRoot = dirname(resolveContainedFile(root, layout.productPath));
      bundle.adapters = bundle.product.adapterDefinitions.map((path) => readJson(adapterRoot, path));
    } catch (cause) {
      throw new SpecBundleError('spec bundle adapter layout could not be loaded', {
        code: SPEC_ERROR.LAYOUT,
        domain: 'layout',
        cause,
      });
    }
    for (const [index, adapter] of bundle.adapters.entries()) {
      validateDomain(adapter, `adapter:${adapter.id ?? index}`, validateSchema);
    }
  }

  const failures = validateInvariants(bundle);
  if (failures.length > 0) {
    throw new SpecBundleError('spec bundle business invariants failed', {
      code: SPEC_ERROR.INVARIANT,
      domain: 'bundle',
      details: failures,
    });
  }
  return bundle;
}

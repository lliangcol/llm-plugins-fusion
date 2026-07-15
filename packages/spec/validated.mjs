import { dirname } from 'node:path';
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
  if (result === false) return ['validator returned false'];
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object') {
    const record = /** @type {{ valid?: boolean, errors?: unknown[] }} */ (result);
    if (record.valid === false) return record.errors?.length ? record.errors : ['validator returned valid=false'];
  }
  return [];
}

function predicateInputs(predicate, inputs = []) {
  if (!predicate || typeof predicate !== 'object') return inputs;
  if (typeof predicate.input === 'string') inputs.push(predicate.input);
  if (Array.isArray(predicate.args)) for (const child of predicate.args) predicateInputs(child, inputs);
  if (predicate.arg) predicateInputs(predicate.arg, inputs);
  return inputs;
}

/** @param {{ framework: any, product: any, workflows: any, behaviors: any, adapters: any[] }} bundle @returns {string[]} */
function validateInvariants(bundle) {
  const failures = [];
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
  for (const workflow of workflows) {
    if (!bundle.workflows?.permissionProfiles?.[workflow.permissionProfile]) {
      failures.push(`${workflow.id}: unknown permission profile ${workflow.permissionProfile}`);
    }
    const behavior = behaviorById.get(workflow.id);
    if (!behavior || !Array.isArray(behavior.inputs)) continue;
    const behaviorRequired = behavior.inputs.filter((input) => input.required).map((input) => input.name);
    const workflowRequired = workflow.compatibilityProjection?.requiredInputs ?? workflow.requiredInputs;
    if (JSON.stringify(behaviorRequired) !== JSON.stringify(workflowRequired)) {
      failures.push(`${workflow.id}: behavior required inputs differ from workflow policy`);
    }
    const canonicalBehavior = behaviorById.get(workflow.canonicalSurfaceId);
    const canonicalInputs = new Map((canonicalBehavior?.inputs ?? []).map((input) => [input.name, input]));
    for (const [name, value] of Object.entries(workflow.variantPreset ?? {})) {
      const input = canonicalInputs.get(name);
      if (!input) failures.push(`${workflow.id}: variant preset ${name} is not a canonical ${workflow.canonicalSurfaceId} input`);
      else if (Array.isArray(input.exactValues) && !input.exactValues.some((allowed) => Object.is(allowed, value))) failures.push(`${workflow.id}: variant preset ${name} has unsupported value ${JSON.stringify(value)}`);
    }
  }
  for (const behavior of behaviors) {
    const inputNames = new Set((behavior.inputs ?? []).map((input) => input.name));
    for (const [index, decision] of (behavior.decisionTable ?? []).entries()) {
      const predicate = decision.predicate ?? (typeof decision.when === 'object' ? decision.when : null);
      const unknownInputs = [...new Set(predicateInputs(predicate).filter((input) => !inputNames.has(input)))].sort();
      if (unknownInputs.length > 0) failures.push(`${behavior.id}: decision ${index} predicates reference unknown inputs: ${unknownInputs.join(', ')}`);
      if (!decision.route) continue;
      const target = workflowById.get(decision.route);
      if (!target) failures.push(`${behavior.id}: decision ${index} routes to unknown workflow ${decision.route}`);
      else if (target.compatibilityAlias) failures.push(`${behavior.id}: decision ${index} routes to compatibility alias ${decision.route}`);
      else if (!automaticTargetSet.has(decision.route)) failures.push(`${behavior.id}: decision ${index} route ${decision.route} is not automatic-routing eligible`);
      if (!decision.variantParameters || typeof decision.variantParameters !== 'object' || Array.isArray(decision.variantParameters)) {
        failures.push(`${behavior.id}: decision ${index} lacks structured variantParameters`);
      } else if (target) {
        const targetInputs = new Map((behaviorById.get(target.id)?.inputs ?? []).map((input) => [input.name, input]));
        for (const [name, value] of Object.entries(decision.variantParameters)) {
          const input = targetInputs.get(name);
          if (!input) failures.push(`${behavior.id}: decision ${index} variant ${name} is not a canonical ${target.id} input`);
          else if (Array.isArray(input.exactValues) && !input.exactValues.some((allowed) => Object.is(allowed, value))) failures.push(`${behavior.id}: decision ${index} variant ${name} has unsupported value ${JSON.stringify(value)}`);
        }
      }
    }
  }
  if (!Array.isArray(bundle.product?.adapterDefinitions)) failures.push('product.adapterDefinitions must be an array');
  else if (bundle.product.adapterDefinitions.length !== bundle.adapters.length) failures.push('loaded adapter count does not match product.adapterDefinitions');
  const adapterIds = bundle.adapters.map((adapter) => adapter?.id);
  const duplicateAdapters = adapterIds.filter((id, index) => adapterIds.indexOf(id) !== index);
  if (duplicateAdapters.length > 0) failures.push(`duplicate adapter ids: ${[...new Set(duplicateAdapters)].sort().join(', ')}`);
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
 * The injected validator may throw, return false, return an error array, or return
 * `{ valid: false, errors }`. This keeps the package independent of a specific schema engine.
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

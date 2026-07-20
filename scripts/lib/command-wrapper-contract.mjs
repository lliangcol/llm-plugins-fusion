/** Validate one generated command wrapper against its structured workflow source. */
export function commandWrapperContractFailures(source, workflow) {
  if (typeof source !== 'string') throw new TypeError('command wrapper source must be a string');
  if (!workflow || typeof workflow !== 'object') throw new TypeError('workflow must be an object');
  const failures = [];
  const runtimeContract = `runtime/contracts/${workflow.id}.json`;
  const runtimeReference = `\${CLAUDE_PLUGIN_ROOT}/${runtimeContract}`;
  const resolutionReference = '${CLAUDE_PLUGIN_ROOT}/runtime/resolved-variant-contracts.json';
  const skillReference = `\${CLAUDE_PLUGIN_ROOT}/${workflow.contractPath}`;
  const entrypointMarker = workflow.compatibilityAlias
    ? '**Compatibility direct entrypoint:**'
    : 'Canonical command wrapper.';
  if (!source.includes(entrypointMarker)) failures.push(`missing ${workflow.compatibilityAlias ? 'compatibility' : 'canonical'} command wrapper marker`);
  if (!source.includes(runtimeReference)) failures.push(`missing compiled runtime contract ${runtimeContract}`);
  if (!source.includes(resolutionReference)) failures.push('missing resolved variant contract index');
  if (!source.includes(skillReference)) failures.push(`missing canonical Skill contract ${workflow.contractPath}`);
  if (!source.includes(`variant preset \`${JSON.stringify(workflow.variantPreset)}\``)) failures.push('missing generated variant preset');
  if (!source.includes(`selector keys declared for \`${workflow.canonicalSurfaceId}\` in`)) failures.push(`missing selector lookup for canonical surface ${workflow.canonicalSurfaceId}`);
  if (!/complete resolved runtime contract is authoritative/iu.test(source)) failures.push('missing complete resolved-contract authority');
  if (!/non-exact combination that triggers any alias specialization is conflicting and must stop/iu.test(source)) failures.push('missing conflicting-specialization stop');
  if (!source.includes(`compare its \`id\` to the invoked command id \`${workflow.id}\``)) failures.push(`missing Claude direct-entrypoint identity gate for ${workflow.id}`);
  if (!/if the resolved id differs, STOP before tools or side effects and invoke the exact direct command/iu.test(source)) failures.push('missing Claude direct-entrypoint mismatch stop');
  if (!/Generic and Codex adapters may instead execute the resolved contract directly/iu.test(source)) failures.push('missing non-Claude resolved-contract execution boundary');
  return failures;
}

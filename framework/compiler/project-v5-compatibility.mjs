/** Project a Contract v6 workflow specification back to the exact v5 public shape. */
export function projectV5Compatibility(spec) {
  if (spec.schemaVersion === 5) return structuredClone(spec);
  if (spec.schemaVersion !== 6) throw new Error(`unsupported workflow schema version ${spec.schemaVersion}`);
  const projected = structuredClone(spec);
  projected.schemaVersion = 5;
  projected.contractVersions = { workflow: '5.0.0', runtime: '3.0.0', adapter: '2.0.0' };
  projected.workflows = projected.workflows.map((workflow) => {
    const {
      inputs,
      effects,
      authorizationProfile,
      enforcementRequirements,
      evidenceRequirements,
      compatibilityProjection,
      ...legacy
    } = workflow;
    if (!compatibilityProjection || compatibilityProjection.sourceVersion !== 5) {
      throw new Error(`${workflow.id}: missing v5 compatibility projection`);
    }
    if (legacy.permissionProfile !== compatibilityProjection.permissionProfile) {
      throw new Error(`${workflow.id}: compatibility permission profile drift`);
    }
    if (JSON.stringify(legacy.requiredInputs) !== JSON.stringify(compatibilityProjection.requiredInputs)) {
      throw new Error(`${workflow.id}: compatibility required input drift`);
    }
    return legacy;
  });
  return projected;
}

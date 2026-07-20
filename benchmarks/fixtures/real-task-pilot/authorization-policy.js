export function canManageProject(actor, project) {
  if (!actor || !project) return false;
  if (actor.role === 'admin') return true;
  return actor.organizationId === project.organizationId;
}

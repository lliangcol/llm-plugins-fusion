import { createHash } from 'node:crypto';

export const canonicalPromptCorpus = (dataset) => `${JSON.stringify(dataset, null, 2)}\n`;
export const promptCorpusSha256 = (dataset) => createHash('sha256').update(canonicalPromptCorpus(dataset)).digest('hex');

export function joinLockedLabels(dataset, locked) {
  if (locked.locked !== true) throw new Error('evaluation labels must be locked');
  if (dataset.datasetId !== locked.datasetId || dataset.datasetVersion !== locked.datasetVersion) throw new Error('prompt and label semantic dataset identities differ');
  if (locked.promptCorpusSha256 !== promptCorpusSha256(dataset)) throw new Error('locked labels do not match prompt corpus digest');
  const labels = new Map(locked.labels.map((entry) => [entry.id, entry]));
  if (labels.size !== locked.labels.length || labels.size !== dataset.cases.length) throw new Error('prompt and label inventories differ');
  return dataset.cases.map((prompt) => {
    const label = labels.get(prompt.id);
    if (!label) throw new Error(`${prompt.id}: locked label missing`);
    return { ...prompt, expectedRoute: label.preferredRoutes, expectedVariantParameters: label.expectedVariantParameters, expectedRequiredInputs: label.expectedRequiredInputs, acceptableRoutes: label.acceptableRoutes, forbiddenRoutes: label.forbiddenRoutes };
  });
}

export function parseLabelCatalog(source) {
  const labels = [];
  for (const line of source.split(/\r?\n/u)) {
    if (!/^\s*-\s*\{/u.test(line)) continue;
    const fields = Object.fromEntries([...line.matchAll(/(name|color|description):\s*"([^"]*)"/gu)].map((match) => [match[1], match[2]]));
    if (!fields.name || !/^[a-f0-9]{6}$/u.test(fields.color ?? '') || !fields.description) throw new Error(`invalid inline label entry: ${line.trim()}`);
    labels.push(fields);
  }
  if (labels.length === 0) throw new Error('label catalog is empty');
  if (new Set(labels.map((label) => label.name)).size !== labels.length) throw new Error('label catalog names must be unique');
  return labels;
}

export function diffLabels(desired, actual) {
  const current = new Map(actual.map((label) => [label.name, label]));
  const create = [];
  const update = [];
  for (const label of desired) {
    const existing = current.get(label.name);
    if (!existing) create.push(label);
    else if (existing.color.toLowerCase() !== label.color.toLowerCase() || existing.description !== label.description) update.push(label);
  }
  return { create, update, unchanged: desired.length - create.length - update.length };
}

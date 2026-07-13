import { readContainedJson, resolveContainedFile } from '../../framework/io/safe-json-file.mjs';

export const defaultLayout = Object.freeze({
  frameworkPath: 'framework.json',
  productPath: 'product.json',
  workflowsPath: 'workflows.json',
  behaviorsPath: 'behaviors.json',
});

export { resolveContainedFile };

export function readJson(root, path) {
  return readContainedJson(root, path);
}

import { dirname } from 'node:path';
import { readContainedJson, resolveContainedFile } from './safe-json-file.mjs';

/** Filesystem adapter kept outside the pure compiler. */
export function loadProductBundle({ root, frameworkPath, productPath, workflowsPath, behaviorsPath }) {
  const productFullPath = resolveContainedFile(root, productPath);
  const product = readContainedJson(root, productPath);
  const adapterBase = dirname(productFullPath);
  return {
    framework: readContainedJson(root, frameworkPath),
    product,
    workflows: readContainedJson(root, workflowsPath),
    behaviors: readContainedJson(root, behaviorsPath),
    adapters: product.adapterDefinitions.map((path) => readContainedJson(adapterBase, path)),
    provenance: {
      workflowSource: workflowsPath,
      behaviorSource: behaviorsPath,
    },
  };
}

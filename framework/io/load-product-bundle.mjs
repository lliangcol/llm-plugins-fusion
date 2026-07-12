import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Filesystem adapter kept outside the pure compiler. */
export function loadProductBundle({ root, frameworkPath, productPath, workflowsPath, behaviorsPath }) {
  const productFullPath = resolve(root, productPath);
  const product = readJson(productFullPath);
  const adapterBase = dirname(productFullPath);
  return {
    framework: readJson(resolve(root, frameworkPath)),
    product,
    workflows: readJson(resolve(root, workflowsPath)),
    behaviors: readJson(resolve(root, behaviorsPath)),
    adapters: product.adapterDefinitions.map((path) => readJson(resolve(adapterBase, path))),
  };
}

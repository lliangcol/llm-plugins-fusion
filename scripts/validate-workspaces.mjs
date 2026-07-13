#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const readText = (path) => readFileSync(resolve(root, path), 'utf8');
const readJson = (path) => JSON.parse(readText(path));
const rootPackage = readJson('package.json');
const typecheckConfig = readJson('tsconfig.checkjs.json');
const expected = ['cli', 'compiler', 'conformance', 'spec'];
const expectedTypecheckIncludes = [
  'adapters/**/*.mjs',
  'framework/**/*.mjs',
  'nova-plugin/hooks/scripts/**/*.mjs',
  'nova-plugin/runtime/**/*.mjs',
  'packages/**/*.mjs',
  'scripts/**/*.mjs',
];
const errors = [];

const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(JSON.stringify(rootPackage.workspaces) === JSON.stringify(['packages/*']), 'root workspaces must be exactly ["packages/*"]');
expect(rootPackage.packageManager === 'npm@11.13.0', 'root packageManager must keep the locked npm 11.13.0 baseline');
expect(rootPackage.engines?.node === '>=22', 'root Node engine must remain >=22');
expect(rootPackage.license === 'MIT', 'root package must expose the repository MIT license');
expect(rootPackage.devDependencies?.typescript === '7.0.2', 'TypeScript must remain exactly pinned for deterministic checkJs');
expect(rootPackage.devDependencies?.['@types/node'] === '22.20.1', '@types/node must remain exactly pinned to the Node 22 contract');
expect(typecheckConfig.compilerOptions?.allowJs === true, 'checkJs config must allow JavaScript inputs');
expect(typecheckConfig.compilerOptions?.checkJs === true, 'checkJs config must keep JavaScript checking enabled');
expect(typecheckConfig.compilerOptions?.noEmit === true, 'checkJs config must never emit build outputs');
expect(JSON.stringify(typecheckConfig.include) === JSON.stringify(expectedTypecheckIncludes), 'checkJs scope must cover adapters, framework, plugin runtime, packages, and maintenance scripts');

for (const id of expected) {
  const path = `packages/${id}/package.json`;
  const pkg = readJson(path);
  expect(pkg.name === `@llm-plugins-fusion/${id}`, `${path} has an unexpected package name`);
  expect(pkg.version === rootPackage.version, `${path} version must match the root version`);
  expect(pkg.private === true, `${path} must remain private until an explicit publication decision`);
  expect(pkg.license === rootPackage.license, `${path} license must match the root SPDX license`);
  expect(pkg.type === 'module', `${path} must use ESM`);
  expect(pkg.exports?.['.'] === './index.mjs', `${path} must export ./index.mjs`);
  expect(pkg.engines?.node === rootPackage.engines.node, `${path} Node engine must match the root contract`);

  const source = readText(`packages/${id}/index.mjs`);
  expect(!/from ['"]\.\.\/(?:cli|compiler|conformance|spec)\//u.test(source), `${id} must not use relative cross-workspace imports`);
}

const compiler = readJson('packages/compiler/package.json');
expect(compiler.dependencies?.['@llm-plugins-fusion/spec'] === rootPackage.version, 'compiler must declare its spec workspace dependency');

const cli = readJson('packages/cli/package.json');
for (const dependency of ['compiler', 'conformance', 'spec']) {
  expect(cli.dependencies?.[`@llm-plugins-fusion/${dependency}`] === rootPackage.version, `cli must declare its ${dependency} workspace dependency`);
}
expect(cli.bin?.llmf === './bin/llmf.mjs', 'cli must expose the llmf binary');

if (errors.length > 0) {
  console.error(`Workspace validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK ${expected.length} private workspaces have explicit package boundaries`);

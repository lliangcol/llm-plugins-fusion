#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const readText = (path) => readFileSync(resolve(root, path), 'utf8');
const readJson = (path) => JSON.parse(readText(path));

const channels = readJson('governance/release-channels.json');
const plugin = readJson('nova-plugin/.claude-plugin/plugin.json');
const registry = readJson('.claude-plugin/registry.source.json');
const facts = readJson('governance/facts.generated.json');
const changelog = readText('CHANGELOG.md');
const readme = readText('README.md');
const security = readText('SECURITY.md');
const contributing = readText('CONTRIBUTING.md');
const errors = [];

const stable = channels.stable;
const registryPlugin = registry.plugins.find((entry) => entry.localSource === './nova-plugin');
const factValue = (id) => facts.facts?.[id]?.value;
const expect = (condition, message) => {
  if (!condition) errors.push(message);
};

expect(stable.tag === `v${stable.version}`, 'stable tag must be v<stable.version>');
expect(plugin.version === stable.version, 'plugin version must match the stable release-channel version');
expect(registryPlugin?.distributionSource?.ref === stable.tag, 'registry stable distribution ref must match the stable tag');
expect(registryPlugin?.distributionSource?.sha === stable.commit, 'registry stable distribution SHA must match the stable commit');
expect(factValue('release.stable.version') === stable.version, 'generated fact graph stable version is stale');
expect(factValue('release.stable.tag') === stable.tag, 'generated fact graph stable tag is stale');
expect(factValue('release.stable.commit') === stable.commit, 'generated fact graph stable commit is stale');
expect(changelog.includes(`## [${stable.version}]`), `CHANGELOG is missing ${stable.version}`);
expect(!/stable channel pinned to `v3\.2\.0`|no 4\.0 release or compatibility upgrade is claimed/u.test(changelog), 'CHANGELOG contains the retired pre-release 4.0 narrative');
expect(readme.includes(`releases/tag/${stable.tag}`) && readme.includes(`当前稳定推广基线是 \`${stable.tag}\``), 'README stable release facts are stale');
expect(security.includes(`nova-plugin@${stable.version}`), 'SECURITY plugin version fact is stale');
expect(contributing.includes(`nova-plugin@${stable.version}`), 'CONTRIBUTING plugin version fact is stale');

if (errors.length > 0) {
  console.error(`Release-channel fact validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`OK release-channel facts are consistent for ${stable.tag} (${stable.state})`);

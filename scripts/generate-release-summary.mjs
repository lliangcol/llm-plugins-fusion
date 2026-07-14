#!/usr/bin/env node
/** Generate a release communication draft from governed release and evidence sources. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

export function buildReleaseSummary({ channels, proof, adoption }) {
  const stable = channels.stable;
  const proofMatches = proof.matches === true
    && stable.state === 'INSTALL_PROVEN'
    && proof.stable?.version === stable.version
    && proof.stable?.tag === stable.tag
    && proof.stable?.commit === stable.commit
    && proof.candidateTreeDigest === stable.pluginTreeSha256
    && proof.installedTreeDigest === stable.pluginTreeSha256;
  return {
    schemaVersion: 1,
    release: {
      version: stable.version,
      tag: stable.tag,
      commit: stable.commit,
      pluginTreeSha256: stable.pluginTreeSha256,
    },
    sections: {
      verified: [
        `Stable channel source records ${stable.tag} at ${stable.commit}.`,
        ...(proofMatches ? [`Stable install proof matches tree digest ${proof.installedTreeDigest}.`] : []),
      ],
      notVerified: [
        'This draft does not prove that the current checkout is an exact release tag.',
        ...(!proofMatches ? ['No matching stable install proof.'] : []),
      ],
      skipped: ['Signing was not performed by this local documentation workflow.'],
      externalEvidence: ['Current user-scope installation, remote CI, and credentialed assistant evaluation require separately authorized evidence.'],
      residualRisk: [`External adoption status is ${adoption.status}; community metrics do not establish correctness or safety.`],
    },
  };
}

export function outputs() {
  const data = buildReleaseSummary({
    channels: read('governance/release-channels.json'),
    proof: read('governance/stable-install-proof.json'),
    adoption: read('governance/adoption-evidence.json'),
  });
  const json = `${JSON.stringify(data, null, 2)}\n`;
  const md = `# Generated release summary\n\nVersion **${data.release.version}**; exact stable tag **${data.release.tag}**; plugin tree digest \`${data.release.pluginTreeSha256}\`.\n\n${Object.entries(data.sections).map(([name, items]) => `## ${name.replace(/([A-Z])/gu, ' $1').replace(/^./u, (character) => character.toUpperCase())}\n\n${items.map((item) => `- ${item}`).join('\n')}`).join('\n\n')}\n`;
  return [['docs/generated/release-summary.json', json], ['docs/generated/release-summary.md', md]];
}

export function checkOrWrite({ write = false } = {}) {
  const stale = [];
  for (const [path, content] of outputs()) {
    const target = resolve(root, path);
    if (!existsSync(target) || readFileSync(target, 'utf8') !== content) {
      if (write) {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
      } else stale.push(path);
    }
  }
  if (stale.length) throw new Error(`${stale.join(', ')} release summary outputs are stale`);
}

export function main(args = process.argv.slice(2)) {
  try {
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/generate-release-summary.mjs [--write]');
    checkOrWrite({ write: args.includes('--write') });
    console.log(args.includes('--write') ? 'Wrote release summary' : 'OK release summary');
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();

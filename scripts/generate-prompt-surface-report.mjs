#!/usr/bin/env node
/** Generate the aggregate prompt load graph and cross-file duplication evidence. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';
import { loadNovaWorkflowModelV6 } from './lib/workflow-model.mjs';

const root = repoRoot(import.meta.url);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function packPath(id) {
  const nested = `nova-plugin/packs/${id}/README.md`;
  return existsSync(resolve(root, nested)) ? nested : 'nova-plugin/packs/README.md';
}

function fileMetrics(path) {
  const content = readFileSync(resolve(root, path), 'utf8');
  return { path, bytes: Buffer.byteLength(content), tokens: Math.ceil(content.length / 4), sha256: sha256(content), content };
}

function duplication(files) {
  const owners = new Map();
  for (const file of files) {
    const paragraphs = file.content.split(/\r?\n\s*\r?\n/u).map((value) => value.replace(/\s+/gu, ' ').trim()).filter((value) => value.length >= 40);
    for (const paragraph of new Set(paragraphs)) {
      const key = sha256(paragraph);
      const entry = owners.get(key) ?? { bytes: Buffer.byteLength(paragraph), paths: [] };
      entry.paths.push(file.path); owners.set(key, entry);
    }
  }
  const repeated = [...owners.values()].filter((entry) => entry.paths.length > 1);
  const duplicateBytes = repeated.reduce((sum, entry) => sum + entry.bytes * (entry.paths.length - 1), 0);
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  return { repeatedParagraphs: repeated.length, duplicateBytes, duplicateRatio: totalBytes ? duplicateBytes / totalBytes : 0 };
}

export function buildPromptSurfaceReport() {
  const { spec } = loadNovaWorkflowModelV6(root);
  const workflows = spec.workflows.map((workflow) => {
    const nodes = [
      { kind: 'command', path: `nova-plugin/commands/${workflow.id}.md` },
      { kind: 'runtime-contract', path: `nova-plugin/runtime/contracts/${workflow.id}.json` },
      { kind: 'canonical-skill', path: `nova-plugin/${workflow.contractPath}` },
      ...workflow.ownerAgents.map((id) => ({ kind: 'owner-agent', path: `nova-plugin/agents/${id}.md` })),
      ...workflow.recommendedPacks.map((id) => ({ kind: 'capability-pack', path: packPath(id) })),
    ];
    const uniqueNodes = [...new Map(nodes.map((node) => [node.path, node])).values()];
    const files = uniqueNodes.map((node) => ({ ...node, ...fileMetrics(node.path) }));
    return {
      id: workflow.id, canonicalSurfaceId: workflow.canonicalSurfaceId,
      graph: {
        entrypoint: `nova-plugin/commands/${workflow.id}.md`,
        nodes: files.map(({ content, ...file }) => file),
        edges: files.slice(1).map((file) => ({ from: `nova-plugin/commands/${workflow.id}.md`, to: file.path, relation: ['runtime-contract', 'canonical-skill'].includes(file.kind) ? `loads-${file.kind}` : `recommended-${file.kind}` })),
      },
      aggregate: { files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), tokens: files.reduce((sum, file) => sum + file.tokens, 0), ...duplication(files) },
    };
  });
  return { schemaVersion: 1, source: 'workflow-specs/workflows.v6.json', tokenEstimate: 'ceil(UTF-16 code units / 4) per file; deterministic bloat guard, not tokenizer evidence', budgets: { maximumAggregateTokens: 20_000, maximumAggregateFiles: 16, maximumCrossFileDuplicateRatio: 0.08 }, workflowCount: workflows.length, workflows };
}

export function validatePromptSurfaceBudgets(report) {
  const errors = [];
  if (report.workflowCount !== 21) errors.push(`aggregate prompt graph covers ${report.workflowCount}/21 workflows`);
  for (const workflow of report.workflows) {
    if (workflow.aggregate.files > report.budgets.maximumAggregateFiles) errors.push(`${workflow.id}: aggregate files ${workflow.aggregate.files} exceeds ${report.budgets.maximumAggregateFiles}`);
    if (workflow.aggregate.tokens > report.budgets.maximumAggregateTokens) errors.push(`${workflow.id}: aggregate tokens ${workflow.aggregate.tokens} exceeds ${report.budgets.maximumAggregateTokens}`);
    if (workflow.aggregate.duplicateRatio > report.budgets.maximumCrossFileDuplicateRatio) errors.push(`${workflow.id}: cross-file duplicate ratio ${workflow.aggregate.duplicateRatio.toFixed(3)} exceeds ${report.budgets.maximumCrossFileDuplicateRatio}`);
  }
  return errors;
}

function markdown(report) {
  const rows = report.workflows.map((workflow) => `| \`${workflow.id}\` | ${workflow.aggregate.files} | ${workflow.aggregate.bytes} | ${workflow.aggregate.tokens} | ${(workflow.aggregate.duplicateRatio * 100).toFixed(2)}% |`).join('\n');
  return `# Aggregate Prompt Surface Report\n\nStatus: generated\n\nGenerated from \`${report.source}\`. Token values are deterministic size estimates, not assistant tokenizer measurements. Each graph includes the command entrypoint, runtime contract, canonical Skill, owner agents, and recommended capability packs.\n\nBudgets: at most ${report.budgets.maximumAggregateFiles} files, ${report.budgets.maximumAggregateTokens} estimated tokens, and ${(report.budgets.maximumCrossFileDuplicateRatio * 100).toFixed(0)}% cross-file exact-paragraph duplication per workflow.\n\n| Workflow | Files | Bytes | Estimated tokens | Cross-file duplication |\n| --- | ---: | ---: | ---: | ---: |\n${rows}\n`;
}

export function checkOrWrite({ write = false } = {}) {
  const report = buildPromptSurfaceReport();
  const outputs = [{ path: 'docs/generated/prompt-surface-report.json', content: `${JSON.stringify(report, null, 2)}\n` }, { path: 'docs/generated/prompt-surface-report.md', content: markdown(report) }];
  const stale = [];
  for (const output of outputs) {
    const fullPath = resolve(root, output.path);
    if (write) { mkdirSync(dirname(fullPath), { recursive: true }); writeFileSync(fullPath, output.content, 'utf8'); }
    else if (!existsSync(fullPath) || readFileSync(fullPath, 'utf8') !== output.content) stale.push(output.path);
  }
  if (stale.length) throw new Error(`${stale.join(', ')} stale; run node scripts/generate-prompt-surface-report.mjs --write`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/generate-prompt-surface-report.mjs [--write]');
    const report = checkOrWrite({ write: args.includes('--write') });
    console.log(`${args.includes('--write') ? 'Wrote' : 'OK'} aggregate prompt surface report (${report.workflowCount} workflows)`);
  } catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; }
}

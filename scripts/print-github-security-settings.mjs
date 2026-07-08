#!/usr/bin/env node
/**
 * Print the maintainer GitHub security settings checklist.
 *
 * This script is read-only. It does not call GitHub APIs or change repository
 * settings; use it when preparing a manual settings audit.
 */

const requiredChecks = [
  'Verify Agents',
  'Validate Schemas',
  'Validate Registry Fixtures',
  'Validate Generated Drift',
  'Validate Capability Packs',
  'Validate Claude Compatibility',
  'Plugin Install Dry Run',
  'Lint Frontmatter',
  'Validate Hooks',
  'Validate GitHub Workflows',
  'Validate Runtime Smoke',
  'Validate Surface Budget',
  'Scan Distribution Risk',
  'Validate Regression',
  'Validate Workflow Fixtures',
  'Validate Docs',
  'Windows Node Smoke',
  'Windows Bash Smoke',
  'Dependency Review',
  'CodeQL / Analyze JavaScript',
];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage: node scripts/print-github-security-settings.mjs

Prints the tracked manual GitHub repository settings checklist. The script is
read-only and does not require network access.`);
  process.exit(0);
}

console.log('GitHub security settings checklist');
console.log('');
console.log('- Protect main with pull requests, stale approval dismissal, and no force pushes.');
console.log('- Keep default Actions token permissions read-only unless a workflow needs write access.');
console.log('- Enable Dependency graph, Dependabot alerts, Dependabot security updates, CodeQL, and secret scanning.');
console.log('- Require equivalent status-check coverage before merge:');
for (const check of requiredChecks) {
  console.log(`  - ${check}`);
}
console.log('');
console.log('Reference: docs/maintainers/github-security-settings.md');

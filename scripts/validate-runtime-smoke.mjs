#!/usr/bin/env node
/**
 * Smoke-test distributed Bash runtime helpers without invoking Codex.
 *
 * This check verifies script syntax, help output, and safe failure paths. It
 * does not run review/verify against a real branch and does not write .codex.
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

let failed = 0;
let skipped = 0;

function commandExists(command) {
  const result = spawnSync(command, ['--version'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'ignore',
    shell: false,
  });
  return result.status === 0;
}

function run(label, args, options = {}) {
  const result = spawnSync('bash', args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const expectFailure = Boolean(options.expectFailure);
  const statusOk = expectFailure ? result.status !== 0 : result.status === 0;
  const outputOk = options.outputPattern ? options.outputPattern.test(output) : true;

  if (result.error || !statusOk || !outputOk) {
    failed += 1;
    console.error(`ERROR ${label}`);
    if (result.error) console.error(`  ${result.error.message}`);
    console.error(`  status=${result.status}`);
    if (options.outputPattern && !outputOk) {
      console.error(`  output did not match ${options.outputPattern}`);
    }
    const excerpt = output.split(/\r?\n/).filter(Boolean).slice(0, 8).join('\n');
    if (excerpt) console.error(excerpt);
    return;
  }

  console.log(`OK ${label}`);
}

function runTempBash(label, body, options = {}) {
  const dirName = `.runtime-smoke-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const dirAbs = resolve(root, dirName);
  const scriptRel = `${dirName}/case.sh`;
  const scriptAbs = resolve(root, scriptRel);
  mkdirSync(dirAbs);
  writeFileSync(scriptAbs, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  chmodSync(scriptAbs, 0o755);
  try {
    run(label, [scriptRel], options);
  } finally {
    rmSync(dirAbs, { recursive: true, force: true });
  }
}

function assertFileDoesNotMatch(label, relPath, pattern) {
  const src = readFileSync(resolve(root, relPath), 'utf8');
  if (pattern.test(src)) {
    failed += 1;
    console.error(`ERROR ${label}`);
    console.error(`  ${relPath} matched ${pattern}`);
    return;
  }
  console.log(`OK ${label}`);
}

if (!commandExists('bash')) {
  if (process.platform === 'win32') {
    skipped += 1;
    console.warn('WARNING runtime smoke: bash not found; skipping local Bash runtime smoke checks');
    console.log(`Summary: failed=${failed} skipped=${skipped}`);
    process.exit(0);
  }
  console.error('ERROR runtime smoke: bash is required outside Windows');
  process.exit(1);
}

const scripts = [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh',
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh',
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-verify.sh',
  'nova-plugin/skills/nova-codex-review-fix/scripts/run-project-checks.sh',
];

for (const script of scripts) {
  run(`bash -n ${script}`, ['-n', script]);
}

run('codex-review.sh --help', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh',
  '--help',
], { outputPattern: /Usage: codex-review\.sh/ });

run('codex-verify.sh --help', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-verify.sh',
  '--help',
], { outputPattern: /Usage: codex-verify\.sh/ });

run('run-project-checks.sh --help', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/run-project-checks.sh',
  '--help',
], { outputPattern: /Usage: run-project-checks\.sh/ });

run('codex-review.sh rejects unknown args', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh',
  '--definitely-invalid',
], { expectFailure: true, outputPattern: /未知参数/ });

run('codex-verify.sh requires review file', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-verify.sh',
], { expectFailure: true, outputPattern: /--review-file|review\.md/ });

run('run-project-checks.sh rejects unknown args', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/run-project-checks.sh',
  '--definitely-invalid',
], { expectFailure: true, outputPattern: /未知参数/ });

assertFileDoesNotMatch(
  'run-project-checks.sh uses explicit task dispatcher',
  'nova-plugin/skills/nova-codex-review-fix/scripts/run-project-checks.sh',
  /\beval\s+/,
);

runTempBash('codex_executable falls back to codex.exe', `
tmp="$(dirname "$0")/bin"
mkdir "$tmp"
printf '%s\\n' '#!/usr/bin/env bash' 'echo "fake runtime: node: not found" >&2' 'exit 0' > "$tmp/codex"
printf '%s\\n' '#!/usr/bin/env bash' 'echo "codex-cli test"' > "$tmp/codex.exe"
chmod +x "$tmp/codex" "$tmp/codex.exe"
PATH="$tmp:/usr/bin:/bin"
source nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh
codex_executable
`, { outputPattern: /codex\.exe/ });

runTempBash('node_executable falls back to node.exe', `
tmp="$(dirname "$0")/bin"
mkdir "$tmp"
printf '%s\\n' '#!/usr/bin/env bash' 'echo "fake runtime: node: not found" >&2' 'exit 0' > "$tmp/node"
printf '%s\\n' '#!/usr/bin/env bash' 'echo "v99.0.0-test"' > "$tmp/node.exe"
chmod +x "$tmp/node" "$tmp/node.exe"
PATH="$tmp:/usr/bin:/bin"
source nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh
node_executable
`, { outputPattern: /node\.exe/ });

runTempBash('ensure_codex_available rejects unusable shim', `
tmp="$(dirname "$0")/bin"
mkdir "$tmp"
printf '%s\\n' '#!/usr/bin/env bash' 'echo "fake runtime: node: not found" >&2' 'exit 0' > "$tmp/codex"
chmod +x "$tmp/codex"
PATH="$tmp:/usr/bin:/bin"
source nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh
ensure_codex_available
`, { expectFailure: true, outputPattern: /未找到可运行的 codex 命令|not found/ });

runTempBash('write_untracked_diff includes untracked file content', `
helper="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh"
tmp_repo="$(dirname "$0")/repo"
mkdir "$tmp_repo"
git init -q "$tmp_repo"
cd "$tmp_repo"
tmp_file="untracked-smoke.txt"
diff_file="untracked.diff"
printf '%s\\n' 'untracked smoke content' > "$tmp_file"
source "$helper"
write_untracked_diff "$diff_file"
grep -q 'untracked smoke content' "$diff_file"
`);

runTempBash('resolve_output_path allows missing parent directory', `
helper="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh"
tmp_repo="$(dirname "$0")/repo"
mkdir "$tmp_repo"
git init -q "$tmp_repo"
cd "$tmp_repo"
source "$helper"
output="$(resolve_output_path ".codex/codex-review-fix/latest-artifacts/checks.txt")"
case "$output" in
  */.codex/codex-review-fix/latest-artifacts/checks.txt) exit 0 ;;
  *) printf 'unexpected output path: %s\\n' "$output" >&2; exit 1 ;;
esac
`);

console.log(`Summary: failed=${failed} skipped=${skipped}`);
if (failed > 0) process.exit(1);

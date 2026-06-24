#!/usr/bin/env node
/**
 * Smoke-test distributed Bash runtime helpers without invoking Codex.
 *
 * This check verifies script syntax, help output, and safe failure paths. It
 * does not run review/verify against a real branch and does not write .codex.
 */

import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandExists, runProcess } from './lib/process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

let failed = 0;
let skipped = 0;

async function run(label, args, options = {}) {
  const result = await runProcess(label, 'bash', args, {
    cwd: root,
    timeoutMs: 60_000,
  });

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const expectFailure = Boolean(options.expectFailure);
  const statusOk = expectFailure ? result.code !== 0 : result.code === 0;
  const outputOk = options.outputPattern ? options.outputPattern.test(output) : true;

  if (result.error || result.timedOut || !statusOk || !outputOk) {
    failed += 1;
    console.error(`ERROR ${label}`);
    if (result.errorMessage) console.error(`  ${result.errorMessage}`);
    console.error(`  status=${result.code}`);
    if (options.outputPattern && !outputOk) {
      console.error(`  output did not match ${options.outputPattern}`);
    }
    const excerpt = output.split(/\r?\n/).filter(Boolean).slice(0, 8).join('\n');
    if (excerpt) console.error(excerpt);
    return;
  }

  console.log(`OK ${label}`);
}

async function runTempBash(label, body, options = {}) {
  const dirName = `.runtime-smoke-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const dirAbs = resolve(root, dirName);
  const scriptRel = `${dirName}/case.sh`;
  const scriptAbs = resolve(root, scriptRel);
  mkdirSync(dirAbs);
  writeFileSync(scriptAbs, `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`);
  chmodSync(scriptAbs, 0o755);
  try {
    await run(label, [scriptRel], options);
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

if (!(await commandExists('bash', ['--version'], { cwd: root }))) {
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
  await run(`bash -n ${script}`, ['-n', script]);
}

await run('codex-review.sh --help', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh',
  '--help',
], { outputPattern: /Usage: codex-review\.sh/ });

await run('codex-verify.sh --help', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-verify.sh',
  '--help',
], { outputPattern: /Usage: codex-verify\.sh/ });

await run('run-project-checks.sh --help', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/run-project-checks.sh',
  '--help',
], { outputPattern: /Usage: run-project-checks\.sh/ });

await run('codex-review.sh rejects unknown args', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh',
  '--definitely-invalid',
], { expectFailure: true, outputPattern: /未知参数/ });

await run('codex-review.sh requires option values', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh',
  '--base',
  '--full',
], { expectFailure: true, outputPattern: /--base 需要参数值/ });

await run('codex-verify.sh requires review file', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-verify.sh',
], { expectFailure: true, outputPattern: /--review-file|review\.md/ });

await run('codex-verify.sh requires option values', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-verify.sh',
  '--review-file',
  '--base',
], { expectFailure: true, outputPattern: /--review-file 需要参数值/ });

await run('run-project-checks.sh rejects unknown args', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/run-project-checks.sh',
  '--definitely-invalid',
], { expectFailure: true, outputPattern: /未知参数/ });

await run('run-project-checks.sh requires report-file path', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/run-project-checks.sh',
  '--report-file',
], { expectFailure: true, outputPattern: /--report-file/ });

assertFileDoesNotMatch(
  'run-project-checks.sh uses explicit task dispatcher',
  'nova-plugin/skills/nova-codex-review-fix/scripts/run-project-checks.sh',
  /\beval\s+/,
);

await runTempBash('pre-write hook rejects common token shapes', `
secret_tail="aaaaaaaaaaaaaaaaaaaaaaaa"
token="sk-proj-\${secret_tail}"
payload="$(printf '{"tool_input":{"file_path":"src/example.js","content":"OPENAI_API_KEY=%s"}}' "$token")"
printf '%s' "$payload" | bash nova-plugin/hooks/scripts/pre-write-check.sh
`, { expectFailure: true, outputPattern: /敏感信息/ });

await runTempBash('pre-write hook validates hooks.json structure', `
content='{"hooks":{"PreToolUse":[{"matcher":"Write","hooks":[{"type":"command","command":"bash \\"\${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh\\"","timeout":10}]}]}}'
payload="$(CONTENT="$content" node -e 'process.stdout.write(JSON.stringify({tool_input:{file_path:"nova-plugin/hooks/hooks.json",content:process.env.CONTENT}}))')"
printf '%s' "$payload" | CLAUDE_PLUGIN_ROOT="$PWD/nova-plugin" bash nova-plugin/hooks/scripts/pre-write-check.sh
`);

await runTempBash('post-audit hook redacts command secrets', `
secret_tail="bbbbbbbbbbbbbbbbbbbbbbbb"
token="sk-proj-\${secret_tail}"
log_dir="$(dirname "$0")/hook-data"
mkdir "$log_dir"
export CLAUDE_PLUGIN_DATA="$log_dir"
payload="$(printf '{"tool_name":"Bash","tool_input":{"command":"curl -H Authorization: Bearer %s https://example.test"},"tool_response":{"success":true}}' "$token")"
printf '%s' "$payload" | bash nova-plugin/hooks/scripts/post-audit-log.sh
grep -q '<redacted>' "$log_dir/audit.log"
! grep -q "$token" "$log_dir/audit.log"
`);

await runTempBash('codex_executable falls back to codex.exe', `
tmp="$(dirname "$0")/bin"
mkdir "$tmp"
printf '%s\\n' '#!/usr/bin/env bash' 'echo "fake runtime: node: not found" >&2' 'exit 0' > "$tmp/codex"
printf '%s\\n' '#!/usr/bin/env bash' 'echo "codex-cli test"' > "$tmp/codex.exe"
chmod +x "$tmp/codex" "$tmp/codex.exe"
PATH="$tmp:/usr/bin:/bin"
source nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh
codex_executable
`, { outputPattern: /codex\.exe/ });

await runTempBash('node_executable falls back to node.exe', `
tmp="$(dirname "$0")/bin"
mkdir "$tmp"
printf '%s\\n' '#!/usr/bin/env bash' 'echo "fake runtime: node: not found" >&2' 'exit 0' > "$tmp/node"
printf '%s\\n' '#!/usr/bin/env bash' 'echo "v99.0.0-test"' > "$tmp/node.exe"
chmod +x "$tmp/node" "$tmp/node.exe"
PATH="$tmp:/usr/bin:/bin"
source nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh
node_executable
`, { outputPattern: /node\.exe/ });

await runTempBash('ensure_codex_available rejects unusable shim', `
tmp="$(dirname "$0")/bin"
mkdir "$tmp"
printf '%s\\n' '#!/usr/bin/env bash' 'echo "fake runtime: node: not found" >&2' 'exit 0' > "$tmp/codex"
chmod +x "$tmp/codex"
PATH="$tmp:/usr/bin:/bin"
source nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh
ensure_codex_available
`, { expectFailure: true, outputPattern: /未找到可运行的 codex 命令|not found/ });

await runTempBash('write_untracked_diff includes untracked file content', `
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

await runTempBash('resolve_output_path allows missing parent directory', `
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

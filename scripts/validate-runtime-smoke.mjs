#!/usr/bin/env node
/**
 * Smoke-test distributed Bash runtime helpers without invoking Codex.
 *
 * This check verifies script syntax, help output, and safe failure paths. It
 * does not run review/verify against a real branch. Temporary scripts are
 * created under .codex/tmp so Windows-hosted node.exe can read Git Bash paths,
 * then removed on normal exit without deleting pre-existing .codex directories.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { commandExists, runProcess } from './lib/process-runner.mjs';
import { resolveBashCommand } from './lib/bash-command.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const bashCommand = resolveBashCommand();

let failed = 0;
let skipped = 0;

async function run(label, args, options = {}) {
  const result = await runProcess(label, bashCommand, args, {
    cwd: root,
    input: options.input,
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
  const tmpRootName = `runtime-smoke-${process.pid}`;
  const script = `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`;
  const wrapper = [
    'set -euo pipefail',
    'codex_dir="$PWD/.codex"',
    'codex_tmp_dir="$codex_dir/tmp"',
    'created_codex_dir=0',
    'created_codex_tmp_dir=0',
    '[ -d "$codex_dir" ] || created_codex_dir=1',
    '[ -d "$codex_tmp_dir" ] || created_codex_tmp_dir=1',
    `tmp_root="$codex_tmp_dir/${tmpRootName}"`,
    'mkdir -p "$tmp_root"',
    'tmp_dir="$(mktemp -d "$tmp_root/case.XXXXXX")"',
    'cleanup() { rm -rf "$tmp_dir"; rmdir "$tmp_root" 2>/dev/null || true; if [ "$created_codex_tmp_dir" = "1" ]; then rmdir "$codex_tmp_dir" 2>/dev/null || true; fi; if [ "$created_codex_dir" = "1" ]; then rmdir "$codex_dir" 2>/dev/null || true; fi; }',
    'trap cleanup EXIT',
    'script="$tmp_dir/case.sh"',
    'cat > "$script" <<\'NOVA_RUNTIME_SMOKE_SCRIPT\'',
    script,
    'NOVA_RUNTIME_SMOKE_SCRIPT',
    'chmod +x "$script"',
    '"$script"',
    '',
  ].join('\n');
  await run(label, ['-s'], { ...options, input: wrapper });
}

async function runNode(label, args, options = {}) {
  const result = await runProcess(label, process.execPath, args, {
    cwd: root,
    env: options.env ? { ...process.env, ...options.env } : process.env,
    input: options.input,
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

async function runNodePostAuditSmoke() {
  const tmpRoot = mkdtempSync(resolve(tmpdir(), 'nova-node-hook-'));
  const token = `sk-proj-${'f'.repeat(24)}`;
  const payload = JSON.stringify({
    tool_name: 'Bash\nFORGED_TOOL',
    tool_input: {
      file_path: `src/example.js\nFORGED_STATUS ${token}`,
    },
    tool_response: { success: true },
  });

  try {
    const result = await runProcess('node post-audit hook redacts command secrets', process.execPath, [
      'nova-plugin/hooks/scripts/post-audit-log.mjs',
    ], {
      cwd: root,
      env: { ...process.env, CLAUDE_PLUGIN_DATA: tmpRoot },
      input: payload,
      timeoutMs: 60_000,
    });
    await runProcess('compact node audit spool', process.execPath, [
      'nova-plugin/hooks/scripts/audit-compactor.mjs',
    ], {
      cwd: root,
      env: { ...process.env, CLAUDE_PLUGIN_DATA: tmpRoot },
      timeoutMs: 60_000,
    });
    const logPath = resolve(tmpRoot, 'audit.log');
    const log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
    const lines = log.trimEnd().split(/\r?\n/);
    if (
      result.code !== 0
      || lines.length !== 1
      || !log.includes('<redacted>')
      || log.includes(token)
      || /^FORGED_/m.test(log)
    ) {
      failed += 1;
      console.error('ERROR node post-audit hook redacts command secrets');
      console.error(`  status=${result.code}`);
      console.error(log.split(/\r?\n/).filter(Boolean).slice(0, 4).join('\n'));
      return;
    }
    console.log('OK node post-audit hook writes one sanitized line');
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
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

function assertFileContainsAll(label, relPath, patterns) {
  const src = readFileSync(resolve(root, relPath), 'utf8');
  const missing = patterns.filter((pattern) => !pattern.test(src));
  if (missing.length > 0) {
    failed += 1;
    console.error(`ERROR ${label}`);
    console.error(`  ${relPath} missing ${missing.map(String).join(', ')}`);
    return;
  }
  console.log(`OK ${label}`);
}

await runNode('node pre-write hook rejects common token shapes', [
  'nova-plugin/hooks/scripts/pre-write-check.mjs',
], {
  input: JSON.stringify({
    tool_name: 'Write',
    tool_input: {
      file_path: 'src/example.js',
      content: `OPENAI_API_KEY=sk-proj-${'e'.repeat(24)}`,
    },
  }),
  expectFailure: true,
  outputPattern: /敏感信息/,
});

await runNode('node pre-write hook validates hooks.json structure', [
  'nova-plugin/hooks/scripts/pre-write-check.mjs',
], {
  input: JSON.stringify({
    tool_name: 'Write',
    tool_input: {
      file_path: 'nova-plugin/hooks/hooks.json',
      content: readFileSync(resolve(root, 'nova-plugin/hooks/hooks.json'), 'utf8'),
    },
  }),
});

await runNode('node pre-bash hook blocks redirection bypass', [
  'nova-plugin/hooks/scripts/pre-bash-check.mjs',
], {
  input: JSON.stringify({ session_id: 'runtime-smoke-block', tool_name: 'Bash', tool_input: { command: 'cat input > output' } }),
  expectFailure: true,
  outputPattern: /shell composition, expansion, redirection/,
});

await runNode('node pre-bash hook allows a bounded validation command', [
  'nova-plugin/hooks/scripts/pre-bash-check.mjs',
], {
  input: JSON.stringify({ session_id: 'runtime-smoke-allow', tool_name: 'Bash', tool_input: { command: 'npm run validate' } }),
});

await runNodePostAuditSmoke();

if (!(await commandExists(bashCommand, ['--version'], { cwd: root }))) {
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
  assertFileDoesNotMatch(`${script} avoids Bash 4 mapfile`, script, /\bmapfile\b/);
}

await run('codex-review.sh --help', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh',
  '--help',
], { outputPattern: /Usage: codex-review\.sh/ });

await run('codex-verify.sh --help', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-verify.sh',
  '--help',
], { outputPattern: /--include-untracked-content/ });

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

await run('codex-review.sh requires full mode for untracked content', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh',
  '--include-untracked-content',
], { expectFailure: true, outputPattern: /--include-untracked-content 必须与 --full 一起使用/ });

await run('codex-verify.sh requires review file', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-verify.sh',
], { expectFailure: true, outputPattern: /--review-file|review\.md/ });

await run('codex-verify.sh requires option values', [
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-verify.sh',
  '--review-file',
  '--base',
], { expectFailure: true, outputPattern: /--review-file 需要参数值/ });

assertFileContainsAll(
  'codex-verify.sh keeps untracked content opt-in',
  'nova-plugin/skills/nova-codex-review-fix/scripts/codex-verify.sh',
  [
    /INCLUDE_UNTRACKED_CONTENT=false/,
    /--include-untracked-content/,
    /未跟踪文件内容默认不写入 verify patch/,
  ],
);

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

assertFileContainsAll(
  'run-project-checks.sh covers default repository gates',
  'nova-plugin/skills/nova-codex-review-fix/scripts/run-project-checks.sh',
  [
    /scripts\/validate-github-workflows\.mjs/,
    /scripts\/validate-surface-budget\.mjs/,
    /scripts\/validate-workflow-fixtures\.mjs/,
  ],
);

await runTempBash('secret-rules detects common token text', `
source nova-plugin/runtime/bash-common.sh
node_bin="$(nova_node_command)"
rules_path="$(nova_secret_rules_path_for_node "$node_bin")"
secret_tail="dddddddddddddddddddddddd"
token="sk-proj-\${secret_tail}"
printf '%s\\n' "OPENAI_API_KEY=\${token}" | "$node_bin" "$rules_path" detect-text
`);

await runTempBash('secret-rules redacts command secrets', `
source nova-plugin/runtime/bash-common.sh
node_bin="$(nova_node_command)"
rules_path="$(nova_secret_rules_path_for_node "$node_bin")"
secret_tail="eeeeeeeeeeeeeeeeeeeeeeee"
token="sk-proj-\${secret_tail}"
auth_name="Authorization:"
auth_type="Bearer"
redacted="$(printf '%s\\n' "curl -H \${auth_name} \${auth_type} \${token}" | "$node_bin" "$rules_path" redact-text)"
printf '%s\\n' "$redacted" | grep -q '<redacted>'
! printf '%s\\n' "$redacted" | grep -q "$token"
`);

await runTempBash('secret-rules ignores ordinary text', `
source nova-plugin/runtime/bash-common.sh
node_bin="$(nova_node_command)"
rules_path="$(nova_secret_rules_path_for_node "$node_bin")"
printf '%s\\n' 'ordinary public documentation text' | "$node_bin" "$rules_path" detect-text
`, { expectFailure: true });

await runTempBash('pre-write hook rejects common token shapes', `
secret_tail="aaaaaaaaaaaaaaaaaaaaaaaa"
token="sk-proj-\${secret_tail}"
payload="$(printf '{"tool_name":"Write","tool_input":{"file_path":"src/example.js","content":"OPENAI_API_KEY=%s"}}' "$token")"
printf '%s' "$payload" | bash nova-plugin/hooks/scripts/pre-write-check.sh
`, { expectFailure: true, outputPattern: /敏感信息/ });

await runTempBash('pre-write hook validates hooks.json structure', `
payload='{"tool_name":"Write","tool_input":{"file_path":"nova-plugin/hooks/hooks.json","content":"{\\"hooks\\":{\\"PreToolUse\\":[{\\"matcher\\":\\"Write\\",\\"hooks\\":[{\\"type\\":\\"command\\",\\"command\\":\\"bash \\\\\\"\${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh\\\\\\"\\",\\"timeout\\":10}]}]}}"}}'
plugin_root="$(pwd -W 2>/dev/null || pwd)/nova-plugin"
payload="$(node -e 'const fs=require("fs"); const file="nova-plugin/hooks/hooks.json"; process.stdout.write(JSON.stringify({tool_name:"Write",tool_input:{file_path:file,content:fs.readFileSync(file,"utf8")}}))')"
printf '%s' "$payload" | CLAUDE_PLUGIN_ROOT="$plugin_root" bash nova-plugin/hooks/scripts/pre-write-check.sh
`);

await runTempBash('post-audit hook redacts command secrets', `
secret_tail="bbbbbbbbbbbbbbbbbbbbbbbb"
token="sk-proj-\${secret_tail}"
log_dir="$(dirname "$0")/hook-data"
mkdir "$log_dir"
export CLAUDE_PLUGIN_DATA="$log_dir"
auth_name="Authorization:"
auth_type="Bearer"
payload="$(printf '{"tool_name":"Bash","tool_input":{"command":"curl -H %s %s %s https://example.test"},"tool_response":{"success":true}}' "$auth_name" "$auth_type" "$token")"
printf '%s' "$payload" | bash nova-plugin/hooks/scripts/post-audit-log.sh
node nova-plugin/hooks/scripts/audit-compactor.mjs
grep -q '<redacted>' "$log_dir/audit.log"
! grep -q "$token" "$log_dir/audit.log"
`);

await runTempBash('post-audit hook normalizes injected newlines to one line', `
log_dir="$(dirname "$0")/hook-injection-data"
mkdir "$log_dir"
export CLAUDE_PLUGIN_DATA="$log_dir"
payload='{"tool_name":"Bash\\nFORGED_TOOL","tool_input":{"file_path":"src/example.js\\nFORGED_STATUS"},"tool_response":{"success":true}}'
printf '%s' "$payload" | bash nova-plugin/hooks/scripts/post-audit-log.sh
node nova-plugin/hooks/scripts/audit-compactor.mjs
[ "$(wc -l < "$log_dir/audit.log" | tr -d ' ')" = "1" ]
! grep -q '^FORGED_' "$log_dir/audit.log"
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

await runTempBash('write_untracked_diff rejects untracked secrets', `
helper="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh"
tmp_repo="$(dirname "$0")/repo"
mkdir "$tmp_repo"
git init -q "$tmp_repo"
cd "$tmp_repo"
tmp_file="untracked-secret.txt"
diff_file="untracked.diff"
secret_tail="cccccccccccccccccccccccc"
printf '%s\\n' "OPENAI_API_KEY=sk-proj-\${secret_tail}" > "$tmp_file"
source "$helper"
write_untracked_diff "$diff_file"
`, { expectFailure: true, outputPattern: /疑似包含敏感信息/ });

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

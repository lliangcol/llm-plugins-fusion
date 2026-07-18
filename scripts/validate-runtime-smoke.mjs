#!/usr/bin/env node
/**
 * Smoke-test distributed Bash runtime helpers without invoking Codex.
 *
 * This check verifies script syntax, help output, and safe failure paths. It
 * does not run review/verify against a real branch. Temporary scripts are
 * created under .codex/tmp on Windows so node.exe can read Git Bash paths. On
 * other platforms they use the system temp directory, which keeps validation
 * compatible with managed workspaces where .codex is intentionally read-only.
 * All temporary files are removed on normal exit.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { commandExists, runProcess } from './lib/process-runner.mjs';
import { projectFreeExecutablePath, resolveBashCommand } from './lib/bash-command.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const runtimeEnvironment = { ...process.env };
const safePath = projectFreeExecutablePath(root);
for (const name of Object.keys(runtimeEnvironment)) {
  if (name.toUpperCase() === 'PATH') delete runtimeEnvironment[name];
}
runtimeEnvironment.PATH = safePath;
// The coverage runner captures this process at its own boundary. Recursively
// instrumenting every short-lived hook child adds no maintenance-source proof
// and can make the smoke timeout under coverage-only I/O load.
delete runtimeEnvironment.NODE_V8_COVERAGE;
const bashCommand = resolveBashCommand(process.platform, runtimeEnvironment);

let failed = 0;
let skipped = 0;

async function run(label, args, options = {}) {
  const result = await runProcess(label, bashCommand, args, {
    cwd: root,
    env: options.env ? { ...runtimeEnvironment, ...options.env } : runtimeEnvironment,
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
  const workspaceWrapper = [
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
  const systemTempWrapper = [
    'set -euo pipefail',
    `tmp_root="$(mktemp -d "${'$'}{NOVA_RUNTIME_SMOKE_TMPDIR%/}/${tmpRootName}.XXXXXX")"`,
    'cleanup() { rm -rf "$tmp_root"; }',
    'trap cleanup EXIT',
    'script="$tmp_root/case.sh"',
    'cat > "$script" <<\'NOVA_RUNTIME_SMOKE_SCRIPT\'',
    script,
    'NOVA_RUNTIME_SMOKE_SCRIPT',
    'chmod +x "$script"',
    '"$script"',
    '',
  ].join('\n');
  const useWorkspaceTemp = process.platform === 'win32';
  await run(label, ['-s'], {
    ...options,
    env: useWorkspaceTemp ? options.env : { ...options.env, NOVA_RUNTIME_SMOKE_TMPDIR: tmpdir() },
    input: useWorkspaceTemp ? workspaceWrapper : systemTempWrapper,
  });
}

async function runNode(label, args, options = {}) {
  const result = await runProcess(label, process.execPath, args, {
    cwd: root,
    env: options.env ? { ...runtimeEnvironment, ...options.env } : runtimeEnvironment,
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
      env: { ...runtimeEnvironment, CLAUDE_PLUGIN_DATA: tmpRoot },
      input: payload,
      timeoutMs: 60_000,
    });
    await runProcess('compact node audit spool', process.execPath, [
      'nova-plugin/hooks/scripts/audit-compactor.mjs',
    ], {
      cwd: root,
      env: { ...runtimeEnvironment, CLAUDE_PLUGIN_DATA: tmpRoot },
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

async function runNodePreBashSmokes() {
  const stateTemp = mkdtempSync(resolve(tmpdir(), 'nova-runtime-smoke-hook-state-'));
  const isolatedTempEnv = { TMPDIR: stateTemp, TMP: stateTemp, TEMP: stateTemp };
  try {
    await runNode('node pre-bash hook blocks redirection bypass', [
      'nova-plugin/hooks/scripts/pre-bash-check.mjs',
    ], {
      env: isolatedTempEnv,
      input: JSON.stringify({ session_id: 'runtime-smoke-block', tool_name: 'Bash', tool_input: { command: 'cat input > output' } }),
      expectFailure: true,
      outputPattern: /shell composition, expansion, redirection/,
    });

    await runNode('node pre-bash hook allows a bounded validation command', [
      'nova-plugin/hooks/scripts/pre-bash-check.mjs',
    ], {
      env: isolatedTempEnv,
      input: JSON.stringify({ session_id: 'runtime-smoke-allow', tool_name: 'Bash', tool_input: { command: 'npm run validate' } }),
    });
  } finally {
    rmSync(stateTemp, { recursive: true, force: true });
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

await runNodePreBashSmokes();

await runNodePostAuditSmoke();

if (!(await commandExists(bashCommand, ['--version'], { cwd: root, env: runtimeEnvironment }))) {
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

await runTempBash('codex env-node launcher strips probe credentials and pins identity', `
tmp="$(dirname "$0")/bin"
mkdir "$tmp"
real_node="$(command -v node)"
log="$(dirname "$0")/codex.log"
marker="$(dirname "$0")/replacement-ran"
cat > "$tmp/codex" <<'EOF'
#!/usr/bin/env node
const fs = require('node:fs');
const mode = process.argv[2] || '';
const values = [process.env.OPENAI_API_KEY, process.env.GH_TOKEN, process.env.NPM_TOKEN]
  .map((value) => value || '<unset>').join('|');
fs.appendFileSync(process.env.NOVA_TEST_LOG, mode + ':' + values + '\\n');
if (mode === '--version') console.log('codex-cli test');
else console.log('offline fake codex');
EOF
chmod +x "$tmp/codex"
PATH="$tmp:\${real_node%/*}:/usr/bin:/bin"
export NOVA_TEST_LOG="$log"
export OPENAI_API_KEY=probe-openai-secret GH_TOKEN=probe-gh-secret NPM_TOKEN=probe-npm-secret
source nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh
ensure_git_repo
ensure_codex_available
[ "$CODEX_LAUNCH_KIND" = node-script ]
grep -q -- '--version:<unset>|<unset>|<unset>' "$log"
! grep -q 'probe-.*-secret' "$log"
codex_invoke exec >/dev/null
grep -q 'exec:probe-openai-secret|probe-gh-secret|probe-npm-secret' "$log"
cat > "$tmp/replacement" <<EOF
#!/usr/bin/env node
require('node:fs').writeFileSync('$marker', 'ran');
console.log('replacement');
EOF
chmod +x "$tmp/replacement"
mv -f "$tmp/replacement" "$tmp/codex"
if codex_invoke exec >/dev/null 2>&1; then exit 1; fi
[ ! -e "$marker" ]
`);

await runTempBash('node_executable resolves a native physical Node outside the workspace', `
source nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh
ensure_git_repo
node_bin="$(node_executable)"
[ "\${node_bin#/}" != "$node_bin" ]
nova_native_executable_format "$node_bin"
case "$node_bin" in "$NOVA_WORKSPACE_ROOT"|"$NOVA_WORKSPACE_ROOT"/*) exit 1 ;; esac
`);

await runTempBash('codex native launcher is pinned and identity-checked', `
tmp="$(dirname "$0")/native-bin"
mkdir "$tmp"
real_git="$(command -v git)"
cp "$real_git" "$tmp/codex.exe"
chmod +x "$tmp/codex.exe"
PATH="$tmp:/usr/bin:/bin"
source nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh
ensure_git_repo
ensure_codex_available
[ "$CODEX_LAUNCH_KIND" = native ]
codex_invoke --version | grep -q 'git version'
`);

await runTempBash('node_executable rejects Node older than 22', `
tmp="$(dirname "$0")/bin"
mkdir "$tmp"
printf '%s\\n' '#!/usr/bin/env bash' 'echo "v21.99.0"' > "$tmp/node"
chmod +x "$tmp/node"
PATH="$tmp:/usr/bin:/bin"
source nova-plugin/runtime/bash-common.sh
nova_node_command
`, { expectFailure: true });

await runTempBash('node resolver rejects a workspace PATH shadow without probing it', `
helper="$PWD/nova-plugin/runtime/bash-common.sh"
workspace="$(dirname "$0")/node-workspace"
mkdir -p "$workspace/bin"
marker="$workspace/probed"
printf '%s\\n' '#!/usr/bin/env bash' "printf probed > '$marker'" 'printf v99.0.0' > "$workspace/bin/node"
chmod +x "$workspace/bin/node"
cd "$workspace"
PATH="$workspace/bin:/usr/bin:/bin"
source "$helper"
if nova_node_command "$workspace" >/dev/null 2>&1; then exit 1; fi
[ ! -e "$marker" ]
`);

await runTempBash('ensure_codex_available rejects unusable shim', `
tmp="$(dirname "$0")/bin"
mkdir "$tmp"
printf '%s\\n' '#!/usr/bin/env bash' 'echo "fake runtime: node: not found" >&2' 'exit 0' > "$tmp/codex"
chmod +x "$tmp/codex"
PATH="$tmp:/usr/bin:/bin"
source nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh
ensure_codex_available
`, { expectFailure: true, outputPattern: /未找到可运行的 codex 命令|not found/ });

await runTempBash('Codex common bootstrap returns or exits with status 2', `
helper="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh"
if (export BASH_ENV=/dev/null; source "$helper") >/dev/null 2>&1; then
  exit 1
else
  sourced_status=$?
fi
[ "$sourced_status" -eq 2 ]
if BASH_ENV=/dev/null /bin/bash "$helper" >/dev/null 2>&1; then
  exit 1
else
  executed_status=$?
fi
[ "$executed_status" -eq 2 ]
`);

await runTempBash('Codex entry rejects inherited Bash functions before external commands', `
codex() { printf 'unexpected function execution\\n' >&2; }
export -f codex
bash nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh --help
`, { expectFailure: true, outputPattern: /拒绝继承 Bash 函数/ });

await runTempBash('Codex entry rejects a workspace PATH shadow before execution', `
entry="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh"
tmp="$(dirname "$0")/workspace"
mkdir -p "$tmp/bin"
printf '%s\\n' '#!/usr/bin/env bash' 'printf shadow-ran > ../shadow-ran' > "$tmp/bin/codex"
chmod +x "$tmp/bin/codex"
cd "$tmp"
PATH="$tmp/bin:/usr/bin:/bin" bash "$entry" --help
`, { expectFailure: true, outputPattern: /工作区内 PATH 组件/ });

await runTempBash('Codex entry rejects empty and relative PATH components', `
entry="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-review.sh"
if PATH=":/usr/bin:/bin" /bin/bash "$entry" --help >/dev/null 2>&1; then exit 1; fi
if PATH="relative-bin:/usr/bin:/bin" /bin/bash "$entry" --help >/dev/null 2>&1; then exit 1; fi
`);

await runTempBash('critical file and Git helpers ignore external PATH shadows', `
helper="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh"
base="$(dirname "$0")/boundary"
fake_bin="$base/fake-bin"
repo="$base/repo"
marker="$base/shadow-ran"
mkdir -p "$fake_bin" "$repo"
git init -q "$repo"
printf '%s\\n' '#!/usr/bin/env bash' "printf '%s\\n' fsmonitor >> '$marker'" 'exit 0' > "$base/fsmonitor"
chmod +x "$base/fsmonitor"
git -C "$repo" config core.fsmonitor "$base/fsmonitor"
for name in dirname git stat cat mv; do
  printf '%s\\n' '#!/usr/bin/env bash' "printf '%s\\\\n' '$name' >> '$marker'" 'exit 99' > "$fake_bin/$name"
  chmod +x "$fake_bin/$name"
done
cd "$repo"
PATH="$fake_bin:/usr/bin:/bin"
source "$helper"
ensure_git_repo
trusted_git status --short >/dev/null
[ "$(path_dirname alpha/beta)" = alpha ]
printf 'source-data\\n' > source.txt
atomic_copy_output_file source.txt .codex/codex-review-fix/artifacts/copied.txt
/usr/bin/grep -qx source-data .codex/codex-review-fix/artifacts/copied.txt
[ ! -e "$marker" ]
"$TRUSTED_GIT_BIN" -C "$repo" config filter.nova.clean "$base/fsmonitor"
if (ensure_git_repo >/dev/null 2>&1); then exit 1; fi
[ ! -e "$marker" ]
`);

await runTempBash('stat identity and link count use the host-specific fixed style', `
source nova-plugin/runtime/bash-common.sh
tmp_file="$(dirname "$0")/identity.txt"
printf 'identity\\n' > "$tmp_file"
identity="$(nova_file_identity "$tmp_file")"
links="$(nova_file_link_count "$tmp_file")"
[ -n "$identity" ]
[ "$links" = 1 ]
`);

await runTempBash('GNU stat style uses -c without a BSD -f probe', `
source nova-plugin/runtime/bash-common.sh
fake_stat="$(dirname "$0")/gnu-stat"
log="$(dirname "$0")/gnu-stat.log"
export NOVA_FAKE_STAT_LOG="$log"
cat > "$fake_stat" <<'EOF'
#!/usr/bin/env bash
printf '%s\\n' "$1" >> "$NOVA_FAKE_STAT_LOG"
case "$2" in
  '%h') printf '1\\n' ;;
  *) printf '1:2:81a4:3:4:5\\n' ;;
esac
EOF
chmod +x "$fake_stat"
NOVA_TRUSTED_STAT_BIN="$fake_stat"
NOVA_STAT_STYLE=gnu
[ "$(nova_file_link_count ignored)" = 1 ]
[ -n "$(nova_file_identity ignored)" ]
[ "$(grep -c -- '^-c$' "$log")" = 2 ]
! grep -q -- '^-f$' "$log"
`);

await runTempBash('write_untracked_diff includes untracked file content', `
helper="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh"
tmp_repo="$(dirname "$0")/repo"
mkdir "$tmp_repo"
git init -q "$tmp_repo"
cd "$tmp_repo"
tmp_file="untracked-smoke.txt"
diff_file=".codex/codex-review-fix/artifacts/untracked.diff"
printf '%s\\n' 'untracked smoke content' > "$tmp_file"
source "$helper"
ensure_git_repo
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
diff_file=".codex/codex-review-fix/artifacts/untracked.diff"
secret_tail="cccccccccccccccccccccccc"
printf '%s\\n' "OPENAI_API_KEY=sk-proj-\${secret_tail}" > "$tmp_file"
source "$helper"
ensure_git_repo
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

await runTempBash('artifact output paths reject repository source targets', `
helper="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh"
tmp_repo="$(dirname "$0")/repo"
mkdir "$tmp_repo"
git init -q "$tmp_repo"
cd "$tmp_repo"
source "$helper"
resolve_output_path "package.json"
`, { expectFailure: true, outputPattern: /必须位于.*\.codex\/codex-review-fix/ });

await runTempBash('artifact output paths reject glob metacharacters without expansion', `
helper="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh"
tmp_repo="$(dirname "$0")/repo"
mkdir "$tmp_repo"
git init -q "$tmp_repo"
cd "$tmp_repo"
source "$helper"
resolve_output_path ".codex/codex-review-fix/*/report.txt"
`, { expectFailure: true, outputPattern: /保守的 ASCII 路径组件/ });

await runTempBash('artifact output files reject hard links', `
helper="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh"
tmp_repo="$(dirname "$0")/repo"
mkdir "$tmp_repo"
git init -q "$tmp_repo"
cd "$tmp_repo"
source "$helper"
mkdir -p .codex/codex-review-fix/artifacts
printf 'source\n' > source.txt
ln source.txt .codex/codex-review-fix/artifacts/report.txt
prepare_output_file ".codex/codex-review-fix/artifacts/report.txt"
`, { expectFailure: true, outputPattern: /硬链接|链接数/ });

await runTempBash('atomic artifact output rejects a swapped final symlink without touching its source', `
helper="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh"
tmp_repo="$(dirname "$0")/repo"
mkdir "$tmp_repo"
git init -q "$tmp_repo"
cd "$tmp_repo"
source "$helper"
printf '%s\n' 'source-preserved' > source.txt
target=".codex/codex-review-fix/artifacts/report.txt"
begin_output_file "$target"
printf '%s\n' 'artifact-data' >&9
ln -s "$PWD/source.txt" "$target"
if (finish_output_file); then
  printf '%s\n' 'swapped target unexpectedly published' >&2
  exit 1
fi
grep -qx 'source-preserved' source.txt
abort_active_output
printf '%s\n' 'swapped final target rejected and source preserved'
`, { outputPattern: /swapped final target rejected and source preserved/ });

await runTempBash('atomic artifact output binds the staging path to its held descriptor', `
helper="$PWD/nova-plugin/skills/nova-codex-review-fix/scripts/codex-common.sh"
tmp_repo="$(dirname "$0")/repo"
mkdir "$tmp_repo"
git init -q "$tmp_repo"
cd "$tmp_repo"
source "$helper"
printf '%s\n' 'source-preserved' > source.txt
target=".codex/codex-review-fix/artifacts/report.txt"
begin_output_file "$target"
printf '%s\n' 'artifact-data' >&9
saved="\${ACTIVE_OUTPUT_STAGING}.saved"
mv "$ACTIVE_OUTPUT_STAGING" "$saved"
ln -s "$PWD/source.txt" "$ACTIVE_OUTPUT_STAGING"
if (finish_output_file); then
  printf '%s\n' 'swapped staging path unexpectedly published' >&2
  exit 1
fi
grep -qx 'source-preserved' source.txt
abort_active_output
rm -f "$saved"
printf '%s\n' 'held descriptor mismatch rejected and source preserved'
`, { outputPattern: /held descriptor mismatch rejected and source preserved/ });

console.log(`Summary: failed=${failed} skipped=${skipped}`);
if (failed > 0) process.exit(1);

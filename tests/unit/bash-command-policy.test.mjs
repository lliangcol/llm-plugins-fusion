import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBashCommand } from '../../nova-plugin/hooks/scripts/pre-bash-check.mjs';

test('Bash policy allows bounded validation and read-only inspection commands', () => {
  for (const command of ['npm test', 'npm run validate', 'node scripts/validate-all.mjs', 'git status --short', 'git diff --check', 'bash -n script.sh']) {
    assert.deepEqual(validateBashCommand(command), [], command);
  }
});

test('Bash policy blocks common write-bypass and composition forms', () => {
  for (const command of ['cat secret > file', 'sed -i s/a/b/ file', 'python3 -c "open(\'x\',\'w\')"', 'git reset --hard', 'npm exec tool', 'node -e "writeFileSync(\'x\')"', 'npm test && rm -rf .']) {
    assert.notDeepEqual(validateBashCommand(command), [], command);
  }
});

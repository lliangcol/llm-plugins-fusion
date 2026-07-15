import { posix, win32 } from 'node:path';
import { hasSensitiveText } from '../../nova-plugin/runtime/secret-rules.mjs';

const forbiddenKeys = new Set([
  'authorization',
  'credentials',
  'errorMessage',
  'modelResponse',
  'observedOutput',
  'parseError',
  'prompt',
  'rawModelResponse',
  'rawPrompt',
  'rawResponse',
  'response',
  'stderr',
  'stdout',
]);

function containsAbsolutePath(value) {
  if (win32.isAbsolute(value) || posix.isAbsolute(value)) return true;
  return /(?:^|[\s"'=(])(?:[A-Za-z]:[\\/]|\\\\[^\\\s]+[\\/]|\/(?:home|Users|tmp|var|private|opt|mnt|workspace|root)\/)/u.test(value);
}

export function publicEvidenceViolations(value) {
  const violations = [];
  const visit = (current, path) => {
    if (Array.isArray(current)) {
      current.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (current && typeof current === 'object') {
      for (const [key, entry] of Object.entries(current)) {
        if (forbiddenKeys.has(key)) violations.push(`${path}.${key}: forbidden evidence field`);
        visit(entry, `${path}.${key}`);
      }
      return;
    }
    if (typeof current === 'string' && containsAbsolutePath(current)) violations.push(`${path}: local absolute path`);
  };
  visit(value, '$');
  if (hasSensitiveText(JSON.stringify(value))) violations.push('$: credential or secret pattern');
  return violations;
}

export function assertPublicEvidenceSafe(value) {
  const violations = publicEvidenceViolations(value);
  if (violations.length) throw new Error(`public evidence privacy violation: ${violations.join('; ')}`);
  return value;
}

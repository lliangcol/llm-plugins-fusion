import { isAbsolute, posix, win32 } from 'node:path';

export const WORKFLOW_CONTRACT_PATH_PATTERN_SOURCE = /^(?!(?:.*\/)?(?:[cC][oO][nN]|[pP][rR][nN]|[aA][uU][xX]|[nN][uU][lL]|[cC][lL][oO][cC][kK]\$|[cC][oO][nN][iI][nN]\$|[cC][oO][nN][oO][uU][tT]\$|[cC][oO][mM][1-9]|[lL][pP][tT][1-9])(?:[ .]|\/|$))(?!.*[. ](?:\/|$))[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/u.source;

const workflowContractPathPattern = new RegExp(WORKFLOW_CONTRACT_PATH_PATTERN_SOURCE, 'u');

/** Validate a portable relative path before host normalization can hide ambiguity. */
export function assertPortableRelativePath(value, label = 'path') {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.includes('\\')
    || /^[A-Za-z]:/u.test(value)
    || isAbsolute(value)
    || posix.isAbsolute(value)
    || win32.isAbsolute(value)
    || /\p{Cc}/u.test(value)
  ) {
    throw new Error(`${label} is not a portable relative path: ${value}`);
  }
  const components = value.split('/');
  if (components.some((component) => component === '' || component === '.' || component === '..')) {
    throw new Error(`${label} contains traversal, dot, or empty components: ${value}`);
  }
  if (components.some((component) => (
    /[<>:"|?*]/u.test(component)
    || /[. ]$/u.test(component)
    || /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:[ .]|$)/iu.test(component)
  ))) {
    throw new Error(`${label} contains a Windows-reserved or non-portable component: ${value}`);
  }
  return value;
}

/** Validate the narrower ASCII path grammar used by workflow contractPath. */
export function assertPortableWorkflowContractPath(value, label = 'workflow contractPath') {
  if (typeof value !== 'string' || !workflowContractPathPattern.test(value)) {
    throw new Error(`${label} is not an ASCII portable workflow contract path: ${String(value)}`);
  }
  return value;
}

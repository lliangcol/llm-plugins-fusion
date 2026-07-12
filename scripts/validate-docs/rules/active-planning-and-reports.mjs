import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

function expectedCurrentMinorRange(version) {
  const match = /^(\d+)\.(\d+)\.\d+(?:[-+].*)?$/.exec(version);
  if (!match) return null;
  return `${match[1]}.${match[2]}.x`;
}

function shouldSkipStalePlanningScan(absPath, context) {
  const relPath = context.rel(absPath);
  return relPath === 'CHANGELOG.md'
    || context.isArchivePath(absPath)
    || context.hasPathSegments(absPath, context.HISTORY_SEGMENTS)
    || /^Status:\s*archived\b/imu.test(readFileSync(absPath, 'utf8'));
}

export function validateSecuritySupportRange(context) {
  const releaseChannels = context.readJson('governance/release-channels.json');
  const expectedRange = expectedCurrentMinorRange(releaseChannels.stable.version);
  if (!expectedRange) {
    context.recordError('governance/release-channels.json', `stable version "${releaseChannels.stable.version}" cannot derive current MINOR support range`);
    return;
  }

  const file = 'SECURITY.md';
  const src = readFileSync(resolve(context.root, file), 'utf8');
  const match = src.match(/最新 MINOR 版本（当前 `([^`]+)`）/);
  if (!match) {
    context.recordError(file, 'missing current MINOR support range in security policy');
    return;
  }
  if (match[1] !== expectedRange) {
    context.recordError(file, `current MINOR support range is "${match[1]}", expected "${expectedRange}" from stable channel ${releaseChannels.stable.version}`);
  }
}

export function validateStaleActivePlanningLabels(context) {
  const markdownFiles = context.walkFiles(context.root, (abs) => extname(abs).toLowerCase() === '.md')
    .filter((abs) => !shouldSkipStalePlanningScan(abs, context));

  for (const file of markdownFiles) {
    const src = context.stripFencedCode(readFileSync(file, 'utf8'));
    for (const { pattern, message } of context.STALE_ACTIVE_PLANNING_PATTERNS) {
      pattern.lastIndex = 0;
      for (const match of src.matchAll(pattern)) {
        context.recordError(context.rel(file), `line ${context.lineNumberAt(src, match.index ?? 0)} has ${message}`);
      }
    }
  }
}

export function validateReports(context) {
  const reportsDir = resolve(context.root, 'docs/reports');
  if (!existsSync(reportsDir)) return;
  const reportFiles = context.walkFiles(reportsDir, (abs) => extname(abs).toLowerCase() === '.md')
    .filter((abs) => !context.isArchivePath(abs));
  const historyMarker = /\b(historical|archived)\b|历史|已归档|归档/i;
  for (const file of reportFiles) {
    const src = readFileSync(file, 'utf8');
    if (!historyMarker.test(src)) {
      context.recordError(
        context.rel(file),
        'non-archived report must include an explicit historical/archived status marker',
      );
    }
  }
}

export function validateActivePlanningAndReports(context) {
  validateSecuritySupportRange(context);
  validateStaleActivePlanningLabels(context);
  validateReports(context);
}

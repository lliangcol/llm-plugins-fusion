export const DEFAULT_COVERAGE_THRESHOLDS = Object.freeze({
  lines: 85,
  branches: 60,
  functions: 90,
});

function percentage(value, label) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    throw new Error(`${label} must be a percentage between 0 and 100`);
  }
  return numeric;
}

export function resolveCoverageThresholds(env = process.env) {
  return {
    lines: percentage(env.NOVA_COVERAGE_LINES ?? DEFAULT_COVERAGE_THRESHOLDS.lines, 'NOVA_COVERAGE_LINES'),
    branches: percentage(env.NOVA_COVERAGE_BRANCHES ?? DEFAULT_COVERAGE_THRESHOLDS.branches, 'NOVA_COVERAGE_BRANCHES'),
    functions: percentage(env.NOVA_COVERAGE_FUNCTIONS ?? DEFAULT_COVERAGE_THRESHOLDS.functions, 'NOVA_COVERAGE_FUNCTIONS'),
  };
}

export function parseCoverageSummary(output) {
  const line = output
    .split(/\r?\n/)
    .findLast((candidate) => /\ball files\s*\|/i.test(candidate));
  if (!line) return null;
  const columns = line.split('|').slice(1, 4).map((value) => Number(value.trim()));
  if (columns.length !== 3 || columns.some((value) => !Number.isFinite(value))) return null;
  return { lines: columns[0], branches: columns[1], functions: columns[2] };
}

export function parseCoverageFileRows(output) {
  const rows = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/(?:^|[ℹ#]\s+)\s*([A-Za-z0-9_.-]+\.mjs)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)/);
    if (!match) continue;
    rows.set(match[1], { lines: Number(match[2]), branches: Number(match[3]), functions: Number(match[4]) });
  }
  return rows;
}

export function criticalCoverageFailures(rows, requirements) {
  const failures = [];
  for (const [module, required] of Object.entries(requirements)) {
    const actual = rows.get(module);
    if (!actual) {
      failures.push(`${module} coverage row is missing`);
      continue;
    }
    for (const metric of ['lines', 'branches', 'functions']) {
      if (actual[metric] < required[metric]) failures.push(`${module} ${metric} coverage ${actual[metric]}% is below required ${required[metric]}%`);
    }
  }
  return failures;
}

export function coverageThresholdFailures(actual, required) {
  return ['lines', 'branches', 'functions']
    .filter((metric) => actual[metric] < required[metric])
    .map((metric) => `${metric} coverage ${actual[metric]}% is below required ${required[metric]}%`);
}

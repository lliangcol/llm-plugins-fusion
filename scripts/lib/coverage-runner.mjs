import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { requireOptionValue } from './cli-args.mjs';
import {
  criticalCoverageFailures,
  coverageThresholdFailures,
  parseCoverageFileRows,
  parseCoverageSummary,
  resolveCoverageThresholds,
} from './coverage-thresholds.mjs';
import {
  loadedSourceModules,
  missingCoverageSources,
  sourceModuleInventory,
} from './source-inventory.mjs';
import { relativeTestFiles } from './test-discovery.mjs';

export function usage() {
  return `Usage: node scripts/run-test-coverage.mjs [--check] [--coverage-dir <path>]

Runs node --test --experimental-test-coverage for the repository test suite.
Coverage output is local runtime evidence and is written under .metrics/ by
default. --check verifies coverage collection and test success, requires every
maintenance MJS source to load, and enforces lines 85%, branches 60%, and
functions 90%.

Optional --check threshold overrides:
  NOVA_COVERAGE_LINES
  NOVA_COVERAGE_BRANCHES
  NOVA_COVERAGE_FUNCTIONS`;
}

export function parseCoverageArgs(args, root) {
  const options = {
    check: false,
    help: false,
    coverageDir: resolve(root, '.metrics/coverage'),
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--check') {
      options.check = true;
      continue;
    }
    if (arg === '--coverage-dir') {
      options.coverageDir = resolve(root, requireOptionValue(args, index, '--coverage-dir'));
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

export function coverageCommand(testFiles) {
  return ['--test', '--experimental-test-coverage', ...testFiles];
}

export function prepareCoverageDirectory(
  coverageDir,
  { remove = rmSync, makeDirectory = mkdirSync } = {},
) {
  const v8Dir = resolve(coverageDir, 'v8');
  remove(v8Dir, { recursive: true, force: true });
  makeDirectory(v8Dir, { recursive: true });
  return v8Dir;
}

export function runCoverage({
  root,
  args = [],
  env = process.env,
  runner = spawnSync,
  now = () => new Date(),
} = {}) {
  let options;
  try {
    options = parseCoverageArgs(args, root);
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    console.error(usage());
    return 1;
  }
  if (options.help) {
    console.log(usage());
    return 0;
  }

  let thresholds = null;
  if (options.check) {
    try {
      thresholds = resolveCoverageThresholds(env);
    } catch (error) {
      console.error(`ERROR ${error.message}`);
      return 1;
    }
  }
  const testFiles = relativeTestFiles(root, 'all');
  if (testFiles.length === 0) {
    console.error('ERROR no test files found under tests/');
    return 1;
  }

  const v8Dir = resolve(options.coverageDir, 'v8');
  const summaryPath = resolve(options.coverageDir, 'coverage-summary.txt');
  const metadataPath = resolve(options.coverageDir, 'metadata.json');
  prepareCoverageDirectory(options.coverageDir);
  const commandArgs = coverageCommand(testFiles);

  console.log(`Running coverage command: ${process.execPath} ${commandArgs.join(' ')}`);
  console.log(`Coverage evidence directory: ${relative(root, options.coverageDir)}`);
  if (options.check) {
    console.log(`Coverage thresholds: lines=${thresholds.lines} branches=${thresholds.branches} functions=${thresholds.functions}`);
  } else {
    console.log('Coverage thresholds: not enforced; collection-only mode is active.');
  }

  const startedAt = now().toISOString();
  const result = runner(process.execPath, commandArgs, {
    cwd: root,
    env: { ...env, NODE_V8_COVERAGE: v8Dir },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: false,
  });
  const completedAt = now().toISOString();
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  writeFileSync(summaryPath, [
    `command=${process.execPath} ${commandArgs.join(' ')}`,
    `check=${options.check}`,
    `thresholds=${thresholds ? JSON.stringify(thresholds) : 'not enforced'}`,
    `exitCode=${result.status ?? 'null'}`,
    `signal=${result.signal ?? ''}`,
    `startedAt=${startedAt}`,
    `completedAt=${completedAt}`,
    '', '--- stdout ---', stdout, '', '--- stderr ---', stderr,
  ].join('\n'), 'utf8');
  writeFileSync(metadataPath, `${JSON.stringify({
    command: [process.execPath, ...commandArgs],
    check: options.check,
    thresholds: thresholds ?? [],
    exitCode: result.status,
    signal: result.signal,
    startedAt,
    completedAt,
    coverageDir: relative(root, options.coverageDir).replaceAll('\\', '/'),
    v8Dir: relative(root, v8Dir).replaceAll('\\', '/'),
    summaryPath: relative(root, summaryPath).replaceAll('\\', '/'),
    node: process.version,
  }, null, 2)}\n`, 'utf8');

  if (result.error) {
    console.error(`ERROR failed to run coverage command: ${result.error.message}`);
    return 1;
  }
  if (result.status !== 0) return result.status ?? 1;
  if (!options.check) {
    console.log(`Coverage evidence written to ${relative(root, options.coverageDir)}`);
    return 0;
  }
  if (!stdout.includes('start of coverage report')) {
    console.error('ERROR coverage report marker was not found in test output');
    return 1;
  }
  const actual = parseCoverageSummary(stdout);
  if (!actual) {
    console.error('ERROR all-files coverage summary was not found in test output');
    return 1;
  }
  const thresholdFailures = coverageThresholdFailures(actual, thresholds);
  if (thresholdFailures.length > 0) {
    for (const failure of thresholdFailures) console.error(`ERROR ${failure}`);
    return 1;
  }
  const criticalConfig = JSON.parse(readFileSync(resolve(root, 'governance/critical-coverage.json'), 'utf8'));
  const criticalFailures = criticalCoverageFailures(parseCoverageFileRows(stdout), criticalConfig.modules);
  if (criticalFailures.length > 0) {
    for (const failure of criticalFailures) console.error(`ERROR ${failure}`);
    return 1;
  }

  const coverageFiles = readdirSync(v8Dir).filter((entry) => entry.endsWith('.json'));
  if (coverageFiles.length === 0) {
    console.error('ERROR NODE_V8_COVERAGE did not produce raw coverage JSON');
    return 1;
  }
  const expectedSources = sourceModuleInventory(root);
  const loadedSources = loadedSourceModules(v8Dir, root);
  const missingSources = missingCoverageSources(expectedSources, loadedSources);
  if (missingSources.length > 0) {
    for (const source of missingSources) console.error(`ERROR coverage source was not loaded: ${source}`);
    return 1;
  }

  console.log(`Coverage baseline passed: lines=${actual.lines} branches=${actual.branches} functions=${actual.functions}`);
  console.log(`Critical module coverage passed: ${Object.keys(criticalConfig.modules).length} per-module floors`);
  console.log(`Coverage source inventory passed: ${expectedSources.length}/${expectedSources.length} maintenance modules loaded`);
  console.log(`Coverage evidence written to ${relative(root, options.coverageDir)}`);
  return 0;
}

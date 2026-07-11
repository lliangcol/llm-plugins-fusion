#!/usr/bin/env node
/** Run the dependency-free repository coverage gate. */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import { runCoverage } from './lib/coverage-runner.mjs';

assertNodeVersion({ label: 'test coverage' });

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.exitCode = runCoverage({ root, args: process.argv.slice(2) });

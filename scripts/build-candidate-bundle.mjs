#!/usr/bin/env node
/** Build a deterministic candidate evidence bundle using the repository tar writer. */

import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deterministicTar } from './build-release-artifacts.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';

const deterministicGzipOptions = /** @type {import('node:zlib').ZlibOptions} */ ({ level: 9, mtime: 0 });

export function main(args = process.argv.slice(2)) {
  try {
    let bundleRoot;
    let out;
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      const value = () => requireOptionValue(args, index, arg);
      if (arg === '--bundle-root') bundleRoot = resolve(value());
      else if (arg === '--out') out = resolve(value());
      else throw new Error(`unknown argument: ${arg}`);
      index += 1;
    }
    if (!bundleRoot || !out) throw new Error('--bundle-root and --out are required');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, gzipSync(deterministicTar(bundleRoot), deterministicGzipOptions));
    console.log(`Wrote ${out}`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();

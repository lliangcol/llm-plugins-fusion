#!/usr/bin/env node
/** Safely extract an authenticated candidate or control bundle. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractSafeTarGz } from './lib/safe-tar.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';

export function main(args = process.argv.slice(2)) {
  try {
    let archive;
    let out;
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      const value = () => requireOptionValue(args, index, arg);
      if (arg === '--archive') archive = resolve(value());
      else if (arg === '--out') out = resolve(value());
      else throw new Error(`unknown argument: ${arg}`);
      index += 1;
    }
    if (!archive || !out) throw new Error('--archive and --out are required');
    const entries = extractSafeTarGz(readFileSync(archive), out);
    console.log(`Extracted ${entries.length} regular/directory entries`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();

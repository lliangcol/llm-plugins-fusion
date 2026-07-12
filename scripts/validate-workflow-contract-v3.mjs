#!/usr/bin/env node
/** Deprecated compatibility entrypoint. Use validate-workflow-contract-v4.mjs. */
import { pathToFileURL } from 'node:url';
import { main } from './validate-workflow-contract-v4.mjs';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

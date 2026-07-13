#!/usr/bin/env node
/** One explicit-identity release state machine for promote, recover, and drill. */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalSha256 } from './lib/canonical-json.mjs';
import { appendReleaseLedger, createReleaseLedger, planReleaseTransitions, verifyReleaseLedger } from './lib/release-state-machine.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parseReleaseOrchestratorArgs(args) {
  const options = { mode: null, state: null, targetState: null, stableTag: null, candidateTag: null, sourceCommit: null, promotionIntent: null, controlBundle: null, eventDir: null, runId: null, dryRun: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') { options.dryRun = true; continue; }
    const value = () => requireOptionValue(args, index, arg);
    if (arg === '--mode') options.mode = value();
    else if (arg === '--state') options.state = value();
    else if (arg === '--target-state') options.targetState = value();
    else if (arg === '--stable-tag') options.stableTag = value();
    else if (arg === '--candidate-tag') options.candidateTag = value();
    else if (arg === '--source-commit') options.sourceCommit = value();
    else if (arg === '--promotion-intent') options.promotionIntent = resolve(root, value());
    else if (arg === '--control-bundle') options.controlBundle = resolve(root, value());
    else if (arg === '--event-dir') options.eventDir = resolve(root, value());
    else if (arg === '--run-id') options.runId = value();
    else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  for (const key of ['mode', 'state', 'targetState', 'stableTag', 'candidateTag', 'sourceCommit', 'promotionIntent', 'controlBundle', 'eventDir', 'runId']) {
    if (!options[key]) throw new Error(`missing required release identity option: ${key}`);
  }
  if (!['promote', 'recover', 'drill'].includes(options.mode)) throw new Error('mode must be promote, recover, or drill');
  if (!/^[a-f0-9]{40}$/u.test(options.sourceCommit)) throw new Error('source commit must be a full Git SHA');
  return options;
}

export function orchestrateRelease(options, now = () => new Date()) {
  const intentText = readFileSync(options.promotionIntent, 'utf8');
  const intent = JSON.parse(intentText);
  const controlText = readFileSync(options.controlBundle, 'utf8');
  const control = JSON.parse(controlText);
  if (intent.stableTag !== options.stableTag || intent.candidateTag !== options.candidateTag || intent.sourceCommit !== options.sourceCommit) {
    throw new Error('explicit release identity differs from promotion intent');
  }
  if (intent.controlBundleSha256 !== control.bundleSha256) throw new Error('promotion intent differs from the release control bundle');
  const transitions = planReleaseTransitions(options.state, options.targetState);
  const identity = {
    stableTag: options.stableTag,
    candidateTag: options.candidateTag,
    sourceCommit: options.sourceCommit,
    candidateManifestSha256: intent.candidateCoreSha256,
    controlBundleSha256: intent.controlBundleSha256,
  };
  const ledgerPath = resolve(options.eventDir, 'release-ledger.json');
  let ledger;
  if (options.state === 'DRAFT') {
    if (existsSync(ledgerPath)) throw new Error('release ledger already exists; refusing duplicate initial transition');
    ledger = createReleaseLedger(identity);
  } else {
    if (!existsSync(ledgerPath)) throw new Error('prior release ledger is required for continuation');
    ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
    const verified = verifyReleaseLedger(ledger);
    if (verified.headState !== options.state) throw new Error('requested release state differs from prior release ledger head');
  }
  const existingEventCount = ledger.events.length;
  transitions.forEach((transition) => {
    ledger = appendReleaseLedger(ledger, {
      transition,
      identity,
      inputDigests: { promotionIntent: canonicalSha256(intent) },
      outputDigests: {},
      runId: options.runId,
      createdAt: now().toISOString(),
    }, options.mode);
  });
  if (!options.dryRun) {
    mkdirSync(options.eventDir, { recursive: true });
    ledger.events.slice(existingEventCount).forEach(({ event }, index) => {
      const sequence = String(existingEventCount + index + 1).padStart(2, '0');
      writeFileSync(resolve(options.eventDir, `${sequence}-${event.transition.replace('->', '-to-').toLowerCase()}.json`), `${JSON.stringify(event, null, 2)}\n`, { flag: 'wx' });
    });
    const temporaryLedger = `${ledgerPath}.tmp-${process.pid}`;
    writeFileSync(temporaryLedger, `${JSON.stringify(ledger, null, 2)}\n`, { flag: 'wx' });
    renameSync(temporaryLedger, ledgerPath);
  }
  const appended = ledger.events.slice(existingEventCount);
  return { mode: options.mode, transitions: appended.map(({ event, sha256 }) => ({ transition: event.transition, sha256 })), ledgerHeadState: ledger.headState, ledgerHeadSha256: ledger.headSha256, controlBundle: basename(options.controlBundle) };
}

export function main(args = process.argv.slice(2)) {
  try {
    const result = orchestrateRelease(parseReleaseOrchestratorArgs(args));
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();

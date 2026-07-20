#!/usr/bin/env node
/** Block project/local Claude settings changes from taking effect mid-session. */

import { readFileSync } from 'node:fs';

function block(message) {
  console.error(`[nova-plugin] CONFIG_CHANGE_BLOCKED: ${message}`);
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  block('ConfigChange payload is not valid JSON.');
}

if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
  block('ConfigChange payload must be a JSON object.');
}
if (payload.hook_event_name !== 'ConfigChange') {
  block('Unexpected hook event for the configuration guard.');
}
if (!['project_settings', 'local_settings'].includes(payload.source)) {
  block(`Unexpected configuration source ${JSON.stringify(payload.source)}.`);
}

block(`${payload.source} changes are frozen for the active session; review the file and restart after the startup trust preflight passes.`);

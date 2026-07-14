import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const script = resolve(import.meta.dirname, '../../nova-plugin/hooks/scripts/audit-compactor.mjs');
const run = (root, ttlMs = '300000') => new Promise((resolveRun) => { const child=spawn(process.execPath,[script],{env:{...process.env,CLAUDE_PLUGIN_DATA:root,NOVA_AUDIT_LOCK_TTL_MS:ttlMs},stdio:'ignore'}); child.on('exit',(code)=>resolveRun(code)); });
function fixture(t) { const root=mkdtempSync(resolve(tmpdir(),'nova-audit-compact-')); mkdirSync(resolve(root,'audit-spool')); t.after(()=>rmSync(root,{recursive:true,force:true})); return root; }

test('audit compactor preserves a half-written record and releases its lock', async (t) => {
  const root=fixture(t); writeFileSync(resolve(root,'audit-spool/partial.json'),'{"partial":');
  assert.equal(await run(root),1); assert.deepEqual(readdirSync(resolve(root,'audit-spool')),['partial.json']);
  assert.match(readFileSync(resolve(root,'audit-health.log'),'utf8'),/(?:JSON|Expected|Unexpected)/u);
});

test('audit compactor recovers a stale interrupted lock', async (t) => {
  const root=fixture(t); const lock=resolve(root,'.audit-compact.lock'); mkdirSync(lock); writeFileSync(resolve(lock,'owner.json'),`${JSON.stringify({pid:999999,startedAt:'2000-01-01T00:00:00.000Z'})}\n`); writeFileSync(resolve(root,'audit-spool/one.json'),'{"id":1}\n');
  assert.equal(await run(root,'0'),0); assert.deepEqual(readdirSync(resolve(root,'audit-spool')),[]); assert.match(readFileSync(resolve(root,'audit.log'),'utf8'),/"id":1/u);
});

test('concurrent compactors consume each atomic record at most once', async (t) => {
  const root=fixture(t); for(let i=0;i<40;i+=1) writeFileSync(resolve(root,`audit-spool/${String(i).padStart(2,'0')}.json`),`${JSON.stringify({id:i})}\n`);
  assert.deepEqual(await Promise.all([run(root),run(root)]),[0,0]); const lines=readFileSync(resolve(root,'audit.log'),'utf8').trim().split(/\r?\n/u).map(JSON.parse); assert.equal(lines.length,40); assert.equal(new Set(lines.map(x=>x.id)).size,40);
});

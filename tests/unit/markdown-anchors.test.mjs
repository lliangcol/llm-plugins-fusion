import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  commandDocInputContractErrors,
  commandDocOutputContractErrors,
  migratedPathReferenceErrors,
  releaseHygieneSupportSourceErrors,
  repositoryDocsTreeErrors,
  routeDocContractErrors,
  stripInlineMarkdown,
  validateMarkdownLinks,
} from '../../scripts/validate-docs/rules/links-and-command-docs.mjs';

test('inline Markdown entity decoding happens exactly once', () => {
  assert.equal(stripInlineMarkdown('A &amp; B &lt; C &gt; D'), 'A & B < C > D');
  assert.equal(stripInlineMarkdown('&amp;lt;'), '&lt;');
});

test('release hygiene support-range source rejects contradictory development metadata claims', () => {
  const correct = 'current MINOR support range derived from the stable channel in `governance/release-channels.json`';
  assert.deepEqual(releaseHygieneSupportSourceErrors(correct), []);
  assert.match(
    releaseHygieneSupportSourceErrors(`${correct}\ncurrent MINOR support range derived from \`plugin.json\``).join('\n'),
    /contradicts the stable-channel source/u,
  );
  assert.match(
    releaseHygieneSupportSourceErrors('current MINOR support range derived from `plugin.json`').join('\n'),
    /must name the stable release channel/u,
  );
});

test('command doc input validation derives names and required markers from the runtime contract', () => {
  const inputs = [
    { name: 'REQUEST', required: true, aliases: ['INPUT'] },
    { name: 'CONTEXT', required: true, aliases: [] },
    { name: 'DEPTH', required: false, aliases: ['MODE'] },
  ];
  const invalid = [
    '## Parameters',
    '| Parameter | Required | Description |',
    '| --- | --- | --- |',
    '| `REQUEST` | Yes | Task |',
    '| `CONTEXT` | No | Evidence |',
    '| `OUTPUT_DIR` | No | Unsupported |',
  ].join('\n');
  assert.deepEqual(commandDocInputContractErrors(invalid, inputs), [
    'input CONTEXT required marker is false, expected true',
    'documents unknown input OUTPUT_DIR',
  ]);
  assert.deepEqual(
    commandDocInputContractErrors('### Optional\n\n- `DEPTH`: brief', inputs),
    ['missing required input REQUEST', 'missing required input CONTEXT'],
  );
  assert.deepEqual(
    commandDocInputContractErrors('### Optional\n\n- `ARGUMENTS`: free-form request', [inputs[0]]),
    ['input ARGUMENTS required marker is false, expected true'],
  );
  assert.deepEqual(
    commandDocInputContractErrors('### Required\n\n- `ARGUMENTS`: free-form request', [inputs[0]]),
    [],
  );
});

test('command doc output validation rejects no-output claims and missing fixed fields', () => {
  const output = { order: ['implemented changes', 'Validation', 'Adjustments'] };
  assert.deepEqual(
    commandDocOutputContractErrors('## Output\n\nNo fixed output structure specified.', output, { requireFields: true }),
    [
      'claims that the command has no fixed output structure',
      'manual output section is missing contract field implemented changes',
      'manual output section is missing contract field Validation',
      'manual output section is missing contract field Adjustments',
    ],
  );
  assert.deepEqual(
    commandDocOutputContractErrors(
      '## Output\n\n```markdown\n## Result\n`implemented changes` -> `Validation` -> `Adjustments`\n```',
      output,
      { requireFields: true },
    ),
    [],
  );
  assert.deepEqual(
    commandDocOutputContractErrors(
      '## Output\n\n`Adjustments` -> `Validation` -> `implemented changes`',
      output,
      { requireFields: true },
    ),
    [
      'manual output section lists contract field Validation out of order',
      'manual output section lists contract field Adjustments out of order',
    ],
  );
});

test('route docs require exactly one immediate route and reject route sequences', () => {
  assert.deepEqual(routeDocContractErrors('Always return exactly one immediate route.'), []);
  assert.deepEqual(
    routeDocContractErrors('Always return exactly one immediate route. Then return a second route for the next stage.'),
    ['must not describe a second or multiple immediate routes'],
  );
  assert.deepEqual(
    routeDocContractErrors('Always return exactly one immediate route. Do not return a second route.'),
    [],
  );
  assert.deepEqual(routeDocContractErrors('跨阶段任务输出最短序列。'), [
    'must state that routing returns exactly one immediate route',
    'must not recommend a multi-route sequence',
  ]);
});

test('repository docs trees list canonical owners instead of compatibility-stub directories', () => {
  const owners = ['getting-started', 'guides', 'project'];
  assert.deepEqual(
    repositoryDocsTreeErrors(
      ['|-- docs/', '|   |-- getting-started/', '|   |-- guides/', '|   `-- project/', '|-- scripts/'].join('\n'),
      owners,
    ),
    [],
  );
  assert.deepEqual(
    repositoryDocsTreeErrors(
      ['|-- docs/', '|   |-- agents/', '|   |-- consumers/', '|   `-- examples/', '|-- scripts/'].join('\n'),
      owners,
    ),
    ['repository docs tree owners are [agents, consumers, examples], expected [getting-started, guides, project]'],
  );
});

test('migrated path validation catches active references but preserves governed history', () => {
  const mappings = [{
    from: 'docs/old/location.md',
    to: 'docs/new/location.md',
  }];
  assert.deepEqual(
    migratedPathReferenceErrors('Use `docs/old/location.md` now.', mappings, { file: 'docs/guide.md' }),
    ['line 1 references migrated path docs/old/location.md; use docs/new/location.md'],
  );
  assert.deepEqual(
    migratedPathReferenceErrors(
      '<!-- migrated-from: docs/old/location.md -->\n- 2026-01-01: moved docs/old/location.md',
      mappings,
      { file: 'docs/new/location.md' },
    ),
    [],
  );
  assert.deepEqual(
    migratedPathReferenceErrors('Compatibility stub: `docs/old/location.md`.', mappings, { file: 'docs/README.md' }),
    [],
  );
});

test('Markdown links resolve repeated heading anchors with deduplication', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-markdown-anchor-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source.md');
  const target = join(root, 'target.md');
  await writeFile(source, '[second heading](target.md#title-1)\n', 'utf8');
  await writeFile(target, '# Title\n\n# Title\n', 'utf8');
  const errors = [];
  const context = {
    root,
    markdownAnchorsByFile: new Map(),
    stripFencedCode: (value) => value,
    walkFiles: () => [source, target],
    recordError: (...args) => errors.push(args),
    rel: (file) => relative(root, file),
    lineNumberAt: () => 1,
  };
  validateMarkdownLinks(context);
  assert.deepEqual(errors, []);
});

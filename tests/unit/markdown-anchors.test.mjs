import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  stripInlineMarkdown,
  validateMarkdownLinks,
} from '../../scripts/validate-docs/rules/links-and-command-docs.mjs';

test('inline Markdown entity decoding happens exactly once', () => {
  assert.equal(stripInlineMarkdown('A &amp; B &lt; C &gt; D'), 'A & B < C > D');
  assert.equal(stripInlineMarkdown('&amp;lt;'), '&lt;');
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

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { repositoryProfilePlan } from '../../../packages/cli/index.mjs';

const LINE_ANCHOR_PATTERN = /^L\d+(?:-L\d+)?$/i;
const HOOK_CHECKLIST_FILES = [
  'CLAUDE.md',
  'CONTRIBUTING.md',
  '.github/pull_request_template.md',
  'nova-plugin/docs/overview/README.en.md',
  'nova-plugin/docs/architecture/dual-track-design.md',
  'nova-plugin/docs/architecture/agent-development-stack.md',
  'docs/reference/security/security-review.md',
  'docs/reference/compatibility/marketplace.md',
  'docs/operations/maintainers/README.md',
  'docs/operations/maintainers/troubleshooting.md',
  'docs/templates/evidence/release.md',
  'docs/operations/releases/validation.md',
  'docs/operations/releases/hygiene.md',
  'docs/project/plans/deep-research-engineering-risk-execution-plan.md',
];

function linkTargetIsExternal(target) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target);
}

function parseLinkTarget(rawTarget) {
  let target = rawTarget.trim();
  if (!target) return null;
  if (target.startsWith('<')) {
    const end = target.indexOf('>');
    if (end === -1) return null;
    target = target.slice(1, end);
  } else {
    target = target.split(/\s+/)[0];
  }
  if (!target) return null;
  if (linkTargetIsExternal(target)) return null;
  if (target.includes('$') || target.includes('*')) return null;
  return target;
}

function stripTargetSuffix(target) {
  const hashIndex = target.indexOf('#');
  const queryIndex = target.indexOf('?');
  const cutIndexes = [hashIndex, queryIndex].filter((index) => index >= 0);
  const cutAt = cutIndexes.length ? Math.min(...cutIndexes) : target.length;
  return target.slice(0, cutAt);
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractLinkFragment(target) {
  const hashIndex = target.indexOf('#');
  if (hashIndex === -1) return null;
  const raw = target.slice(hashIndex + 1).split('?')[0];
  if (!raw) return null;
  return safeDecode(raw);
}

function resolveLocalLink(fromFile, target, root) {
  const clean = stripTargetSuffix(target);
  if (!clean && target.startsWith('#')) return fromFile;
  if (!clean) return null;
  let decoded = clean;
  try {
    decoded = decodeURI(clean);
  } catch {
    decoded = clean;
  }
  if (decoded.startsWith('/')) {
    return resolve(root, `.${decoded}`);
  }
  return resolve(dirname(fromFile), decoded);
}

function collectMarkdownLinks(src, context) {
  const links = [];
  const stripped = context.stripFencedCode(src);
  const inlinePattern = /!?\[[^\]\n]*\]\(([^)\n]+)\)/g;
  const referencePattern = /^[ \t]{0,3}\[[^\]\n]+\]:[ \t]+(\S.*)$/gm;
  const htmlPattern = /\bhref=["']([^"']+)["']/g;

  for (const match of stripped.matchAll(inlinePattern)) {
    const target = parseLinkTarget(match[1]);
    if (target) links.push({ target, index: match.index ?? 0 });
  }
  for (const match of stripped.matchAll(referencePattern)) {
    const target = parseLinkTarget(match[1]);
    if (target) links.push({ target, index: match.index ?? 0 });
  }
  for (const match of stripped.matchAll(htmlPattern)) {
    const target = parseLinkTarget(match[1]);
    if (target) links.push({ target, index: match.index ?? 0 });
  }
  return links;
}

export function stripInlineMarkdown(src) {
  return src
    .replace(/<[^>]+>/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~]/g, '')
    .replace(/&(amp|lt|gt);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>' })[entity]);
}

function slugifyAnchor(src) {
  const slug = src
    .toLowerCase()
    .replace(/[\uFE00-\uFE0F]/g, '')
    .replace(/[^\p{Letter}\p{Number}\p{Mark}\s_-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return slug || null;
}

function addSlugWithDedup(anchors, counts, slug) {
  if (!slug) return;
  const count = counts.get(slug) ?? 0;
  anchors.add(count === 0 ? slug : `${slug}-${count}`);
  counts.set(slug, count + 1);
}

function headingSlugCandidates(headingText) {
  const text = stripInlineMarkdown(headingText.replace(/\s+#+\s*$/, ''));
  const withoutEmoji = text.replace(/\p{Extended_Pictographic}/gu, '');
  const candidates = [text.trim(), withoutEmoji.trim()]
    .map((candidate) => slugifyAnchor(candidate))
    .filter(Boolean);
  return [...new Set(candidates)];
}

function collectMarkdownAnchors(file, context) {
  if (context.markdownAnchorsByFile.has(file)) return context.markdownAnchorsByFile.get(file);

  const src = readFileSync(file, 'utf8');
  const anchors = new Set();
  const headingCounts = new Map();
  const stripped = context.stripFencedCode(src);

  const htmlIdPattern = /<[a-z][^>]*\s(?:id|name)=["']([^"']+)["'][^>]*>/gi;
  for (const match of stripped.matchAll(htmlIdPattern)) {
    anchors.add(safeDecode(match[1]));
  }

  const headingPattern = /^(#{1,6})[ \t]+(.+)$/gm;
  for (const match of stripped.matchAll(headingPattern)) {
    for (const slug of headingSlugCandidates(match[2])) {
      addSlugWithDedup(anchors, headingCounts, slug);
    }
  }

  context.markdownAnchorsByFile.set(file, anchors);
  return anchors;
}

function validateLocalLinkAnchor(fromFile, src, link, resolved, context) {
  const fragment = extractLinkFragment(link.target);
  if (!fragment || LINE_ANCHOR_PATTERN.test(fragment)) return;
  if (statSync(resolved).isDirectory()) return;
  if (extname(resolved).toLowerCase() !== '.md') return;

  const anchors = collectMarkdownAnchors(resolved, context);
  if (!anchors.has(fragment)) {
    context.recordError(
      context.rel(fromFile),
      `line ${context.lineNumberAt(src, link.index)} has broken local anchor "${link.target}"`,
    );
  }
}

export function validateMarkdownLinks(context) {
  const markdownFiles = context.walkFiles(context.root, (abs) => extname(abs).toLowerCase() === '.md');
  for (const file of markdownFiles) {
    const src = readFileSync(file, 'utf8');
    for (const link of collectMarkdownLinks(src, context)) {
      const resolved = resolveLocalLink(file, link.target, context.root);
      if (!resolved) continue;
      if (!existsSync(resolved)) {
        context.recordError(
          context.rel(file),
          `line ${context.lineNumberAt(src, link.index)} has broken local link "${link.target}"`,
        );
        continue;
      }
      validateLocalLinkAnchor(file, src, link, resolved, context);
    }
  }
}

function readCommandStage(commandFile) {
  const src = readFileSync(commandFile, 'utf8');
  const frontmatter = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const stage = frontmatter?.[1].match(/^stage:\s*([a-z-]+)\s*$/m)?.[1];
  return stage ?? null;
}

const STRICT_OUTPUT_COMMAND_DOC_IDS = new Set([
  'finalize-work',
  'implement-lite',
  'implement-plan',
  'implement-standard',
  'route',
]);

function stripGeneratedCommandContract(source) {
  return source.replace(
    /<!-- generated:command-contract:start -->[\s\S]*?<!-- generated:command-contract:end -->/u,
    '',
  );
}

function parseRequiredMarker(value) {
  const marker = value.replaceAll('`', '').trim();
  if (/^(?:yes|required|true|必填|✅(?:\s*是)?)$/iu.test(marker)) return true;
  if (/^(?:no|optional|false|可选|建议|否|⚪|🔶(?:\s*建议)?)$/iu.test(marker)) return false;
  return null;
}

function commandParameterDeclarations(source) {
  const declarations = [];
  const lines = stripGeneratedCommandContract(source).split(/\r?\n/u);
  let sectionRequired = null;
  for (const line of lines) {
    const heading = /^###\s+(.+?)\s*$/u.exec(line)?.[1];
    if (heading) {
      sectionRequired = /^required$/iu.test(heading)
        ? true
        : /^optional$/iu.test(heading)
          ? false
          : null;
      continue;
    }
    const table = /^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|\s*([^|]+)\|/u.exec(line);
    if (table) {
      declarations.push({ name: table[1], required: parseRequiredMarker(table[2]) });
      continue;
    }
    const bullet = /^\s*-\s+`([A-Z][A-Z0-9_]*)`\s*:/u.exec(line);
    if (bullet && sectionRequired !== null) {
      declarations.push({ name: bullet[1], required: sectionRequired });
    }
  }
  return declarations;
}

export function commandDocInputContractErrors(source, inputs) {
  const errors = [];
  const declarations = commandParameterDeclarations(source);
  const requiredInputs = (inputs ?? []).filter((input) => input.required);
  const allowed = new Map();
  for (const input of inputs ?? []) {
    allowed.set(input.name, input);
    for (const alias of input.aliases ?? []) allowed.set(alias, input);
  }

  for (const declaration of declarations) {
    const input = declaration.name === 'ARGUMENTS' && requiredInputs.length === 1
      ? requiredInputs[0]
      : allowed.get(declaration.name);
    if (!input) {
      errors.push(`documents unknown input ${declaration.name}`);
      continue;
    }
    if (declaration.required === null) {
      errors.push(`input ${declaration.name} has an unrecognized required marker`);
    } else if (declaration.required !== Boolean(input.required)) {
      errors.push(`input ${declaration.name} required marker is ${declaration.required}, expected ${Boolean(input.required)}`);
    }
  }

  const genericArguments = declarations.some((entry) => entry.name === 'ARGUMENTS');
  for (const input of requiredInputs) {
    const acceptedNames = new Set([input.name, ...(input.aliases ?? [])]);
    if (declarations.some((entry) => acceptedNames.has(entry.name))) continue;
    // Legacy free-form command docs use ARGUMENTS for their only required input.
    // Keep that explicit exception narrow so named multi-input contracts cannot drift.
    if (genericArguments && requiredInputs.length === 1) continue;
    errors.push(`missing required input ${input.name}`);
  }
  return errors;
}

function commandOutputSection(source) {
  const lines = stripGeneratedCommandContract(source).split(/\r?\n/u);
  let inFence = false;
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*(?:```|~~~)/u.test(lines[index])) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && /^##\s+(?:输出(?:规范|说明)?|Output(?:\s+Specification)?)\s*$/iu.test(lines[index])) {
      start = index;
      break;
    }
  }
  if (start === -1) return null;
  inFence = false;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*(?:```|~~~)/u.test(lines[index])) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && /^##\s+/u.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

export function commandDocOutputContractErrors(source, output, { requireFields = false } = {}) {
  const errors = [];
  const section = commandOutputSection(source);
  if (/未规定固定输出结构|无固定输出结构|No fixed output structure/iu.test(stripGeneratedCommandContract(source))) {
    errors.push('claims that the command has no fixed output structure');
  }
  if (!requireFields) return errors;
  if (!section) return [...errors, 'missing manual output section'];
  const normalized = section.toLocaleLowerCase('en-US');
  let previousIndex = -1;
  for (const field of output?.order ?? []) {
    const fieldIndex = normalized.indexOf(String(field).toLocaleLowerCase('en-US'));
    if (fieldIndex === -1) {
      errors.push(`manual output section is missing contract field ${field}`);
      continue;
    }
    if (fieldIndex <= previousIndex) {
      errors.push(`manual output section lists contract field ${field} out of order`);
      continue;
    }
    previousIndex = fieldIndex;
  }
  return errors;
}

export function routeDocContractErrors(source) {
  const body = stripGeneratedCommandContract(source);
  const errors = [];
  if (!/(?:只输出一个立即执行|始终只输出一个立即执行|exactly one immediate route)/iu.test(body)) {
    errors.push('must state that routing returns exactly one immediate route');
  }
  if (/(?:输出|推荐).{0,16}(?:短|最短).{0,6}序列|(?:output|recommend).{0,20}(?:short|minimal).{0,10}(?:route\s+)?sequence/iu.test(body)) {
    errors.push('must not recommend a multi-route sequence');
  }
  const multiRoutePattern = /(?:\b(?:second|another|additional|multiple|two)\s+(?:immediate\s+)?routes?\b|\bmore\s+than\s+one\s+(?:immediate\s+)?route\b|(?:第二个|另一个|额外|两个|多个).{0,8}(?:route|路由)|(?:route|路由).{0,8}(?:第二个|另一个|额外|两个|多个))/iu;
  const negatedMultiRoutePattern = /\b(?:must\s+not|do\s+not|never|cannot|can't|only)\b|(?:不能|不得|禁止|仅|只)/iu;
  const contradictoryClause = body
    .split(/[.!?;。！？；\r\n]+/u)
    .some((clause) => multiRoutePattern.test(clause) && !negatedMultiRoutePattern.test(clause));
  if (contradictoryClause) {
    errors.push('must not describe a second or multiple immediate routes');
  }
  return errors;
}

export function repositoryDocsTreeErrors(source, expectedOwners) {
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => /^\|-- docs\/\s*$/u.test(line));
  if (start === -1) return ['missing repository docs tree'];
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^(?:\|--|`--)\s+/u.test(lines[index])) {
      end = index;
      break;
    }
  }
  const actualOwners = lines.slice(start + 1, end)
    .map((line) => /^\|\s{3}(?:\|--|`--)\s+([a-z0-9-]+)\/(?:\s|$)/u.exec(line)?.[1] ?? null)
    .filter(Boolean)
    .sort();
  const expected = [...expectedOwners].sort();
  if (JSON.stringify(actualOwners) === JSON.stringify(expected)) return [];
  return [`repository docs tree owners are [${actualOwners.join(', ')}], expected [${expected.join(', ')}]`];
}

export function validateCommandDocs(context) {
  const commandsDir = resolve(context.root, 'nova-plugin/commands');
  const docsDir = resolve(context.root, 'nova-plugin/docs/commands');
  const commandIds = readdirSync(commandsDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => basename(file, '.md'))
    .sort();

  for (const id of commandIds) {
    const commandFile = resolve(commandsDir, `${id}.md`);
    const stage = readCommandStage(commandFile);
    if (!stage) {
      context.recordError(context.rel(commandFile), 'missing command stage frontmatter');
      continue;
    }
    const docDir = context.CODEX_COMMAND_IDS.has(id) ? 'codex' : stage;
    const contractPath = resolve(context.root, 'nova-plugin/runtime/contracts', `${id}.json`);
    const contract = existsSync(contractPath)
      ? JSON.parse(readFileSync(contractPath, 'utf8'))
      : null;
    if (!contract) {
      context.recordError(context.rel(commandFile), `missing runtime contract for command ${id}`);
      continue;
    }
    for (const suffix of ['.md', '.README.md', '.README.en.md']) {
      const expectedName = `${id}${suffix}`;
      const expectedPath = resolve(docsDir, docDir, expectedName);
      if (!existsSync(expectedPath)) {
        context.recordError(
          'nova-plugin/docs/commands',
          `missing command doc ${docDir}/${expectedName}`,
        );
        continue;
      }
      const source = readFileSync(expectedPath, 'utf8');
      for (const error of commandDocInputContractErrors(source, contract.behaviorContract?.inputs ?? [])) {
        context.recordError(context.rel(expectedPath), error);
      }
      for (const error of commandDocOutputContractErrors(
        source,
        contract.behaviorContract?.output ?? {},
        { requireFields: STRICT_OUTPUT_COMMAND_DOC_IDS.has(id) },
      )) {
        context.recordError(context.rel(expectedPath), error);
      }
      if (id === 'route') {
        for (const error of routeDocContractErrors(source)) {
          context.recordError(context.rel(expectedPath), error);
        }
      }
    }
  }
}

function activeMarkdownFiles(context) {
  return context.walkFiles(context.root, (abs) => extname(abs).toLowerCase() === '.md')
    .filter((abs) => context.rel(abs) !== 'CHANGELOG.md')
    .filter((abs) => !context.isArchivePath(abs))
    .filter((abs) => !context.hasPathSegments(abs, context.HISTORY_SEGMENTS));
}

function isHistoricalMigrationReference(file, line, compatibilityPaths) {
  if (compatibilityPaths.has(file)) return true;
  if (file.startsWith('docs/project/migrations/')) return true;
  if (file.startsWith('docs/project/release-notes/')) return true;
  if (file.startsWith('governance/evidence/')) return true;
  if (/migrated-from:|merged-from:|Migrated source:/iu.test(line)) return true;
  if (/^\s*-\s+\d{4}-\d{2}-\d{2}:/u.test(line)) return true;
  return /compatibility\s+(?:stub|path)|兼容(?:入口|路径|占位)/iu.test(line);
}

export function migratedPathReferenceErrors(source, mappings, { file = '' } = {}) {
  const errors = [];
  const compatibilityPaths = new Set((mappings ?? []).map((entry) => entry.from));
  const lines = source.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isHistoricalMigrationReference(file, line, compatibilityPaths)) continue;
    for (const mapping of mappings ?? []) {
      if (!line.includes(mapping.from)) continue;
      errors.push(`line ${index + 1} references migrated path ${mapping.from}; use ${mapping.to}`);
    }
  }
  return errors;
}

function validateMigratedPathReferences(context) {
  const registry = JSON.parse(readFileSync(resolve(context.root, 'governance/docs-migrations.json'), 'utf8'));
  for (const file of activeMarkdownFiles(context)) {
    const relativePath = context.rel(file);
    const source = readFileSync(file, 'utf8');
    for (const error of migratedPathReferenceErrors(source, registry.mappings, { file: relativePath })) {
      context.recordError(relativePath, error);
    }
  }
}

function validateCanonicalSkillReferences(context) {
  const skillsDir = resolve(context.root, 'nova-plugin/skills');
  const workflows = JSON.parse(readFileSync(resolve(context.root, 'workflow-specs/workflows.json'), 'utf8'));
  const expectedSkillIds = [...new Set(
    workflows.workflows.map((workflow) => `nova-${workflow.canonicalSurfaceId}`),
  )].sort();
  const actualSkillIds = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('nova-'))
    .filter((entry) => existsSync(resolve(skillsDir, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort();
  if (JSON.stringify(actualSkillIds) !== JSON.stringify(expectedSkillIds)) {
    context.recordError(
      'nova-plugin/skills',
      `canonical Skill set is ${JSON.stringify(actualSkillIds)}, expected ${JSON.stringify(expectedSkillIds)} from workflow canonicalSurfaceId values`,
    );
  }

  const skillReference = /(?:(?:nova-plugin|\$\{CLAUDE_PLUGIN_ROOT\})\/)?skills\/(nova-[a-z0-9-]+)\/SKILL\.md/gu;
  for (const file of activeMarkdownFiles(context)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(skillReference)) {
      const skillPath = resolve(skillsDir, match[1], 'SKILL.md');
      if (!existsSync(skillPath)) {
        context.recordError(
          context.rel(file),
          `line ${context.lineNumberAt(source, match.index ?? 0)} references missing canonical Skill nova-plugin/skills/${match[1]}/SKILL.md`,
        );
      }
    }
  }
}

function validateSkillFirstArchitectureDocs(context) {
  const architectureFile = 'nova-plugin/docs/architecture/dual-track-design.md';
  const architecture = readFileSync(resolve(context.root, architectureFile), 'utf8');
  const workflowSpecs = JSON.parse(readFileSync(resolve(context.root, 'workflow-specs/workflows.json'), 'utf8'));
  const workflowCount = workflowSpecs.workflows.length;
  const canonicalSkillCount = new Set(
    workflowSpecs.workflows.map((workflow) => workflow.canonicalSurfaceId),
  ).size;
  for (const required of [
    `${workflowCount} 个由生成器维护的 command wrappers`,
    'workflow-specs/workflows.json',
    'workflow-specs/behaviors.json',
    'node scripts/migrate-v6-contracts.mjs --write',
    'node scripts/generate-runtime-contracts.mjs --write',
    'node scripts/generate-behavior-surfaces.mjs --write',
    'node scripts/generate-command-docs.mjs --write',
    '不要手工编辑',
  ]) {
    if (!architecture.includes(required)) {
      context.recordError(architectureFile, `missing current ${workflowCount}-to-${canonicalSkillCount} Skill-first architecture contract: ${required}`);
    }
  }
  if (!/别名与 Skill\s+是多对一/u.test(architecture)) {
    context.recordError(architectureFile, 'missing current aliases-to-canonical-Skills many-to-one contract');
  }
  for (const stale of [
    'Commands 与 skills 必须保持一对一',
    'nova-plugin/skills/nova-<id>/SKILL.md',
    '更新 `nova-plugin/commands/<id>.md`',
    'direct command + compatibility skill',
  ]) {
    if (architecture.includes(stale)) {
      context.recordError(architectureFile, `contains stale one-command-one-Skill maintenance guidance: ${stale}`);
    }
  }

  const stalePairPatterns = [
    new RegExp(`\\b(?:existing|current)\\s+${workflowCount}\\s+commands?\\s*\\/\\s*skills?\\s+pairs?\\b`, 'iu'),
    new RegExp(`\\b${workflowCount}\\s+commands?.{0,60}(?:one-to-one|1:1).{0,60}skills?\\b`, 'iu'),
    new RegExp(`\\bcommands?.{0,40}(?:one-to-one|1:1).{0,40}skills?\\b`, 'iu'),
    new RegExp(`\\bskills?.{0,40}(?:one-to-one|1:1).{0,40}commands?\\b`, 'iu'),
    new RegExp(`${workflowCount}\\s*个?\\s*命令.{0,50}${workflowCount}\\s*个?\\s*(?:Skills?|技能)`, 'iu'),
    /命令.{0,30}(?:与|和|\/)?.{0,20}(?:Skills?|技能).{0,30}(?:一一对应|一对一)/iu,
  ];
  for (const file of activeMarkdownFiles(context)) {
    const relativePath = context.rel(file);
    if (relativePath.includes('/migrations/') || relativePath.startsWith('governance/evidence/')) continue;
    const source = readFileSync(file, 'utf8');
    const prose = source
      .replace(/^(?: {0,3})(`{3,}|~{3,})[^\n]*\n[\s\S]*?^(?: {0,3})\1\s*$/gmu, '')
      .replace(/`[^`\n]*`/gu, '');
    const staleClaim = prose.split(/\r?\n/u).find((line) => {
      const negated = /\b(?:not|no longer|never)\b.{0,50}(?:one-to-one|1:1|command\s*\/\s*skill\s+pairs?)/iu.test(line)
        || /(?:不是|不再|并非|禁止|避免).{0,40}(?:一一对应|一对一|命令\s*\/\s*Skill)/iu.test(line);
      return !negated && stalePairPatterns.some((pattern) => pattern.test(line));
    });
    if (staleClaim) {
      context.recordError(
        relativePath,
        `describes the current ${workflowCount}-command surface as command/Skill pairs instead of ${canonicalSkillCount} canonical Skills`,
      );
    }
  }

  const resourceContracts = [
    ['codex-review-fix', 'nova-plugin/skills/nova-codex-review-fix/README.md'],
    ['codex-review-only', 'nova-plugin/skills/nova-codex-review-only/README.md'],
    ['codex-verify-only', 'nova-plugin/skills/nova-codex-verify-only/README.md'],
  ];
  const codexGuideFile = 'docs/guides/assistants/codex.md';
  const codexGuide = readFileSync(resolve(context.root, codexGuideFile), 'utf8');
  for (const [id, file] of resourceContracts) {
    const workflow = workflowSpecs.workflows.find((entry) => entry.id === id);
    if (!workflow) {
      context.recordError('workflow-specs/workflows.json', `missing ${id} compatibility workflow`);
      continue;
    }
    const canonicalSkill = `nova-plugin/${workflow.contractPath}`;
    const presets = Object.entries(workflow.variantPreset ?? {}).map(([key, value]) => `${key}=${value}`);
    const source = readFileSync(resolve(context.root, file), 'utf8');
    for (const required of ['不包含独立 `SKILL.md`', canonicalSkill, ...presets]) {
      if (!source.includes(required)) context.recordError(file, `missing compatibility-resource contract: ${required}`);
    }
    for (const required of [id, canonicalSkill, ...presets]) {
      if (!codexGuide.includes(required)) context.recordError(codexGuideFile, `missing derived Codex compatibility mapping: ${required}`);
    }
    if (/^[ \t]*[├└]── SKILL\.md\s*$/mu.test(source)) {
      context.recordError(file, 'compatibility resource tree claims a nonexistent standalone SKILL.md');
    }
  }
}

function validateHookSyntaxChecklists(context) {
  const hookSyntaxScripts = readdirSync(resolve(context.root, 'nova-plugin/hooks/scripts'))
    .filter((file) => file.endsWith('.sh'))
    .sort();
  const contributing = readFileSync(resolve(context.root, 'CONTRIBUTING.md'), 'utf8');
  const distributedCount = contributing.match(/Bash 可用时还要对 (\d+) 个分发 shell 脚本运行 `bash -n`/u)?.[1];
  if (Number(distributedCount) !== hookSyntaxScripts.length) {
    context.recordError('CONTRIBUTING.md', `distributed hook shell count is ${distributedCount ?? 'missing'}, expected ${hookSyntaxScripts.length}`);
  }
  if (!/`post-audit-log\.sh` 是 compatibility helper，不是 `hooks\.json` 的 active launcher/u.test(contributing)) {
    context.recordError('CONTRIBUTING.md', 'missing post-audit compatibility-helper versus active-launcher boundary');
  }
  for (const file of HOOK_CHECKLIST_FILES) {
    const source = readFileSync(resolve(context.root, file), 'utf8');
    for (const script of hookSyntaxScripts) {
      const command = `bash -n nova-plugin/hooks/scripts/${script}`;
      if (!source.includes(command)) context.recordError(file, `hook syntax checklist is missing ${command}`);
    }
  }
}

export function releaseHygieneSupportSourceErrors(source) {
  const errors = [];
  if (!source.includes('current MINOR support range derived from the stable channel in `governance/release-channels.json`')) {
    errors.push('security support-range documentation must name the stable release channel as its source');
  }
  if (/current MINOR support range derived from `(?:plugin\.json|nova-plugin\/\.claude-plugin\/plugin\.json)`/u.test(source)) {
    errors.push('security support-range documentation contradicts the stable-channel source');
  }
  return errors;
}

function validateVersionAndReleaseSourceDocs(context) {
  /** @type {Array<[string, string[]]>} */
  const requiredByFile = [
    ['CLAUDE.md', [
      '- `package.json` for the repository tooling version',
      'Stable distribution is a separate version domain',
      'valid for development plugin/package metadata to be ahead of the stable',
    ]],
    ['CONTRIBUTING.md', [
      '- 根目录 `package.json` 的 `version`',
      '稳定分发是独立版本域',
      '未发布的 plugin/package 版本可以领先 stable channel',
      '非 Windows 使用系统临时目录',
      'Windows 为保持 Git Bash / `node.exe` 路径兼容会临时使用 `.codex/tmp`',
    ]],
    ['docs/operations/releases/hygiene.md', [
      'root `package.json` repository-tooling version must match the plugin',
      '`governance/release-channels.json` is the stable version/tag/commit source',
      'may legitimately lag unreleased plugin/package metadata',
    ]],
    ['docs/operations/releases/validation.md', [
      "fs.readFileSync('package.json','utf8')",
      "fs.readFileSync('governance/release-channels.json','utf8')",
      '`package` and `plugin` versions are identical',
      '`marketplace` and `metadata` versions match `stableChannel`',
      '`candidate-preflight/workflow-provenance.json`',
      '`recovery/workflow-provenance.json`',
      '`handoff/workflow-provenance.json`',
    ]],
    ['docs/templates/evidence/release.md', [
      'Development package/plugin version:',
      'Stable channel version:',
      'Development package/plugin version sync:',
      'Stable channel/marketplace/metadata version sync:',
      'GitHub run URL:',
      'Caller workflow ref:',
      'Caller github.workflow_sha:',
      'Called reusable workflow ref (stable promotion or N/A):',
      'Called job.workflow_sha (stable promotion or N/A):',
      'Workflow provenance artifact (`candidate-preflight/`, `recovery/`, or `handoff/workflow-provenance.json`):',
    ]],
    ['docs/operations/marketplace/registry-authoring.md', [
      'development/candidate plugin version changes',
      'Regenerate marketplace files only when the',
      'plugin version must not overwrite the stable catalog version',
    ]],
    ['AGENTS.md', ['`.github/workflows/release-candidate.yml`']],
    ['SECURITY.md', [
      '`governance/release-channels.json` 中的 stable channel',
      '而不是未发布的 plugin development metadata',
      '受影响的已安装/已发布版本（以 stable release channel 和 exact tag 为准）',
      '若报告针对未发布快照，再附 commit 与 plugin manifest version',
    ]],
    ['README.md', ['<td><strong>稳定插件版本</strong></td>']],
    ['nova-plugin/docs/overview/README.en.md', [
      '<td><strong>Stable plugin version</strong></td>',
      'development/candidate plugin metadata and base-version source',
      '`package.json`: repository-tooling version; it must match the plugin manifest',
      '`governance/release-channels.json`: stable version, exact tag, and commit source',
    ]],
    ['docs/operations/maintainers/status.md', ['Current stable plugin version:']],
    ['docs/project/plans/current-remediation.md', [
      'Status: source-merged; external gates pending',
    ]],
  ];
  for (const [file, requiredValues] of requiredByFile) {
    const source = readFileSync(resolve(context.root, file), 'utf8');
    for (const required of requiredValues) {
      if (!source.includes(required)) context.recordError(file, `missing maintenance/release source contract: ${required}`);
    }
  }

  const routeContract = JSON.parse(readFileSync(resolve(context.root, 'nova-plugin/runtime/route-output-contract.json'), 'utf8'));
  const routeFieldCount = Array.isArray(routeContract.fields) ? routeContract.fields.length : 0;
  const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const expectedBoundary = `${numberWords[routeFieldCount] ?? routeFieldCount}-field boundary`;
  const releaseValidationSource = readFileSync(resolve(context.root, 'docs/operations/releases/validation.md'), 'utf8');
  if (!releaseValidationSource.includes(expectedBoundary)) {
    context.recordError(
      'docs/operations/releases/validation.md',
      `route output description must derive the ${expectedBoundary} from route-output-contract.json`,
    );
  }

  const validationFile = 'docs/operations/maintainers/validation.md';
  const validationSource = readFileSync(resolve(context.root, validationFile), 'utf8');
  const generationProfiles = ['runtime', 'docs', 'release'];
  const aggregatePlan = repositoryProfilePlan('generate', 'all');
  if (!validationSource.includes(`${aggregatePlan.length} deterministic generation tasks`)) {
    context.recordError(validationFile, `generation task count is not derived from the ${aggregatePlan.length}-task llmf plan`);
  }
  for (const profile of generationProfiles) {
    const plan = repositoryProfilePlan('generate', profile);
    if (!new RegExp(`\\b${profile} has\\s+${plan.length}\\b`, 'u').test(validationSource)) {
      context.recordError(validationFile, `${profile} generation profile count is not ${plan.length}`);
    }
    for (const task of plan) {
      if (!validationSource.includes(`\`${task.id}\``)) {
        context.recordError(validationFile, `missing llmf ${profile} generation task: ${task.id}`);
      }
    }
  }
  const mutationBaseline = JSON.parse(readFileSync(resolve(context.root, 'evals/baselines/critical-mutation.json'), 'utf8'));
  const mutationCount = mutationBaseline.results?.length ?? 0;
  if (!validationSource.includes(`${mutationCount} governed real high-risk mutations evaluated by baseline-prechecked isolated probes`)) {
    context.recordError(validationFile, `critical mutation description is not derived from the ${mutationCount}-probe baseline`);
  }

  const agents = readFileSync(resolve(context.root, 'AGENTS.md'), 'utf8');
  if (!/Stable\s+`\.github\/workflows\/release\.yml` only delegates promotion/u.test(agents)) {
    context.recordError('AGENTS.md', 'missing stable trigger delegation boundary');
  }
  if (/isolated install smoke job in `\.github\/workflows\/release\.yml`/u.test(agents)) {
    context.recordError('AGENTS.md', 'stable trigger workflow is incorrectly described as owning the exact-tag install smoke');
  }
  const security = readFileSync(resolve(context.root, 'SECURITY.md'), 'utf8');
  if (/支持范围跟随 `nova-plugin\/\.claude-plugin\/plugin\.json`/u.test(security)) {
    context.recordError('SECURITY.md', 'security support range must follow the stable release channel, not development metadata');
  }
  if (/受影响的插件版本（`nova-plugin\/\.claude-plugin\/plugin\.json` 的 `version`）/u.test(security)) {
    context.recordError('SECURITY.md', 'vulnerability reports must identify the affected installed/released version, not assume the development manifest version');
  }
  const releaseHygieneFile = 'docs/operations/releases/hygiene.md';
  const releaseHygiene = readFileSync(resolve(context.root, releaseHygieneFile), 'utf8');
  for (const error of releaseHygieneSupportSourceErrors(releaseHygiene)) context.recordError(releaseHygieneFile, error);
  const remediation = readFileSync(resolve(context.root, 'docs/project/plans/current-remediation.md'), 'utf8');
  if (/without creating a commit/u.test(remediation)) {
    context.recordError('docs/project/plans/current-remediation.md', 'current ledger still describes the merged remediation as uncommitted local work');
  }
  const contributing = readFileSync(resolve(context.root, 'CONTRIBUTING.md'), 'utf8');
  if (/不调用 Codex，也不写 `\.codex\/`/u.test(contributing)) {
    context.recordError('CONTRIBUTING.md', 'runtime smoke absolute no-.codex-write claim is false on Windows');
  }
}

function validateCanonicalDocsIndexes(context) {
  const registry = JSON.parse(readFileSync(resolve(context.root, 'governance/docs-migrations.json'), 'utf8'));
  const compatibilityPaths = new Set(registry.mappings.map((entry) => entry.from));
  const docsRoot = resolve(context.root, 'docs');
  const hasCanonicalContent = (directory, relativeDirectory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relativePath = `docs/${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (hasCanonicalContent(resolve(directory, entry.name), `${relativeDirectory}/${entry.name}`)) return true;
      } else if (!compatibilityPaths.has(relativePath)) return true;
    }
    return false;
  };
  const expectedOwners = readdirSync(docsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && hasCanonicalContent(resolve(docsRoot, entry.name), entry.name))
    .map((entry) => entry.name)
    .sort();

  const indexFile = 'docs/README.md';
  const indexSource = readFileSync(resolve(context.root, indexFile), 'utf8');
  const responsibilityBlock = /## Directory Responsibilities\s+([\s\S]*?)(?=\n##\s|$)/u.exec(indexSource)?.[1] ?? '';
  const actualOwners = [...responsibilityBlock.matchAll(/^\|\s*\[([a-z0-9-]+)\/\]\(\1\/\)\s*\|/gmu)]
    .map((match) => match[1])
    .sort();
  if (JSON.stringify(actualOwners) !== JSON.stringify(expectedOwners)) {
    context.recordError(
      indexFile,
      `canonical directory owners are [${actualOwners.join(', ')}], expected [${expectedOwners.join(', ')}] from active docs content`,
    );
  }

  for (const file of ['CLAUDE.md', 'nova-plugin/docs/overview/README.en.md']) {
    const source = readFileSync(resolve(context.root, file), 'utf8');
    for (const error of repositoryDocsTreeErrors(source, expectedOwners)) {
      context.recordError(file, error);
    }
  }

  for (const file of [indexFile, 'nova-plugin/docs/README.md']) {
    const source = readFileSync(resolve(context.root, file), 'utf8');
    for (const match of source.matchAll(/\[([^\]]+)\]\([^)]+\)/gu)) {
      const label = match[1].replaceAll('`', '').trim();
      const docsIndex = label.lastIndexOf('docs/');
      const normalized = docsIndex >= 0
        ? label.slice(docsIndex)
        : `docs/${label.replace(/^\.\//u, '')}`;
      if (compatibilityPaths.has(normalized)) {
        context.recordError(file, `canonical index link label still names compatibility stub ${normalized}`);
      }
    }
  }
}

function validateCommandComparisonTables(context) {
  const commandIds = readdirSync(resolve(context.root, 'nova-plugin/commands'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => basename(file, '.md'))
    .sort();
  const workflowSpecs = JSON.parse(readFileSync(resolve(context.root, 'workflow-specs/workflows.json'), 'utf8'));
  const workflowsById = new Map(workflowSpecs.workflows.map((workflow) => [workflow.id, workflow]));
  const tables = [
    ['nova-plugin/docs/guides/commands-reference-guide.md', '### 命令约束强度对比', '**命令数量**'],
    ['nova-plugin/docs/guides/commands-reference-guide.en.md', '### Constraint strength comparison', '**Total commands**'],
  ];
  for (const [file, startMarker, endMarker] of tables) {
    const source = readFileSync(resolve(context.root, file), 'utf8');
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    if (start === -1 || end === -1) {
      context.recordError(file, 'missing command constraint comparison table boundaries');
      continue;
    }
    const tableRows = source.slice(start, end).split(/\r?\n/u)
      .map((line) => ({
        line,
        id: line.match(/^\|[^|\r\n]*\|[^|\r\n]*?`\/nova-plugin:([a-z0-9-]+)`/u)?.[1] ?? null,
      }))
      .filter((entry) => entry.id);
    const tableIds = tableRows
      .map((entry) => entry.id)
      .sort();
    if (JSON.stringify(tableIds) !== JSON.stringify(commandIds)) {
      const missing = commandIds.filter((id) => !tableIds.includes(id));
      const unexpected = tableIds.filter((id) => !commandIds.includes(id));
      const duplicates = [...new Set(tableIds.filter((id, index) => tableIds.indexOf(id) !== index))];
      context.recordError(file, `command comparison table must cover all command ids exactly once; missing=${missing.join(',') || 'none'} unexpected=${unexpected.join(',') || 'none'} duplicates=${duplicates.join(',') || 'none'}`);
    }
    for (const { id, line } of tableRows) {
      const workflow = workflowsById.get(id);
      if (!workflow?.compatibilityAlias) continue;
      const invocations = [...line.matchAll(/`\/nova-plugin:([a-z0-9-]+)([^`]*)`/gu)]
        .map((match) => ({ id: match[1], arguments: match[2].trim() }));
      const canonicalInvocations = invocations.filter((invocation) => invocation.id === workflow.canonicalSurfaceId);
      const actualPreset = {};
      let malformed = invocations.length !== 2
        || invocations[0]?.id !== id
        || invocations[0]?.arguments !== ''
        || canonicalInvocations.length !== 1;
      for (const token of canonicalInvocations[0]?.arguments.split(/\s+/u).filter(Boolean) ?? []) {
        const match = /^([A-Z][A-Z0-9_]*)=(\S+)$/u.exec(token);
        if (!match || Object.hasOwn(actualPreset, match[1])) {
          malformed = true;
          continue;
        }
        actualPreset[match[1]] = match[2];
      }
      const expectedPreset = Object.fromEntries(
        Object.entries(workflow.variantPreset ?? {}).map(([name, value]) => [name, String(value)]),
      );
      const sorted = (value) => Object.fromEntries(Object.entries(value).sort(([left], [right]) => (
        left < right ? -1 : left > right ? 1 : 0
      )));
      if (malformed || JSON.stringify(sorted(actualPreset)) !== JSON.stringify(sorted(expectedPreset))) {
        const expectedInvocation = `/nova-plugin:${workflow.canonicalSurfaceId} ${Object.entries(expectedPreset).map(([name, value]) => `${name}=${value}`).join(' ')}`;
        context.recordError(
          file,
          `command comparison table alias ${id} must document its exact derived preset as ${expectedInvocation}`,
        );
      }
    }
  }
}

function validateDependencyReviewSemantics(context) {
  const file = 'docs/operations/maintainers/troubleshooting.md';
  const source = readFileSync(resolve(context.root, file), 'utf8');
  for (const [pattern, label] of /** @type {Array<[RegExp, string]>} */ ([
    [/fails closed\s+when the dependency graph is unavailable for a same-repository PR/u, 'same-repository graph-unavailable fail-closed behavior'],
    [/For a fork\s+PR, an unavailable graph is `not_applicable` only when no dependency-bearing\s+surface changed/u, 'fork no-dependency-surface not-applicable behavior'],
    [/a fork PR that changes such a surface also fails closed/u, 'fork dependency-surface fail-closed behavior'],
  ])) {
    if (!pattern.test(source)) context.recordError(file, `missing fail-closed dependency-review contract: ${label}`);
  }
  if (/Dependency review may skip when/u.test(source)) {
    context.recordError(file, 'dependency review is incorrectly described as an unconditional skip when the graph is unavailable');
  }
}

export function validateLinksAndCommandDocs(context) {
  validateMarkdownLinks(context);
  validateCommandDocs(context);
  validateMigratedPathReferences(context);
  validateCanonicalSkillReferences(context);
  validateSkillFirstArchitectureDocs(context);
  validateHookSyntaxChecklists(context);
  validateVersionAndReleaseSourceDocs(context);
  validateCanonicalDocsIndexes(context);
  validateCommandComparisonTables(context);
  validateDependencyReviewSemantics(context);
}

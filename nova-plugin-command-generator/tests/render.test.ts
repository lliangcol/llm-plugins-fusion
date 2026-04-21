import { describe, expect, it } from 'vitest';
import { computeWorkflowOutputs, renderStringTemplate, renderTemplate } from '../src/utils/render';
import { CommandDefinition, FormState } from '../src/types';

const makeCommand = (
  template: string,
  fields: CommandDefinition['fields'] = [],
): CommandDefinition => ({
  id: 'test-cmd',
  displayName: '/test-cmd',
  stage: 'explore',
  constraintLevel: 'medium',
  description: 'test',
  fields,
  template,
});

describe('renderTemplate', () => {
  it('正常替换文本字段变量', () => {
    const cmd = makeCommand('Hello {{name}}!', [
      { id: 'name', label: 'Name', type: 'text' },
    ]);
    const form: FormState = { name: 'World' };
    expect(renderTemplate(cmd, form)).toBe('Hello World!');
  });

  it('缺失变量输出 <<MISSING:KEY>>', () => {
    const cmd = makeCommand('Value: {{missing}}', []);
    const form: FormState = {};
    expect(renderTemplate(cmd, form)).toBe('Value: <<MISSING:missing>>');
  });

  it('list 类型变量转换为 "- item" 格式', () => {
    const cmd = makeCommand('Items:\n{{items}}', [
      { id: 'items', label: 'Items', type: 'list' },
    ]);
    const form: FormState = { items: ['foo', 'bar', 'baz'] };
    expect(renderTemplate(cmd, form)).toBe('Items:\n- foo\n- bar\n- baz');
  });

  it('list 字段传入换行字符串时正确分割', () => {
    const cmd = makeCommand('{{items}}', [
      { id: 'items', label: 'Items', type: 'list' },
    ]);
    const form: FormState = { items: 'a\nb\nc' };
    expect(renderTemplate(cmd, form)).toBe('- a\n- b\n- c');
  });

  it('空字符串值替换后为空', () => {
    const cmd = makeCommand('Prefix:{{empty}}Suffix', [
      { id: 'empty', label: 'Empty', type: 'text' },
    ]);
    const form: FormState = { empty: '' };
    expect(renderTemplate(cmd, form)).toBe('Prefix:Suffix');
  });

  it('同一变量在模板中多次出现全部被替换', () => {
    const cmd = makeCommand('{{x}} and {{x}} again', [
      { id: 'x', label: 'X', type: 'text' },
    ]);
    const form: FormState = { x: 'hello' };
    expect(renderTemplate(cmd, form)).toBe('hello and hello again');
  });

  it('模板无变量时原样返回', () => {
    const cmd = makeCommand('No variables here.', []);
    const form: FormState = {};
    expect(renderTemplate(cmd, form)).toBe('No variables here.');
  });

  it('boolean 字段为 true 时输出 "true"', () => {
    const cmd = makeCommand('Flag: {{flag}}', [
      { id: 'flag', label: 'Flag', type: 'boolean' },
    ]);
    const form: FormState = { flag: true };
    expect(renderTemplate(cmd, form)).toBe('Flag: true');
  });

  it('boolean 字段为 false 时输出 "false"', () => {
    const cmd = makeCommand('Flag: {{flag}}', [
      { id: 'flag', label: 'Flag', type: 'boolean' },
    ]);
    const form: FormState = { flag: false };
    expect(renderTemplate(cmd, form)).toBe('Flag: false');
  });

  it('通过 variables 参数传入的值可替换缺失字段', () => {
    const cmd = makeCommand('Hello {{name}}!', []);
    const form: FormState = {};
    expect(renderTemplate(cmd, form, { name: 'Claude' })).toBe('Hello Claude!');
  });
});

describe('renderStringTemplate', () => {
  it('可渲染独立字符串模板中的字段和值变量', () => {
    const fields: CommandDefinition['fields'] = [
      { id: 'reviewFile', label: 'Review file', type: 'path' },
    ];
    const form: FormState = { reviewFile: '.codex/review.md' };
    expect(
      renderStringTemplate('review={{reviewFile}} checks={{checksFile}}', fields, form, {
        checksFile: '.codex/checks.txt',
      }),
    ).toBe('review=.codex/review.md checks=.codex/checks.txt');
  });

  it('缺失变量时输出 <<MISSING:KEY>>', () => {
    expect(renderStringTemplate('missing={{value}}', [], {})).toBe('missing=<<MISSING:value>>');
  });
});

describe('computeWorkflowOutputs', () => {
  it('无 outputs 时返回原 variables 的副本', () => {
    const cmd = makeCommand('noop');
    const vars = { foo: 'bar' };
    const result = computeWorkflowOutputs(cmd, {}, vars);
    expect(result).toEqual(vars);
    expect(result).not.toBe(vars);
  });

  it('valueTemplate 使用静态路径时直接写入变量', () => {
    const cmd: CommandDefinition = {
      ...makeCommand('tpl'),
      outputs: [
        { id: 'latest_review_file', type: 'path', valueTemplate: '.codex/codex-review-fix/latest-artifacts/review.md' },
      ],
    };
    const result = computeWorkflowOutputs(cmd, {}, {});
    expect(result.latest_review_file).toBe('.codex/codex-review-fix/latest-artifacts/review.md');
  });

  it('valueTemplate 可以引用当前命令的字段', () => {
    const cmd: CommandDefinition = {
      ...makeCommand('tpl', [{ id: 'BASE', label: 'Base', type: 'text' }]),
      outputs: [
        { id: 'resolved_base', type: 'text', valueTemplate: 'branch={{BASE}}' },
      ],
    };
    const result = computeWorkflowOutputs(cmd, { BASE: 'main' }, {});
    expect(result.resolved_base).toBe('branch=main');
  });

  it('sourceFieldId 路径从 form 读取 trim 后的字符串', () => {
    const cmd: CommandDefinition = {
      ...makeCommand('tpl', [{ id: 'PLAN_OUTPUT_PATH', label: 'Plan', type: 'path' }]),
      outputs: [
        { id: 'plan_output_path', type: 'path', sourceFieldId: 'PLAN_OUTPUT_PATH' },
      ],
    };
    const result = computeWorkflowOutputs(cmd, { PLAN_OUTPUT_PATH: '  docs/plan.md  ' }, {});
    expect(result.plan_output_path).toBe('docs/plan.md');
  });

  it('sourceFieldId 指向空值时不写入变量', () => {
    const cmd: CommandDefinition = {
      ...makeCommand('tpl', [{ id: 'PLAN_OUTPUT_PATH', label: 'Plan', type: 'path' }]),
      outputs: [
        { id: 'plan_output_path', type: 'path', sourceFieldId: 'PLAN_OUTPUT_PATH' },
      ],
    };
    const result = computeWorkflowOutputs(cmd, { PLAN_OUTPUT_PATH: '   ' }, { existing: 'keep' });
    expect(result).toEqual({ existing: 'keep' });
  });

  it('同一命令内后续 output 可引用前序 output 的结果', () => {
    const cmd: CommandDefinition = {
      ...makeCommand('tpl', [{ id: 'BASE', label: 'Base', type: 'text' }]),
      outputs: [
        { id: 'review_file', type: 'path', valueTemplate: '.codex/{{BASE}}/review.md' },
        { id: 'verify_prompt', type: 'text', valueTemplate: 'verify {{review_file}}' },
      ],
    };
    const result = computeWorkflowOutputs(cmd, { BASE: 'main' }, {});
    expect(result.review_file).toBe('.codex/main/review.md');
    expect(result.verify_prompt).toBe('verify .codex/main/review.md');
  });

  it('valueTemplate 为空串时不覆盖已有变量', () => {
    const cmd: CommandDefinition = {
      ...makeCommand('tpl', [{ id: 'BASE', label: 'Base', type: 'text' }]),
      outputs: [
        { id: 'resolved_base', type: 'text', valueTemplate: '{{BASE}}' },
      ],
    };
    const result = computeWorkflowOutputs(cmd, { BASE: '' }, { resolved_base: 'prev' });
    expect(result.resolved_base).toBe('prev');
  });
});

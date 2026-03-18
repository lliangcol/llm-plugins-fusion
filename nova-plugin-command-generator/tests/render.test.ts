import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../src/utils/render';
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

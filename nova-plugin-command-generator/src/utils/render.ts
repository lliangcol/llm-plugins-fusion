import { CommandDefinition, FieldDefinition, FormState } from '../types';

const listify = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

const stringifyField = (field: FieldDefinition, value: unknown) => {
  if (field.type === 'list') {
    const items = listify(value);
    return items.length ? items.map((item) => `- ${item}`).join('\n') : '';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return value ? String(value) : '';
};

export const renderStringTemplate = (
  template: string,
  fields: FieldDefinition[],
  form: FormState,
  variables: Record<string, string> = {},
) => {
  return template.replace(/{{(.*?)}}/g, (_, rawKey) => {
    const key = String(rawKey).trim();
    const field = fields.find((f) => f.id === key);
    if (field) {
      return stringifyField(field, form[key] ?? '');
    }
    if (variables[key]) return variables[key];
    return `<<MISSING:${key}>>`;
  });
};

export const renderTemplate = (command: CommandDefinition, form: FormState, variables: Record<string, string> = {}) => {
  return renderStringTemplate(command.template, command.fields, form, variables);
};

export const computeWorkflowOutputs = (
  command: CommandDefinition,
  form: FormState,
  variables: Record<string, string>,
): Record<string, string> => {
  const next = { ...variables };
  if (!command.outputs) return next;
  command.outputs.forEach((output) => {
    if (output.valueTemplate) {
      // 使用 next 让后续 output 可以引用同一命令中前序 output 的结果
      const value = renderStringTemplate(output.valueTemplate, command.fields, form, next).trim();
      if (value) next[output.id] = value;
      return;
    }
    if (!output.sourceFieldId) return;
    const value = form[output.sourceFieldId];
    if (typeof value === 'string' && value.trim()) next[output.id] = value.trim();
  });
  return next;
};

export const stageOrder: Record<string, number> = {
  explore: 1,
  plan: 2,
  review: 3,
  implement: 4,
  finalize: 5,
};

export const constraintLabel: Record<string, string> = {
  strong: '严格',
  medium: '标准',
  weak: '轻量',
};

export const constraintOrder: Record<string, number> = {
  weak: 1,
  medium: 2,
  strong: 3,
};


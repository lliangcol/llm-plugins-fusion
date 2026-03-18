import { describe, expect, it } from 'vitest';
import { evaluateIntent, evaluateContext, evaluateConstraints } from '../src/utils/promptQuality';

describe('evaluateIntent', () => {
  it('空输入返回 weak 状态', () => {
    const result = evaluateIntent('');
    expect(result.status).toBe('weak');
  });

  it('仅有空格的输入返回 weak 状态', () => {
    const result = evaluateIntent('   ');
    expect(result.status).toBe('weak');
  });

  it('有明确动词且内容足够长返回 ok 状态', () => {
    const result = evaluateIntent('implement a user authentication module');
    expect(result.status).toBe('ok');
  });

  it('无动词时返回 warning 状态', () => {
    const result = evaluateIntent('user authentication module something here');
    expect(result.status).toBe('warning');
  });

  it('有动词但内容过短返回 warning 状态', () => {
    const result = evaluateIntent('fix bug');
    expect(result.status).toBe('warning');
  });

  it('中文动词也能识别并返回 ok 状态', () => {
    const result = evaluateIntent('实现用户鉴权模块，支持 JWT token 验证');
    expect(result.status).toBe('ok');
  });
});

describe('evaluateContext', () => {
  it('空输入返回 weak 状态', () => {
    const result = evaluateContext('');
    expect(result.status).toBe('weak');
  });

  it('含上下文关键词且内容足够长返回 ok 状态', () => {
    const result = evaluateContext('the auth module in the user service backend api system');
    expect(result.status).toBe('ok');
  });

  it('无上下文关键词时返回 warning 状态', () => {
    const result = evaluateContext('just a plain description without relevant keywords');
    expect(result.status).toBe('warning');
  });

  it('有上下文关键词但内容过短返回 warning 状态', () => {
    const result = evaluateContext('api');
    expect(result.status).toBe('warning');
  });
});

describe('evaluateConstraints', () => {
  it('空输入返回 warning 状态', () => {
    const result = evaluateConstraints('');
    expect(result.status).toBe('warning');
  });

  it('内容过短（<8字符）返回 warning 状态', () => {
    const result = evaluateConstraints('no sql');
    expect(result.status).toBe('warning');
  });

  it('有足够约束内容返回 ok 状态', () => {
    const result = evaluateConstraints('no breaking changes, keep backward compatibility');
    expect(result.status).toBe('ok');
  });
});

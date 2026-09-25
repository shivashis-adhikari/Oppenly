import { describe, expect, test } from 'vitest';
import { isAllowedTarget, isOwnHost } from './relay.mjs';

describe('relay', () => {
  test('accepts https providers and providers on this computer', () => {
    expect(isAllowedTarget('https://api.openai.com/v1/chat/completions')).toBe(true);
    expect(isAllowedTarget('http://localhost:11434/v1/models')).toBe(true);
    expect(isAllowedTarget('http://127.0.0.1:1234/v1/models')).toBe(true);
  });

  test('rejects plain http to other hosts, credentials in URLs and other schemes', () => {
    expect(isAllowedTarget('http://example.com/v1')).toBe(false);
    expect(isAllowedTarget('https://user:pass@example.com/')).toBe(false);
    expect(isAllowedTarget('file:///etc/passwd')).toBe(false);
    expect(isAllowedTarget('not a url')).toBe(false);
  });

  test('only answers on its own address', () => {
    expect(isOwnHost('localhost:4870', 4870)).toBe(true);
    expect(isOwnHost('127.0.0.1:4870', 4870)).toBe(true);
    expect(isOwnHost('evil.example:4870', 4870)).toBe(false);
    expect(isOwnHost('localhost:9999', 4870)).toBe(false);
  });
});

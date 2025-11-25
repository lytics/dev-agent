import { describe, expect, it } from 'vitest';
import { getPreset, presets } from './presets';

describe('presets', () => {
  it('has development preset with debug level and pretty format', () => {
    expect(presets.development).toEqual({
      level: 'debug',
      format: 'pretty',
    });
  });

  it('has production preset with info level and json format', () => {
    expect(presets.production).toEqual({
      level: 'info',
      format: 'json',
    });
  });

  it('has test preset with warn level and json format', () => {
    expect(presets.test).toEqual({
      level: 'warn',
      format: 'json',
    });
  });

  it('has silent preset with fatal level', () => {
    expect(presets.silent).toEqual({
      level: 'fatal',
      format: 'json',
    });
  });
});

describe('getPreset', () => {
  it('returns development preset by name', () => {
    expect(getPreset('development')).toBe(presets.development);
  });

  it('returns production preset by name', () => {
    expect(getPreset('production')).toBe(presets.production);
  });

  it('returns test preset by name', () => {
    expect(getPreset('test')).toBe(presets.test);
  });

  it('returns silent preset by name', () => {
    expect(getPreset('silent')).toBe(presets.silent);
  });

  it('falls back to development preset for unknown names', () => {
    expect(getPreset('unknown')).toBe(presets.development);
    expect(getPreset('')).toBe(presets.development);
    expect(getPreset('nonexistent')).toBe(presets.development);
  });
});

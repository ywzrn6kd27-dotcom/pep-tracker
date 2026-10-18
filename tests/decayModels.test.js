import { describe, it, expect } from 'vitest';
import { calculateLevel, wholeDaysBetween } from '../src/calculations/decayModels.js';
import { calculateConcentration, calculateDiluentVolume } from '../src/calculations/concentration.js';

describe('decay model', () => {
  it('matches a half-life after one half-life interval', () => {
    const rows = [{ date: '2026-01-01', compound: 'Reta', doseMg: 10 }];
    expect(calculateLevel(rows, 'Reta', '2026-01-07', { Reta: { halfLifeDays: 6 } })).toBeCloseTo(5);
  });
  it('ignores injections after the selected date and other compounds', () => {
    const rows = [
      { date: '2026-01-01', compound: 'Reta', doseMg: 10 },
      { date: '2026-01-05', compound: 'Tirz', doseMg: 5 },
      { date: '2026-01-10', compound: 'Reta', doseMg: 8 }
    ];
    expect(calculateLevel(rows, 'Reta', '2026-01-05', { Reta: { halfLifeDays: 6 } })).toBeCloseTo(10 * 2 ** (-4 / 6));
  });
  it('uses whole calendar days', () => {
    expect(wholeDaysBetween('2026-01-01', '2026-01-08')).toBe(7);
  });
});
describe('concentration arithmetic', () => {
  it('calculates mg/mL', () => expect(calculateConcentration(10, 2)).toBe(5));
  it('calculates volume from target concentration', () => expect(calculateDiluentVolume(10, 5)).toBe(2));
  it('rejects invalid volume', () => expect(calculateConcentration(10, 0)).toBeNull());
});

import { describe, expect, it } from 'vitest';
import { formatDuration, getStaleStatsWarning, getTimeSince, isStatsStale } from '../date-utils';

describe('date-utils', () => {
  describe('getTimeSince', () => {
    it('should return "just now" for very recent dates', () => {
      const date = new Date('2024-01-01T12:00:00');
      const now = new Date('2024-01-01T12:00:30'); // 30 seconds later

      expect(getTimeSince(date, now)).toBe('just now');
    });

    it('should return minutes for recent dates', () => {
      const date = new Date('2024-01-01T12:00:00');
      const now = new Date('2024-01-01T12:05:00'); // 5 minutes later

      expect(getTimeSince(date, now)).toBe('5 minutes ago');
    });

    it('should use singular for 1 minute', () => {
      const date = new Date('2024-01-01T12:00:00');
      const now = new Date('2024-01-01T12:01:00');

      expect(getTimeSince(date, now)).toBe('1 minute ago');
    });

    it('should return hours for dates within a day', () => {
      const date = new Date('2024-01-01T12:00:00');
      const now = new Date('2024-01-01T15:00:00'); // 3 hours later

      expect(getTimeSince(date, now)).toBe('3 hours ago');
    });

    it('should use singular for 1 hour', () => {
      const date = new Date('2024-01-01T12:00:00');
      const now = new Date('2024-01-01T13:00:00');

      expect(getTimeSince(date, now)).toBe('1 hour ago');
    });

    it('should return days for dates within a week', () => {
      const date = new Date('2024-01-01T12:00:00');
      const now = new Date('2024-01-03T12:00:00'); // 2 days later

      expect(getTimeSince(date, now)).toBe('2 days ago');
    });

    it('should use singular for 1 day', () => {
      const date = new Date('2024-01-01T12:00:00');
      const now = new Date('2024-01-02T12:00:00');

      expect(getTimeSince(date, now)).toBe('1 day ago');
    });

    it('should return formatted date for dates older than a week', () => {
      const date = new Date('2024-01-01T12:00:00');
      const now = new Date('2024-01-10T12:00:00'); // 9 days later

      const result = getTimeSince(date, now);
      expect(result).toContain('1/1/2024'); // Format may vary by locale
    });

    it('should use current date when now not provided', () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const result = getTimeSince(oneMinuteAgo);

      expect(result).toMatch(/1 minute ago|just now/);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds for durations under 1 second', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(0)).toBe('0ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds for durations under 1 minute', () => {
      expect(formatDuration(1000)).toBe('1.00s');
      expect(formatDuration(5500)).toBe('5.50s');
      expect(formatDuration(59999)).toBe('60.00s');
    });

    it('should format minutes and seconds for longer durations', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(125000)).toBe('2m 5s');
      expect(formatDuration(3600000)).toBe('60m 0s');
    });
  });

  describe('isStatsStale', () => {
    it('should return false for updates below threshold', () => {
      expect(isStatsStale(0)).toBe(false);
      expect(isStatsStale(5)).toBe(false);
      expect(isStatsStale(10)).toBe(false);
    });

    it('should return true for updates above threshold', () => {
      expect(isStatsStale(11)).toBe(true);
      expect(isStatsStale(20)).toBe(true);
      expect(isStatsStale(100)).toBe(true);
    });

    it('should respect custom threshold', () => {
      expect(isStatsStale(5, 3)).toBe(true);
      expect(isStatsStale(3, 3)).toBe(false);
      expect(isStatsStale(20, 50)).toBe(false);
    });
  });

  describe('getStaleStatsWarning', () => {
    it('should return undefined for fresh stats', () => {
      expect(getStaleStatsWarning(0)).toBeUndefined();
      expect(getStaleStatsWarning(5)).toBeUndefined();
      expect(getStaleStatsWarning(10)).toBeUndefined();
    });

    it('should return warning message for stale stats', () => {
      const warning = getStaleStatsWarning(11);
      expect(warning).toBeDefined();
      expect(warning).toContain('dev index');
    });

    it('should respect custom threshold', () => {
      expect(getStaleStatsWarning(5, 3)).toBeDefined();
      expect(getStaleStatsWarning(3, 3)).toBeUndefined();
    });
  });
});

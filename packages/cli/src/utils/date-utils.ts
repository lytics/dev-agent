/**
 * Date utility functions for formatting and display
 * Pure functions for testability
 */

/**
 * Get human-readable time since a date
 * Pure function
 */
export function getTimeSince(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  }
  return date.toLocaleDateString();
}

/**
 * Get formatted duration string
 * Pure function
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Check if stats are potentially stale based on update count
 * Pure function
 */
export function isStatsStale(incrementalUpdatesSince: number, threshold = 10): boolean {
  return incrementalUpdatesSince > threshold;
}

/**
 * Get warning message for stale stats
 * Pure function
 */
export function getStaleStatsWarning(
  incrementalUpdatesSince: number,
  threshold = 10
): string | undefined {
  if (!isStatsStale(incrementalUpdatesSince, threshold)) {
    return undefined;
  }
  return "Consider running 'dev index' for most accurate statistics";
}

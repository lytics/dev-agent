import chalk from 'chalk';
import logUpdate from 'log-update';

/**
 * Progress section renderer for clean, informative CLI output.
 * Inspired by Homebrew/Cargo section-based progress.
 */

export interface SectionProgress {
  title: string;
  status: 'active' | 'complete' | 'idle';
  details?: string;
  duration?: number;
}

export class ProgressRenderer {
  private sections: SectionProgress[] = [];
  private currentSection = 0;
  private lastRenderTime = 0;
  private isVerbose = false;
  private isTTY = process.stdout.isTTY ?? false;

  constructor(options: { verbose?: boolean } = {}) {
    this.isVerbose = options.verbose ?? false;
  }

  /**
   * Initialize sections for the indexing process
   */
  setSections(sections: string[]): void {
    this.sections = sections.map((title, index) => ({
      title,
      status: index === 0 ? 'active' : 'idle',
    }));
  }

  /**
   * Update the current active section with progress details
   */
  updateSection(details: string): void {
    // In verbose mode or non-TTY, don't use log-update
    if (this.isVerbose || !this.isTTY) {
      return;
    }

    // Throttle updates to once per second for smoothness
    const now = Date.now();
    if (now - this.lastRenderTime < 1000) {
      return;
    }
    this.lastRenderTime = now;

    if (this.sections[this.currentSection]) {
      this.sections[this.currentSection].details = details;
      this.render();
    }
  }

  /**
   * Update section with formatted progress including rate
   */
  updateSectionWithRate(processed: number, total: number, unit: string, startTime: number): void {
    if (total === 0) {
      this.updateSection('Discovering repository... this process may take 3-5 minutes');
      return;
    }

    const pct = Math.round((processed / total) * 100);
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = elapsed > 0 ? processed / elapsed : 0;
    this.updateSection(
      `${processed.toLocaleString()}/${total.toLocaleString()} ${unit} (${pct}%, ${rate.toFixed(0)} ${unit}/sec)`
    );
  }

  /**
   * Mark current section as complete and move to next
   */
  completeSection(summary: string, duration?: number): void {
    if (this.sections[this.currentSection]) {
      this.sections[this.currentSection].status = 'complete';
      this.sections[this.currentSection].details = summary;
      this.sections[this.currentSection].duration = duration;
    }

    // In verbose mode or non-TTY, just log the completion
    if (this.isVerbose || !this.isTTY) {
      console.log(`${chalk.green('✓')} ${this.sections[this.currentSection]?.title}: ${summary}`);
      return;
    }

    // Move to next section
    this.currentSection++;
    if (this.sections[this.currentSection]) {
      this.sections[this.currentSection].status = 'active';
    }

    // Render the updated state (but don't persist yet - only done() at the very end)
    this.render();
  }

  /**
   * Render all sections
   */
  private render(): void {
    if (this.isVerbose || !this.isTTY) {
      return;
    }

    const lines: string[] = [];

    for (const section of this.sections) {
      const icon = this.getIcon(section.status);
      const title = chalk.bold(section.title);

      if (section.status === 'idle') {
        // Idle section - just show title
        lines.push(`${chalk.gray(icon)} ${chalk.gray(title)}`);
      } else if (section.status === 'active') {
        // Active section - show title + details
        lines.push(`${icon} ${title}`);
        if (section.details) {
          lines.push(`  ${chalk.cyan(section.details)}`);
        }
      } else {
        // Complete section - show title + summary + duration
        const duration = section.duration ? chalk.gray(` (${section.duration.toFixed(1)}s)`) : '';
        lines.push(`${icon} ${title}${duration}`);
        if (section.details) {
          lines.push(`  ${chalk.gray(section.details)}`);
        }
      }
    }

    logUpdate(lines.join('\n'));
  }

  private getIcon(status: SectionProgress['status']): string {
    switch (status) {
      case 'complete':
        return chalk.green('✓');
      case 'active':
        return chalk.cyan('▸');
      case 'idle':
        return chalk.gray('○');
    }
  }

  /**
   * Clear the progress display
   */
  clear(): void {
    if (!this.isVerbose && this.isTTY) {
      logUpdate.clear();
    }
  }

  /**
   * Finalize and persist the display
   */
  done(): void {
    if (!this.isVerbose && this.isTTY) {
      logUpdate.done();
    }
  }
}

/**
 * Format final summary with helpful next steps
 */
export function formatFinalSummary(stats: {
  code: { files: number; documents: number };
  git?: { commits: number };
  github?: { documents: number };
  totalDuration: number;
}): string {
  const lines: string[] = [];

  // Success message
  lines.push('');
  lines.push(chalk.green.bold('✓ Repository indexed successfully!'));
  lines.push('');

  // Summary stats
  const parts: string[] = [];
  parts.push(`${formatNumber(stats.code.files)} files`);
  parts.push(`${formatNumber(stats.code.documents)} components`);
  if (stats.git) parts.push(`${formatNumber(stats.git.commits)} commits`);
  if (stats.github) parts.push(`${formatNumber(stats.github.documents)} GitHub docs`);

  lines.push(`  ${chalk.bold('Indexed:')} ${parts.join(' • ')}`);
  lines.push(`  ${chalk.bold('Duration:')} ${stats.totalDuration.toFixed(1)}s`);
  lines.push('');

  // Next steps
  lines.push(chalk.dim('💡 Next steps:'));
  lines.push(`   ${chalk.cyan('dev map')}       ${chalk.dim('Explore codebase structure')}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format large numbers with commas
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

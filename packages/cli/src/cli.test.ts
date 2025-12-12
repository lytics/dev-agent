import { describe, expect, it } from 'vitest';
import { cleanCommand } from './commands/clean';
import { indexCommand } from './commands/index';
import { initCommand } from './commands/init';
import { searchCommand } from './commands/search';
import { statsCommand } from './commands/stats';
import { updateCommand } from './commands/update';

describe('CLI Structure', () => {
  it('should have init command', () => {
    expect(initCommand.name()).toBe('init');
    expect(initCommand.description()).toContain('Initialize');
  });

  it('should have index command', () => {
    expect(indexCommand.name()).toBe('index');
    expect(indexCommand.description()).toContain('Index');
  });

  it('should have search command', () => {
    expect(searchCommand.name()).toBe('search');
    expect(searchCommand.description()).toContain('Search');
  });

  it('should have update command', () => {
    expect(updateCommand.name()).toBe('update');
    expect(updateCommand.description()).toContain('Update');
  });

  it('should have stats command', () => {
    expect(statsCommand.name()).toBe('stats');
    expect(statsCommand.description()).toContain('statistics');
  });

  it('should have clean command', () => {
    expect(cleanCommand.name()).toBe('clean');
    expect(cleanCommand.description()).toContain('Clean');
  });

  describe('Command Options', () => {
    it('index command should have force and verbose options', () => {
      const options = indexCommand.options;
      const forceOption = options.find((opt) => opt.long === '--force');
      const verboseOption = options.find((opt) => opt.long === '--verbose');

      expect(forceOption).toBeDefined();
      expect(verboseOption).toBeDefined();
    });

    it('search command should have limit, threshold, and json options', () => {
      const options = searchCommand.options;
      const limitOption = options.find((opt) => opt.long === '--limit');
      const thresholdOption = options.find((opt) => opt.long === '--threshold');
      const jsonOption = options.find((opt) => opt.long === '--json');

      expect(limitOption).toBeDefined();
      expect(thresholdOption).toBeDefined();
      expect(jsonOption).toBeDefined();
    });

    it('stats command should have show subcommand with json option', () => {
      const subcommands = statsCommand.commands;
      const showCommand = subcommands.find((cmd) => cmd.name() === 'show');

      expect(showCommand).toBeDefined();

      if (showCommand) {
        const jsonOption = showCommand.options.find((opt) => opt.long === '--json');
        expect(jsonOption).toBeDefined();
      }
    });

    it('clean command should have force option', () => {
      const options = cleanCommand.options;
      const forceOption = options.find((opt) => opt.long === '--force');

      expect(forceOption).toBeDefined();
    });
  });
});

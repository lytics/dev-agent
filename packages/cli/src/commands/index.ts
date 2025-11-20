// CLI commands
export interface CommandDefinition {
  name: string;
  description: string;
  options: Array<{
    flag: string;
    description: string;
  }>;
  action: (options: Record<string, unknown>) => Promise<void>;
}

// Will be implemented using Commander.js
export const commands: CommandDefinition[] = [
  {
    name: 'scan',
    description: 'Scan repository and build context',
    options: [
      {
        flag: '--path <path>',
        description: 'Path to repository',
      },
    ],
    action: async (options) => {
      console.log('Scanning repository at:', options.path);
    },
  },
  {
    name: 'serve',
    description: 'Start the context API server',
    options: [
      {
        flag: '--port <port>',
        description: 'Port for API server',
      },
    ],
    action: async (options) => {
      console.log('Starting API server on port:', options.port || 3000);
    },
  },
];

const config = {
  logo: (
    <span className="font-bold text-lg">
      <span className="text-blue-500">dev</span>-agent
    </span>
  ),
  project: {
    link: 'https://github.com/lytics/dev-agent',
  },
  docsRepositoryBase: 'https://github.com/lytics/dev-agent/tree/main/website/content',
  footer: {
    content: (
      <span>
        MIT {new Date().getFullYear()} ©{' '}
        <a href="https://github.com/lytics" target="_blank" rel="noreferrer">
          Lytics
        </a>
      </span>
    ),
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta
        name="description"
        content="dev-agent: Local semantic code search for Cursor and Claude Code. 44% cheaper, 19% faster."
      />
      <meta name="og:title" content="dev-agent" />
      <meta
        name="og:description"
        content="Local semantic code search via MCP. Measured: 44% cost reduction, 19% faster."
      />
    </>
  ),
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
  toc: {
    backToTop: true,
  },
  editLink: {
    content: 'Edit this page on GitHub →',
  },
  feedback: {
    content: 'Question? Give us feedback →',
    labels: 'feedback',
  },
  navigation: {
    prev: true,
    next: true,
  },
  darkMode: true,
  nextThemes: {
    defaultTheme: 'dark',
  },
};

export default config;

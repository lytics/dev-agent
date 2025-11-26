import nextra from 'nextra';

const withNextra = nextra({
  // Use default content directory
});

export default withNextra({
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true, // Required for static export
  },
  basePath: '/dev-agent', // GitHub Pages serves from /repo-name
});

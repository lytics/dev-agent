import { Analytics } from '@vercel/analytics/react';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import 'nextra-theme-docs/style.css';
import './globals.css';

export const metadata = {
  title: {
    default: 'dev-agent',
    template: '%s | dev-agent',
  },
  description: 'AI-native code intelligence for Cursor and Claude Code',
};

const logo = (
  <span style={{ fontWeight: 'bold' }}>
    <span style={{ color: '#3b82f6' }}>dev</span>-agent
  </span>
);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pageMap = await getPageMap();

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head faviconGlyph="🤖" />
      <body>
        <Layout
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/lytics/dev-agent/tree/main/website/content"
          editLink="Edit this page on GitHub"
          sidebar={{ defaultMenuCollapseLevel: 1 }}
          navbar={<Navbar logo={logo} projectLink="https://github.com/lytics/dev-agent" />}
          footer={<Footer>MIT {new Date().getFullYear()} © Contentstack</Footer>}
        >
          {children}
        </Layout>
        <Analytics />
      </body>
    </html>
  );
}

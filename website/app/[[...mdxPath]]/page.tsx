import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { useMDXComponents } from 'nextra-theme-docs';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

export async function generateMetadata(props: { params: Promise<{ mdxPath?: string[] }> }) {
  const params = await props.params;
  const { metadata } = await importPage(params.mdxPath);
  return metadata;
}

export default async function Page(props: { params: Promise<{ mdxPath?: string[] }> }) {
  const params = await props.params;
  const result = await importPage(params.mdxPath);
  const { default: MDXContent, ...rest } = result;
  const { wrapper: Wrapper } = useMDXComponents();

  return (
    <Wrapper {...rest}>
      <MDXContent />
    </Wrapper>
  );
}

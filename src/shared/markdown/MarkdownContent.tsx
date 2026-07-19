import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const safeUrlTransform = (url: string) => {
  const transformed = defaultUrlTransform(url);
  return /^(https?:|mailto:|#|\/(?!\/))/i.test(transformed) ? transformed : '';
};

export function MarkdownContent({ value }: { value: string }) {
  return <div className="markdown-content">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      urlTransform={safeUrlTransform}
      components={{
        a: ({ href, children }) => href
          ? <a href={href} target={/^https?:/i.test(href) ? '_blank' : undefined} rel={/^https?:/i.test(href) ? 'noopener noreferrer' : undefined}>{children}</a>
          : <span>{children}</span>,
        img: ({ alt }) => <span className="markdown-image-placeholder">{alt ? `图片：${alt}` : '图片'}</span>,
      }}
    >{value}</ReactMarkdown>
  </div>;
}

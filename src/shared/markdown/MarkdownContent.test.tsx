import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './MarkdownContent';

describe('MarkdownContent', () => {
  it('renders GFM without raw HTML and blocks unsafe links', () => {
    render(<MarkdownContent value={'| A | B |\n|---|---|\n| 1 | 2 |\n\n<script>alert(1)</script>\n[bad](javascript:alert(1))'} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.queryByRole('link', { name: 'bad' })).toBeNull();
  });

  it('opens external links with safe attributes', () => {
    render(<MarkdownContent value="[OpenAI](https://openai.com/)" />);

    expect(screen.getByRole('link', { name: 'OpenAI' })).toMatchObject({
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });

  it('keeps safe internal and email links usable without external-link attributes', () => {
    render(<MarkdownContent value="[section](#details) [mail](mailto:hi@example.com) [path](/problems)" />);

    expect(screen.getByRole('link', { name: 'section' })).toHaveAttribute('href', '#details');
    expect(screen.getByRole('link', { name: 'mail' })).toHaveAttribute('href', 'mailto:hi@example.com');
    expect(screen.getByRole('link', { name: 'path' })).toHaveAttribute('href', '/problems');
    expect(screen.getByRole('link', { name: 'section' })).not.toHaveAttribute('target');
  });

  it('rejects protocol-relative links', () => {
    render(<MarkdownContent value="[unsafe](//evil.example/path)" />);

    expect(screen.queryByRole('link', { name: 'unsafe' })).toBeNull();
  });
});

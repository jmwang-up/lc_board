import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SOLUTION_MARKDOWN_MAX_LENGTH } from '../../domain/models';
import { MarkdownEditor } from './MarkdownEditor';

describe('MarkdownEditor', () => {
  it('keeps content across edit and preview tabs and reports the exact count', async () => {
    function Harness() {
      const [value, setValue] = useState('');
      return <MarkdownEditor value={value} onChange={setValue} />;
    }

    render(<Harness />);
    await userEvent.type(screen.getByLabelText('解题思路'), '# 哈希表');

    expect(screen.getByText('5 / 20000')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: '预览' }));
    expect(screen.getByRole('heading', { name: '哈希表' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: '编辑' }));
    expect(screen.getByLabelText('解题思路')).toHaveValue('# 哈希表');
  });

  it('moves focus and selection between tabs with arrow, Home, and End keys', async () => {
    render(<MarkdownEditor value="内容" onChange={vi.fn()} />);
    const edit = screen.getByRole('tab', { name: '编辑' });
    const preview = screen.getByRole('tab', { name: '预览' });

    edit.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(preview).toHaveFocus();
    expect(preview).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{Home}');
    expect(edit).toHaveFocus();
    expect(edit).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{End}');
    expect(preview).toHaveFocus();
    expect(preview).toHaveAttribute('aria-selected', 'true');
  });

  it('accepts exactly 20,000 characters', () => {
    render(<MarkdownEditor value={'a'.repeat(SOLUTION_MARKDOWN_MAX_LENGTH)} onChange={vi.fn()} />);

    expect(screen.getByText('20000 / 20000')).toBeInTheDocument();
    expect(screen.getByLabelText('解题思路')).toHaveAttribute('maxLength', '20001');
  });

  it('reports 20,001 characters and surfaces a validation error', () => {
    render(<MarkdownEditor value={'a'.repeat(SOLUTION_MARKDOWN_MAX_LENGTH + 1)} onChange={vi.fn()} error="解题思路不能超过 20000 个字符" />);

    expect(screen.getByText('20001 / 20000')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('解题思路不能超过 20000 个字符');
  });

  it('calls onChange for the 20,001st character', async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor value={'a'.repeat(SOLUTION_MARKDOWN_MAX_LENGTH)} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('解题思路'), 'b');

    expect(onChange).toHaveBeenLastCalledWith('a'.repeat(SOLUTION_MARKDOWN_MAX_LENGTH) + 'b');
  });

  it('disables both tabs and the textarea when disabled', () => {
    render(<MarkdownEditor value="内容" onChange={vi.fn()} disabled />);

    expect(screen.getByRole('tab', { name: '编辑' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: '预览' })).toBeDisabled();
    expect(screen.getByLabelText('解题思路')).toBeDisabled();
  });

  it('shows empty preview guidance', async () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('tab', { name: '预览' }));
    expect(screen.getByText('尚未填写解题思路')).toBeInTheDocument();
  });

  it('exposes rendering or validation errors as alerts', () => {
    render(<MarkdownEditor value="内容" onChange={vi.fn()} error="Markdown 渲染失败" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Markdown 渲染失败');
  });
});

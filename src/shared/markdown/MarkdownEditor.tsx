import { useRef, useState, type KeyboardEvent } from 'react';
import { SOLUTION_MARKDOWN_MAX_LENGTH } from '../../domain/models';
import { MarkdownContent } from './MarkdownContent';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

type EditorTab = 'edit' | 'preview';

const editorTabs: EditorTab[] = ['edit', 'preview'];

export function MarkdownEditor({ value, onChange, disabled = false, error }: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('edit');
  const tabRefs = useRef<Record<EditorTab, HTMLButtonElement | null>>({ edit: null, preview: null });

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = editorTabs.indexOf(activeTab);
    const nextTab = event.key === 'Home'
      ? 'edit'
      : event.key === 'End'
        ? 'preview'
        : event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? editorTabs[(currentIndex + 1) % editorTabs.length]
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? editorTabs[(currentIndex - 1 + editorTabs.length) % editorTabs.length]
            : undefined;

    if (!nextTab) return;
    event.preventDefault();
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return <section className="solution-editor">
    <div role="tablist" aria-label="解题思路编辑方式" className="solution-editor-tabs">
      <button
        id="solution-editor-edit-tab"
        type="button"
        role="tab"
        aria-selected={activeTab === 'edit'}
        aria-controls="solution-editor-edit-panel"
        disabled={disabled}
        ref={element => { tabRefs.current.edit = element; }}
        onClick={() => setActiveTab('edit')}
        onKeyDown={handleTabKeyDown}
      >编辑</button>
      <button
        id="solution-editor-preview-tab"
        type="button"
        role="tab"
        aria-selected={activeTab === 'preview'}
        aria-controls="solution-editor-preview-panel"
        disabled={disabled}
        ref={element => { tabRefs.current.preview = element; }}
        onClick={() => setActiveTab('preview')}
        onKeyDown={handleTabKeyDown}
      >预览</button>
    </div>

    {activeTab === 'edit' ? <div id="solution-editor-edit-panel" role="tabpanel" aria-labelledby="solution-editor-edit-tab">
      <label htmlFor="solution-markdown">解题思路</label>
      <textarea
        id="solution-markdown"
        value={value}
        disabled={disabled}
        maxLength={SOLUTION_MARKDOWN_MAX_LENGTH + 1}
        onChange={event => onChange(event.target.value)}
      />
    </div> : <div id="solution-editor-preview-panel" role="tabpanel" aria-labelledby="solution-editor-preview-tab" className="solution-editor-preview">
      {value ? <MarkdownContent value={value} /> : <p>尚未填写解题思路</p>}
    </div>}

    <p className="solution-editor-count" aria-live="polite">{value.length} / {SOLUTION_MARKDOWN_MAX_LENGTH}</p>
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}

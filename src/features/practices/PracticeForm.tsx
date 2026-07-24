import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { SOLUTION_MARKDOWN_MAX_LENGTH, type Algorithm } from '../../domain/models';
import { localToday } from '../../shared/date';
import { MarkdownEditor } from '../../shared/markdown/MarkdownEditor';
import type { AlgorithmTarget } from './practiceSession';

export const practiceFormSchema = z.object({
  url: z.string().min(1, '请输入题目链接'),
  frontendQuestionId: z.string().min(1, '请输入题号'),
  titleZh: z.string().min(1, '请输入中文题名'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  practicedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '请输入有效日期'),
  primaryAlgorithmId: z.string().min(1, '请选择主要算法'),
  secondaryAlgorithmIds: z.array(z.string()),
  solutionMarkdown: z.string().max(SOLUTION_MARKDOWN_MAX_LENGTH, '解题思路不能超过 20000 个字符'),
}).superRefine((value, ctx) => {
  if (value.secondaryAlgorithmIds.includes(value.primaryAlgorithmId)) ctx.addIssue({ code: 'custom', path: ['secondaryAlgorithmIds'], message: '辅助算法不能与主要算法重复' });
  if (new Set(value.secondaryAlgorithmIds).size !== value.secondaryAlgorithmIds.length) ctx.addIssue({ code: 'custom', path: ['secondaryAlgorithmIds'], message: '辅助算法不能重复' });
});

export type PracticeFormValues = z.infer<typeof practiceFormSchema>;

interface PracticeFormProps {
  algorithms: Algorithm[];
  values: Partial<PracticeFormValues>;
  saving: boolean;
  saveError?: string;
  onSubmit: (values: PracticeFormValues) => Promise<void>;
  onAddAlgorithm: (target: AlgorithmTarget, values: PracticeFormValues) => void;
}

export function PracticeForm({ algorithms, values, saving, saveError, onSubmit, onAddAlgorithm }: PracticeFormProps) {
  const { register, handleSubmit, reset, setValue, control, watch, getValues, formState: { errors } } = useForm<PracticeFormValues>({
    resolver: zodResolver(practiceFormSchema),
    defaultValues: { difficulty: 'easy', practicedOn: localToday(), secondaryAlgorithmIds: [], solutionMarkdown: '', primaryAlgorithmId: '', ...values },
  });
  useEffect(() => {
    reset({ difficulty: 'easy', practicedOn: localToday(), secondaryAlgorithmIds: [], solutionMarkdown: '', primaryAlgorithmId: '', ...values });
  }, [reset, values.frontendQuestionId, values.titleZh, values.difficulty, values.solutionMarkdown]);
  useEffect(() => {
    setValue('url', values.url ?? '');
  }, [setValue, values.url]);
  const error = Object.entries(errors).find(([name]) => name !== 'solutionMarkdown')?.[1]?.message;
  const solutionTooLong = (watch('solutionMarkdown') ?? '').length > SOLUTION_MARKDOWN_MAX_LENGTH;
  return <form onSubmit={handleSubmit(onSubmit)}>
    <label>题号<input {...register('frontendQuestionId')} /></label>
    <label>中文题名<input {...register('titleZh')} /></label>
    <label>难度<select {...register('difficulty')}><option value="easy">简单</option><option value="medium">中等</option><option value="hard">困难</option></select></label>
    <label>练习日期<input type="date" {...register('practicedOn')} /></label>
    <div className="algorithm-field-heading">
      <label>主要算法<select {...register('primaryAlgorithmId')}><option value="">请选择</option>{algorithms.map(algorithm => <option key={algorithm.id} value={algorithm.id}>{algorithm.name}</option>)}</select></label>
      <button type="button" aria-label="添加主要算法" disabled={saving} onClick={() => onAddAlgorithm('primary', getValues())}>＋ 添加新算法</button>
    </div>
    <fieldset><legend className="algorithm-legend">辅助算法<button type="button" aria-label="添加辅助算法" disabled={saving} onClick={() => onAddAlgorithm('secondary', getValues())}>＋ 添加新算法</button></legend>{algorithms.map(algorithm => <label key={algorithm.id}><input type="checkbox" value={algorithm.id} {...register('secondaryAlgorithmIds')} />{algorithm.name}</label>)}</fieldset>
    <Controller
      name="solutionMarkdown"
      control={control}
      render={({ field, fieldState }) => <MarkdownEditor
        value={field.value}
        onChange={field.onChange}
        disabled={saving}
        error={fieldState.error?.message ?? (solutionTooLong ? '解题思路不能超过 20000 个字符' : undefined)}
      />}
    />
    <input type="hidden" {...register('url')} />
    {error && <p role="alert">{String(error)}</p>}
    {saveError && <p role="alert">{saveError}</p>}
    <button type="submit" disabled={saving || solutionTooLong}>{saving ? '保存中…' : '保存练习'}</button>
  </form>;
}

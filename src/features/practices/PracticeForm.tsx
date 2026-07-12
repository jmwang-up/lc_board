import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { Algorithm } from '../../domain/models';
import { localToday } from '../../shared/date';

export const practiceFormSchema = z.object({
  url: z.string().min(1, '请输入题目链接'),
  frontendQuestionId: z.string().min(1, '请输入题号'),
  titleZh: z.string().min(1, '请输入中文题名'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  practicedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '请输入有效日期'),
  primaryAlgorithmId: z.string().min(1, '请选择主要算法'),
  secondaryAlgorithmIds: z.array(z.string()),
}).superRefine((value, ctx) => {
  if (value.secondaryAlgorithmIds.includes(value.primaryAlgorithmId)) ctx.addIssue({ code: 'custom', path: ['secondaryAlgorithmIds'], message: '辅助算法不能与主要算法重复' });
  if (new Set(value.secondaryAlgorithmIds).size !== value.secondaryAlgorithmIds.length) ctx.addIssue({ code: 'custom', path: ['secondaryAlgorithmIds'], message: '辅助算法不能重复' });
});

export type PracticeFormValues = z.infer<typeof practiceFormSchema>;

export function PracticeForm({ algorithms, values, saving, saveError, onSubmit }: { algorithms: Algorithm[]; values: Partial<PracticeFormValues>; saving: boolean; saveError?: string; onSubmit: (values: PracticeFormValues) => Promise<void> }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PracticeFormValues>({
    resolver: zodResolver(practiceFormSchema),
    defaultValues: { difficulty: 'easy', practicedOn: localToday(), secondaryAlgorithmIds: [], ...values },
  });
  useEffect(() => {
    reset({ difficulty: 'easy', practicedOn: localToday(), secondaryAlgorithmIds: [], ...values });
  }, [reset, values.url, values.frontendQuestionId, values.titleZh, values.difficulty]);
  const error = Object.values(errors)[0]?.message;
  return <form onSubmit={handleSubmit(onSubmit)}>
    <label>题号<input {...register('frontendQuestionId')} /></label>
    <label>中文题名<input {...register('titleZh')} /></label>
    <label>难度<select {...register('difficulty')}><option value="easy">简单</option><option value="medium">中等</option><option value="hard">困难</option></select></label>
    <label>练习日期<input type="date" {...register('practicedOn')} /></label>
    <label>主要算法<select {...register('primaryAlgorithmId')}><option value="">请选择</option>{algorithms.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <fieldset><legend>辅助算法</legend>{algorithms.map(a => <label key={a.id}><input type="checkbox" value={a.id} {...register('secondaryAlgorithmIds')} />{a.name}</label>)}</fieldset>
    <input type="hidden" {...register('url')} />
    {error && <p role="alert">{String(error)}</p>}
    {saveError && <p role="alert">{saveError}</p>}
    <button type="submit" disabled={saving}>{saving ? '保存中…' : '保存练习'}</button>
  </form>;
}

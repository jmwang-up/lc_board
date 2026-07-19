import { useCallback, useEffect, useState } from 'react';
import { useRepository } from '../../app/RepositoryContext';
import type { Algorithm } from '../../domain/models';

export function useAlgorithms(reloadVersion = 0): { algorithms: Algorithm[]; reload: () => Promise<void>; loading: boolean; loadError: string } {
  const repository = useRepository();
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setAlgorithms(await repository.listAlgorithms());
    } catch {
      setAlgorithms([]);
      setLoadError('算法分类加载失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => { void reload(); }, [reload, reloadVersion]);
  return { algorithms, reload, loading, loadError };
}

import { useCallback, useEffect, useState } from 'react';
import { useRepository } from '../../app/RepositoryContext';
import type { Algorithm } from '../../domain/models';

export function useAlgorithms(): { algorithms: Algorithm[]; reload: () => Promise<void>; loading: boolean } {
  const repository = useRepository();
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setAlgorithms(await repository.listAlgorithms());
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => { void reload(); }, [reload]);
  return { algorithms, reload, loading };
}

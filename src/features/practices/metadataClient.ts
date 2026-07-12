import type { ProblemMetadata } from '../../domain/models';

export type MetadataErrorCode =
  | 'INVALID_SLUG'
  | 'NOT_FOUND'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_CHANGED';

export class MetadataError extends Error {
  constructor(
    public readonly code: MetadataErrorCode,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'MetadataError';
  }
}

export async function fetchProblemMetadata(
  slug: string,
  signal?: AbortSignal,
): Promise<ProblemMetadata> {
  const response = await fetch(`/api/leetcode/problems/${encodeURIComponent(slug)}`, { signal });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const code = readErrorCode(payload) ?? 'UPSTREAM_CHANGED';
    throw new MetadataError(code, response.status);
  }

  return response.json() as Promise<ProblemMetadata>;
}

function readErrorCode(value: unknown): MetadataErrorCode | undefined {
  if (!value || typeof value !== 'object' || !('code' in value)) return undefined;
  const code = value.code;
  if (
    code === 'INVALID_SLUG' ||
    code === 'NOT_FOUND' ||
    code === 'UPSTREAM_TIMEOUT' ||
    code === 'UPSTREAM_CHANGED'
  ) {
    return code;
  }
  return undefined;
}

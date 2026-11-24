import { useEffect, useState } from 'react';
import { api, ApiError, type PublicSummary } from '../api';

// Reader: published articles with title, tags and first publish date (FR-011).

export function PublicList() {
  const [articles, setArticles] = useState<PublicSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listPublic().then(setArticles, (e: ApiError) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!articles) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>Documentation</h1>
      {articles.length === 0 ? (
        <p className="muted">No published articles.</p>
      ) : (
        <ul>
          {articles.map((a) => (
            <li key={a.slug}>
              <a href={`#/public/${a.slug}`}>{a.title}</a>{' '}
              <span className="muted">
                · {new Date(a.publishedAt).toLocaleDateString()}
                {a.tags.length > 0 && <> · {a.tags.join(', ')}</>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

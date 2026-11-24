import { useEffect, useState } from 'react';
import { api, ApiError, type PublicArticle as Article } from '../api';
import { renderMarkdown } from '../markdown';

// Reader: one published article, rendered from its referenced version (FR-012).
// Anything not published answers 404 and is shown as "not found" (FR-013).

export function PublicArticle({ slug }: { slug: string }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPublic(slug).then(setArticle, (e: ApiError) => {
      if (e.status === 404) setNotFound(true);
      else setError(e.message);
    });
  }, [slug]);

  if (notFound) {
    return (
      <>
        <h1>Not found</h1>
        <p className="muted">This article does not exist.</p>
        <a href="#/public">← All articles</a>
      </>
    );
  }
  if (error) return <p className="error">{error}</p>;
  if (!article) return <p className="muted">Loading…</p>;

  return (
    <article>
      <p>
        <a href="#/public">← All articles</a>
      </p>
      <h1>{article.title}</h1>
      <p className="muted">
        First published {new Date(article.publishedAt).toLocaleDateString()}
        {article.tags.length > 0 && <> · {article.tags.join(', ')}</>}
      </p>
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }} />
    </article>
  );
}

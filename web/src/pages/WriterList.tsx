import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, parseTags, type ArticleSummary } from '../api';

// Writer: list of articles with status, and the create form (US1).

export function WriterList() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = () => {
    api.listArticles().then(setArticles, (e: ApiError) => setError(e.message));
  };

  useEffect(load, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    try {
      const created = await api.createArticle({ title, slug, body, tags: parseTags(tags) });
      // FR-017: tell the writer the final slug (it may have a -2, -3... suffix).
      setInfo(`Article created as a draft with the slug "${created.slug}".`);
      setTitle('');
      setSlug('');
      setBody('');
      setTags('');
      load();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <>
      <h1>Articles</h1>
      {articles.length === 0 ? (
        <p className="muted">No articles yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title (draft)</th>
              <th>Slug</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.id}>
                <td>
                  <a href={`#/articles/${a.id}`}>{a.title}</a>
                </td>
                <td>{a.slug}</td>
                <td>{a.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>New article</h2>
      <form onSubmit={onCreate}>
        <label htmlFor="new-title">Title</label>
        <input id="new-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label htmlFor="new-slug">Slug (lowercase letters, digits, hyphens)</label>
        <input id="new-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <label htmlFor="new-tags">Tags (comma-separated)</label>
        <input id="new-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        <label htmlFor="new-body">Body (Markdown)</label>
        <textarea id="new-body" value={body} onChange={(e) => setBody(e.target.value)} />
        <button type="submit">Create draft</button>
      </form>
      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}
    </>
  );
}

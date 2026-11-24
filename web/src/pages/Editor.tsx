import { useEffect, useState } from 'react';
import { api, ApiError, parseTags, type Article, type DraftSnapshot } from '../api';
import { renderMarkdown } from '../markdown';

// Writer: edit the draft with a Markdown preview (US2). Every save sends
// expectedDraftVersion; an outdated copy is refused with STALE_DRAFT.

export function Editor({ id }: { id: number }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [current, setCurrent] = useState<DraftSnapshot | null>(null);
  const [notFound, setNotFound] = useState(false);

  function show(a: Article) {
    setArticle(a);
    setTitle(a.title);
    setBody(a.body);
    setTags(a.tags.join(', '));
    setCurrent(null);
  }

  useEffect(() => {
    api.getArticle(id).then(show, (e: ApiError) => {
      if (e.status === 404) setNotFound(true);
      else setError(e.message);
    });
  }, [id]);

  function fail(err: unknown) {
    const e = err as ApiError;
    setError(e.message);
    if (e.code === 'STALE_DRAFT' && e.draft) setCurrent(e.draft);
  }

  async function onSave() {
    if (!article) return;
    setError(null);
    setInfo(null);
    try {
      const saved = await api.saveDraft(article.id, {
        title,
        body,
        tags: parseTags(tags),
        expectedDraftVersion: article.draftVersion,
      });
      show(saved);
      setInfo('Draft saved. Readers still see the published version until you publish.');
    } catch (err) {
      fail(err);
    }
  }

  // US1 / US3: publish the saved draft, or unpublish. Errors (STALE_DRAFT,
  // ARTICLE_NOT_PUBLISHED) are shown with their message.
  async function onPublish() {
    if (!article) return;
    setError(null);
    setInfo(null);
    try {
      const published = await api.publish(article.id, article.draftVersion);
      show(published);
      setInfo(`Published. Readers now see version ${published.lastPublishedVersionNumber}.`);
    } catch (err) {
      fail(err);
    }
  }

  async function onUnpublish() {
    if (!article) return;
    setError(null);
    setInfo(null);
    try {
      show(await api.unpublish(article.id));
      setInfo('Unpublished. Readers no longer see this article; its versions are kept.');
    } catch (err) {
      fail(err);
    }
  }

  // STALE_DRAFT: load the current draft (the writer's unsaved changes are replaced).
  async function onLoadCurrent() {
    if (!article) return;
    show(await api.getArticle(article.id));
    setError(null);
  }

  if (notFound) return <p className="error">Article not found.</p>;
  if (!article) return <p className="muted">Loading…</p>;

  return (
    <>
      <p>
        <a href="#/">← Articles</a>
      </p>
      <h1>{article.title}</h1>
      <p className="muted">
        Slug <code>{article.slug}</code> · status <strong>{article.status}</strong>
        {article.lastPublishedVersionNumber !== null && <> · refers to version {article.lastPublishedVersionNumber}</>}
        {article.publishedAt && <> · first published {new Date(article.publishedAt).toLocaleString()}</>}
      </p>

      <label htmlFor="title">Title</label>
      <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor="tags">Tags (comma-separated)</label>
      <input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} />

      <div className="columns">
        <div>
          <label htmlFor="body">Body (Markdown)</label>
          <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div>
          <label>Preview</label>
          <div className="preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
        </div>
      </div>

      <button onClick={onSave}>Save draft</button>
      <button onClick={onPublish}>Publish saved draft</button>
      <button onClick={onUnpublish}>Unpublish</button>

      {error && <p className="error">{error}</p>}
      {current && (
        <div className="error">
          <p>
            Current draft (version {current.draftVersion}): <strong>{current.title}</strong>
          </p>
          <button onClick={onLoadCurrent}>Load the current draft</button>
        </div>
      )}
      {info && <p className="info">{info}</p>}
    </>
  );
}

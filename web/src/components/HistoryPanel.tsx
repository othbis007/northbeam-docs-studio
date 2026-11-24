import { useEffect, useState } from 'react';
import { api, ApiError, type Article, type Version } from '../api';
import { renderMarkdown } from '../markdown';

// Writer: version history, newest first (US4). Open a version, restore it into
// the draft (with a warning), or delete a version that is not the referenced one.

export function HistoryPanel({ article, onChange }: { article: Article; onChange: (a: Article) => void }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [opened, setOpened] = useState<Version | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.listVersions(article.id).then(setVersions, (e: ApiError) => setError(e.message));
  };

  // Reload when the article changes (publish, restore, unpublish).
  useEffect(load, [article.id, article.lastPublishedVersionNumber, article.draftVersion, article.status]);

  async function onRestore(v: Version) {
    const ok = window.confirm(
      `Restore version ${v.number}? Its content will replace the current draft. ` +
        'Nothing is published and no version is added or removed.',
    );
    if (!ok) return;
    setError(null);
    try {
      onChange(await api.restore(article.id, v.number, article.draftVersion));
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function onDelete(v: Version) {
    if (!window.confirm(`Delete version ${v.number}? This cannot be undone.`)) return;
    setError(null);
    try {
      await api.deleteVersion(article.id, v.number);
      if (opened?.number === v.number) setOpened(null);
      load();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <section>
      <h2>History</h2>
      {error && <p className="error">{error}</p>}
      {versions.length === 0 ? (
        <p className="muted">No published versions yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Title</th>
              <th>Published</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.number}>
                <td>
                  {v.number}
                  {v.number === article.lastPublishedVersionNumber && ' (referenced)'}
                </td>
                <td>{v.title}</td>
                <td>{new Date(v.createdAt).toLocaleString()}</td>
                <td>
                  <button onClick={() => setOpened(v)}>Open</button>
                  <button onClick={() => onRestore(v)}>Restore into draft</button>
                  <button onClick={() => onDelete(v)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {opened && (
        <div>
          <h3>
            Version {opened.number}: {opened.title}
          </h3>
          <p className="muted">Tags: {opened.tags.join(', ') || '—'}</p>
          <div className="preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(opened.body) }} />
        </div>
      )}
    </section>
  );
}

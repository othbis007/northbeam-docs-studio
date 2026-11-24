import { useEffect, useState } from 'react';
import { WriterList } from './pages/WriterList';
import { Editor } from './pages/Editor';

// Minimal hash routing (no router dependency):
//   #/              writer: article list
//   #/articles/:id  writer: editor
//   #/public        reader: published articles
//   #/public/:slug  reader: one article

function useHash(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function Page({ hash }: { hash: string }) {
  const path = hash.replace(/^#/, '') || '/';
  const editor = path.match(/^\/articles\/(\d+)$/);
  const article = path.match(/^\/public\/([a-z0-9-]+)$/);
  if (editor) {
    return <Editor key={editor[1]} id={Number(editor[1])} />;
  }
  if (path === '/public') {
    return <p className="muted">Published articles.</p>;
  }
  if (article) {
    return <p className="muted">Article {article[1]}.</p>;
  }
  return <WriterList />;
}

export function App() {
  const hash = useHash();
  return (
    <>
      <header>
        <strong>Northbeam Docs Studio</strong>
        <a href="#/">Writer</a>
        <a href="#/public">Public site</a>
      </header>
      <main>
        <Page hash={hash} />
      </main>
    </>
  );
}

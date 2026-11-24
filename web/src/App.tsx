import { useEffect, useState } from 'react';
import { WriterList } from './pages/WriterList';
import { Editor } from './pages/Editor';
import { PublicList } from './pages/PublicList';
import { PublicArticle } from './pages/PublicArticle';

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
    return <PublicList />;
  }
  if (article) {
    return <PublicArticle key={article[1]} slug={article[1]!} />;
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

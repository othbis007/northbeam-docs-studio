import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Markdown to safe HTML: marked renders, DOMPurify removes anything unsafe.
export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(marked.parse(source, { async: false }));
}

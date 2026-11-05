import { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { usePrefs } from '../context/PrefsContext.jsx';

marked.setOptions({ gfm: true, breaks: false });
let mermaidPromise = null;
let seq = 0;

/** Renders AI Markdown safely (sanitised) and turns ```mermaid blocks into diagrams. */
export default function Markdown({ text }) {
  const ref = useRef(null);
  const { prefs } = usePrefs();
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text || '')), [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
    const blocks = [...el.querySelectorAll('pre > code.language-mermaid')];
    if (!blocks.length) return;
    let cancelled = false;
    (async () => {
      mermaidPromise ||= import('mermaid').then((m) => m.default);
      const mermaid = await mermaidPromise;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: prefs.theme === 'dark' ? 'dark' : 'default', fontFamily: 'inherit' });
      for (const code of blocks) {
        const src = code.textContent;
        const holder = document.createElement('figure');
        holder.className = 'diagram';
        try {
          const { svg } = await mermaid.render(`mmd-${++seq}`, src);
          if (cancelled) return;
          holder.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['foreignObject'] });
        } catch {
          holder.className = 'diagram diagram-error';
          holder.innerHTML = '<figcaption>This diagram couldn’t be drawn. Its source is shown below.</figcaption>';
          const pre = document.createElement('pre'); pre.textContent = src; holder.appendChild(pre);
        }
        code.parentElement.replaceWith(holder);
      }
    })();
    return () => { cancelled = true; };
  }, [html, prefs.theme]);

  return <div ref={ref} className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}

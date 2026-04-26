import { HIGHLIGHT, THEME } from "./tiptapEditorConfig"

export function getTiptapEditorStyles() {
  return `
    .notion-editor-content {
      max-width: 760px;
      margin: 0 auto;
      outline: none;
      color: #1f2328;
      font-size: 16px;
      line-height: 1.72;
      min-height: 100%;
    }
    .notion-editor-content > * {
      position: relative;
      margin-left: 0;
      border-radius: 6px;
      padding: 2px 4px;
    }
    .notion-editor-content > *:hover {
      background: rgba(89, 101, 175, 0.045);
    }
    .notion-editor-content p { margin: 0.35em 0; }
    .notion-editor-content h1 {
      color: #b9b9bd;
      font-size: 2rem;
      font-weight: 800;
      line-height: 1.2;
      margin: 0.6em 0 0.5em;
    }
    .notion-editor-content h2 { font-size: 1.45rem; font-weight: 750; margin: 1em 0 0.45em; }
    .notion-editor-content h3 { font-size: 1.15rem; font-weight: 700; margin: 0.9em 0 0.35em; }
    .notion-editor-content blockquote {
      border-left: 3px solid ${THEME};
      padding: 0.5rem 0.75rem;
      color: #5f6368;
      background: #faf9ff;
      margin: 0.9rem 0;
    }
    .notion-editor-content ul,
    .notion-editor-content ol { padding-left: 1.5rem; margin: 0.5rem 0; }
    .notion-editor-content pre {
      background: #1e1e2e;
      color: #e0e0e0;
      padding: 1rem;
      border-radius: 10px;
      overflow-x: auto;
    }
    .notion-editor-content code { font-family: "Roboto Mono", ui-monospace, monospace; }
    .notion-editor-content mark {
      background: ${HIGHLIGHT};
      color: ${THEME};
      border-radius: 3px;
      padding: 1px 3px;
    }
    .notion-editor-content table {
      border-collapse: collapse;
      table-layout: fixed;
      width: 100%;
      margin: 1rem 0;
      overflow: hidden;
    }
    .notion-editor-content td,
    .notion-editor-content th {
      border: 1px solid #dedede;
      padding: 0.5rem;
      vertical-align: top;
      min-width: 90px;
    }
    .notion-editor-content th {
      background: #f5f3ff;
      color: ${THEME};
      font-weight: 700;
    }
    .notion-editor-content img {
      max-width: 100%;
      border-radius: 10px;
      display: block;
      margin: 1rem auto;
    }
    .notion-editor-content p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      color: #b8b8bd;
      float: left;
      height: 0;
      pointer-events: none;
    }
    .notion-block-handle {
      display: flex;
      align-items: center;
      gap: 3px;
      padding-right: 8px;
      transform: translateX(24px);
    }
    .notion-block-add,
    .notion-block-grip {
      width: 22px;
      height: 22px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #9aa0a6;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .notion-block-add:hover,
    .notion-block-grip:hover {
      background: #f1f3f4;
      color: #333;
    }
    .notion-block-grip {
      cursor: grab;
      font-size: 17px;
    }
    .notion-block-grip:active { cursor: grabbing; }
  `
}

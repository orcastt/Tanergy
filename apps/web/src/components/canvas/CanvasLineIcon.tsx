export type CanvasLineIconName =
  | 'align-bottom'
  | 'align-center-x'
  | 'align-center-y'
  | 'align-left'
  | 'align-right'
  | 'align-top'
  | 'arrow'
  | 'capture'
  | 'close'
  | 'cloud'
  | 'diamond'
  | 'draw'
  | 'ellipse'
  | 'eraser'
  | 'hand'
  | 'image-node'
  | 'insert'
  | 'line'
  | 'refresh'
  | 'rectangle'
  | 'restore'
  | 'select'
  | 'settings'
  | 'text'
  | 'trash'
  | 'triangle'

export function CanvasLineIcon({ name }: { name: CanvasLineIconName }) {
  return (
    <svg aria-hidden className="canvas-line-icon" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.85">
        {renderIcon(name)}
      </g>
    </svg>
  )
}

function renderIcon(name: CanvasLineIconName) {
  switch (name) {
    case 'hand':
      return <path d="M7.4 12.5V8.2a1.4 1.4 0 0 1 2.8 0v3.6M10.2 11V6.9a1.4 1.4 0 0 1 2.8 0v4.5M13 11V7.8a1.4 1.4 0 0 1 2.8 0v4.6M15.8 12v-1.7a1.35 1.35 0 0 1 2.7 0v3.3c0 4.5-2.4 6.9-6 6.9h-.8c-2.4 0-3.8-1.2-5.2-3.3l-1.2-1.8a1.4 1.4 0 0 1 2.2-1.7l1 1.1" />
    case 'select':
      return <path d="M5.5 4.4 17.9 11l-5.1 1.4 3.2 5.6-2.7 1.5-3.2-5.6-3.6 3.8z" />
    case 'rectangle':
      return <rect height="10" rx="1.4" width="14" x="5" y="7" />
    case 'diamond':
      return <path d="m12 4.5 7.5 7.5-7.5 7.5L4.5 12z" />
    case 'ellipse':
      return <circle cx="12" cy="12" r="6.8" />
    case 'triangle':
      return <path d="M12 5.2 19.5 18H4.5z" />
    case 'cloud':
      return <path d="M7.3 17.2h9.2a3.4 3.4 0 0 0 .6-6.7 5 5 0 0 0-9.6-1.4A4.1 4.1 0 0 0 7.3 17.2z" />
    case 'arrow':
      return <path d="M5 12h13.5M13.5 7l5 5-5 5" />
    case 'line':
      return <path d="M6 18 18 6" />
    case 'draw':
      return <path d="m5.5 17.5 3.2-.8 8.6-8.6a1.9 1.9 0 0 0-2.7-2.7L6 14zM13.8 6.2l3 3" />
    case 'text':
      return <path d="M6.5 6.5h11M12 6.5v11M9 17.5h6" />
    case 'eraser':
      return <path d="m5.8 14.4 7.8-7.8a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8l-6.3 6.3H7.9zM9.3 10.9l4.2 4.2M5.5 19h13" />
    case 'insert':
      return <path d="M12 5v14M5 12h14" />
    case 'settings':
      return <><circle cx="12" cy="12" r="3" /><path d="M12 3.9v2.2M12 17.9v2.2M4.9 7.1l1.6 1.2M17.5 15.7l1.6 1.2M3.8 12h2.2M18 12h2.2M4.9 16.9l1.6-1.2M17.5 8.3l1.6-1.2" /></>
    case 'image-node':
      return <><rect height="12" rx="1.6" width="14" x="4.5" y="5" /><path d="m7.5 14 3.1-3.2 2.3 2.4 1.4-1.5 2.2 2.3M8 19h9.5a2 2 0 0 0 2-2V8" /></>
    case 'capture':
      return <><path d="M6.5 8.2h2.1l1.1-1.7h4.6l1.1 1.7h2.1a2 2 0 0 1 2 2v6.1a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-6.1a2 2 0 0 1 2-2z" /><circle cx="12" cy="13.2" r="3" /></>
    case 'close':
      return <><path d="M7 7 17 17" /><path d="M17 7 7 17" /></>
    case 'refresh':
      return <><path d="M19 6.5v4.2h-4.2" /><path d="M5 17.5v-4.2h4.2" /><path d="M18 10.2a6.5 6.5 0 0 0-10.9-2.6L5.7 9" /><path d="M6 13.8a6.5 6.5 0 0 0 10.9 2.6l1.4-1.4" /></>
    case 'restore':
      return <><path d="M8 7H5v3" /><path d="M5.4 9.6A7 7 0 1 1 10 18.7" /><path d="M12 9v4l2.8 1.6" /></>
    case 'align-left':
      return <><path d="M5 5v14M9 7h9M9 12h6M9 17h10" /></>
    case 'align-center-x':
      return <><path d="M12 5v14M7 7h10M9 12h6M6 17h12" /></>
    case 'align-right':
      return <><path d="M19 5v14M6 7h9M9 12h6M5 17h10" /></>
    case 'align-top':
      return <><path d="M5 5h14M7 9v9M12 9v6M17 9v10" /></>
    case 'align-center-y':
      return <><path d="M5 12h14M7 7v10M12 9v6M17 6v12" /></>
    case 'align-bottom':
      return <><path d="M5 19h14M7 6v9M12 9v6M17 5v10" /></>
    case 'trash':
      return <><path d="M4.8 7.2h14.4" /><path d="M9.5 4.8h5" /><path d="m8 7.2.7 11a1.4 1.4 0 0 0 1.4 1.3h3.8a1.4 1.4 0 0 0 1.4-1.3l.7-11" /><path d="M10 10.2v5.6M14 10.2v5.6" /></>
  }
}

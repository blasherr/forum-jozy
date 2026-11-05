const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  layout: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 9h18M9 21V9',
  scale: 'M12 3v18M7 21h10M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0zM19 7l-3 7a3.5 3.5 0 0 0 6 0z',
  book: 'M4 5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 1h14v-3',
  news: 'M4 5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2zM17 9h3v10a2 2 0 0 1-2 2M8 9h5M8 13h5M8 17h3',
  scroll: 'M8 21h11a2 2 0 0 0 2-2v-1H10v1a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h12a2 2 0 0 1 2 2v13M10 8h5M10 12h5',
  chat: 'M21 12a8 8 0 0 1-11.8 7L4 20l1-5A8 8 0 1 1 21 12z',
  file: 'M6 3h8l5 5v13H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5',
  type: 'M5 7V5h14v2M12 5v14M9 19h6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  palette:
    'M12 3a9 9 0 1 0 0 18c1 0 1.7-.7 1.7-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.6 1.7-1.6H16a5 5 0 0 0 5-5c0-4.2-4-7.4-9-7.4zM7.5 11.5h.01M9.5 7.5h.01M14.5 7.5h.01',
  image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 16l5-5 4 4 3-3 6 6M15 8.5h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.3a4 4 0 0 1 0 7.4M22 21a7 7 0 0 0-4-6.3',
  list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  'list-ol': 'M10 6h11M10 12h11M10 18h11M4 5l1-1v5M4 15.5a1.2 1.2 0 1 1 2 1L4 19h2.5',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  upload: 'M12 16V4M7 9l5-5 5 5M4 21h16',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  logout: 'M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  'shield-check': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  alert: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  eraser: 'M8 20h12M4.5 14.5l9-9a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L11 20H8l-3.5-3.5a1.4 1.4 0 0 1 0-2z',
  outdent: 'M21 5H3M21 12h-9M21 19H3M8 9l-3 3 3 3',
  indent: 'M21 5H3M21 12h-9M21 19H3M4 9l3 3-3 3',
  quote: 'M9 7H5v6h4V9M9 13c0 2-1 3-3 4M19 7h-4v6h4V9M19 13c0 2-1 3-3 4',
  'align-left': 'M4 6h16M4 12h10M4 18h13',
  'align-center': 'M4 6h16M7 12h10M5 18h14',
  'align-right': 'M4 6h16M10 12h10M7 18h13',
  'align-justify': 'M4 6h16M4 12h16M4 18h16',
  link: 'M10 14a4 4 0 0 0 6 .4l3-3a4 4 0 0 0-5.7-5.7l-1.6 1.6M14 10a4 4 0 0 0-6-.4l-3 3a4 4 0 0 0 5.7 5.7l1.6-1.6',
  table: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 9h18M3 15h18M9 3v18',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  minus: 'M5 12h14',
  return: 'M20 5v6a3 3 0 0 1-3 3H5M9 10l-4 4 4 4',
  note: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 9h8M8 13h5',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

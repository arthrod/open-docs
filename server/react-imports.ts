// The one React every editor page shares. In a module of its own so a shell can name it without
// loading the router (shells are also imported by the viewer site and by tests).
/** React, resolved once, for every adapter that loads a React package with `?external=react,react-dom`. */
export const REACT_IMPORTS: Record<string, string> = {
  "react": "https://esm.sh/react@18.2.0",
  "react/": "https://esm.sh/react@18.2.0/",
  "react-dom": "https://esm.sh/react-dom@18.2.0",
  "react-dom/": "https://esm.sh/react-dom@18.2.0/",
};

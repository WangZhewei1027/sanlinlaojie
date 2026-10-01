// Storybook stand-in for `geist/font/sans`. The real module calls
// `next/font/local`, which Storybook's Vite build cannot bundle from inside
// node_modules (MISSING_EXPORT "default"). Stories only need the CSS variable
// hook; the browser falls back to the system sans stack.
export const GeistSans = {
  variable: "font-geist-sans-storybook",
  className: "font-geist-sans-storybook",
  style: { fontFamily: "ui-sans-serif, system-ui, sans-serif" },
};

import type { Preview } from "@storybook/nextjs-vite";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "../components/i18n-provider";
import { Toaster } from "../components/ui/sonner";
import { geistSans } from "../lib/fonts";
import type { Language } from "../lib/i18n/settings";
import "../app/globals.css";

const preview: Preview = {
  initialGlobals: {
    language: "zh",
    theme: "light",
  },
  globalTypes: {
    language: {
      description: "Documentation language",
      toolbar: {
        icon: "globe",
        items: [
          { value: "zh", title: "中文" },
          { value: "en", title: "English" },
        ],
      },
    },
    theme: {
      description: "Theme token set",
      toolbar: {
        icon: "paintbrush",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => (
      <ThemeProvider
        attribute="class"
        forcedTheme={context.globals.theme ?? "light"}
        enableSystem={false}
        disableTransitionOnChange
      >
        <I18nProvider lang={(context.globals.language ?? "zh") as Language}>
          <div
            className={`${geistSans.variable} bg-background p-6 font-sans text-foreground`}
          >
            <Story />
            <Toaster />
          </div>
        </I18nProvider>
      </ThemeProvider>
    ),
  ],
  parameters: {
    options: {
      storySort: {
        order: [
          "Design System",
          ["Introduction", "Foundations", "Components"],
        ],
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      options: {
        light: { name: "Light", value: "hsl(0 0% 100%)" },
        dark: { name: "Dark", value: "hsl(0 0% 3.9%)" },
      },
    },
  },
  tags: ["autodocs"],
};

export default preview;

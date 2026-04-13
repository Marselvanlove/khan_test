import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "GBC Analytics Dashboard",
  description: "Мини-дашборд заказов RetailCRM -> Supabase -> Vercel",
};

const EXTENSION_ATTR_SCRUBBER = `
(() => {
  const shouldRemoveAttr = (name) =>
    name === 'bis_skin_checked' ||
    name === 'bis_register' ||
    name.startsWith('__processed_') ||
    name === 'data-new-gr-c-s-check-loaded' ||
    name === 'data-gr-ext-installed';

  const cleanNode = (node) => {
    if (!(node instanceof Element)) return;
    for (const attr of Array.from(node.attributes)) {
      if (shouldRemoveAttr(attr.name)) {
        node.removeAttribute(attr.name);
      }
    }
  };

  const cleanTree = (root) => {
    cleanNode(root);
    if (!(root instanceof Element)) return;
    for (const element of root.querySelectorAll('*')) {
      cleanNode(element);
    }
  };

  cleanTree(document.documentElement);

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        cleanNode(mutation.target);
        continue;
      }

      for (const node of mutation.addedNodes) {
        cleanTree(node);
      }
    }
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
  });
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={cn("font-sans", manrope.variable)}>
      <head>
        <Script
          id="extension-attr-scrubber"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: EXTENSION_ATTR_SCRUBBER }}
        />
      </head>
      <body
        className={cn(
          manrope.variable,
          plexMono.variable,
          "min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/15",
        )}
        suppressHydrationWarning
      >
        <TooltipProvider delayDuration={120}>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}

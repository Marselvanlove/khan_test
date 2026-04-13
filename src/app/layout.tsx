import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "GBC Analytics Dashboard",
  description: "Мини-дашборд заказов RetailCRM -> Supabase -> Vercel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={cn("font-sans", inter.variable)}>
      <body
        className={`${inter.variable} ${plexMono.variable}`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}

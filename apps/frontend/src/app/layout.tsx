import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./workspace-v2.css";
import "@fontsource-variable/bodoni-moda/index.css";
import "@fontsource-variable/manrope/index.css";
import "./editorial-workspace.css";
import { SessionProvider } from "../components/session";

export const metadata: Metadata = {
  title: "ELMS | IMS Learning Resources",
  description: "Internal educational material logistics",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f0eb" },
    { media: "(prefers-color-scheme: dark)", color: "#171d18" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("elms-theme")||"system";var d=t==="system"?window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light":t;document.documentElement.dataset.theme=d;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

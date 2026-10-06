import type { Metadata } from "next";
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
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

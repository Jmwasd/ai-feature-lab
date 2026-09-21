import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-plex-mono" });
const plexKr = IBM_Plex_Sans_KR({ weight: ["400", "600", "700"], variable: "--font-plex-kr", preload: false });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" className={`${plexSans.variable} ${plexMono.variable} ${plexKr.variable}`}>
      <body>{children}</body>
    </html>
  );
}

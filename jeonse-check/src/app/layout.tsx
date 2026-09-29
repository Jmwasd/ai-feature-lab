import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "jeonse-check",
  description: "주소와 보증금으로 전세 위험 신호를 확인한다",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

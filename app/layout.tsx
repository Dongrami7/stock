import type { Metadata } from "next";
import "./observatory.css";
import "./integration.css";
import "./research.css";
import "./butler.css";

export const metadata: Metadata = {
  title: "PER Observatory · 저평가 추적",
  description: "실적과 가격을 함께 읽는 국내 주식 컨센서스 관측소",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}

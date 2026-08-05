import type { Metadata } from "next";

import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "디럭스 솔랭",
    template: "%s | 디럭스 솔랭",
  },
  description: "소규모 솔로 랭크 대회를 위한 기록·정산 운영 플랫폼",
  applicationName: "디럭스 솔랭",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    title: "디럭스 솔랭 · DELUXE SOLO QUEUE",
    description: "점수 · 순위 · 미션 · 경기 기록",
    images: [
      {
        url: "/og.png",
        width: 1792,
        height: 923,
        alt: "디럭스 솔랭 스포츠 기록 보드",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "디럭스 솔랭 · DELUXE SOLO QUEUE",
    description: "점수 · 순위 · 미션 · 경기 기록",
    images: ["/og.png"],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "宝可梦学习乐园",
  description: "学习习惯养成游戏 - 完成任务，和宝可梦一起成长！",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Noto+Sans+SC:wght@400;500;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-gray-50 min-h-screen">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

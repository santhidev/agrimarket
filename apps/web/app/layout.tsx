import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoThai = Noto_Sans_Thai({
  subsets: ["thai"],
  variable: "--font-noto-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgriMarket — ตลาดเกษตรซื้อขายตรง",
  description: "ประกาศรับซื้อ เกษตรกรเสนอราคา ซื้อขายกันตรง ไม่ต้องผ่านคนกลาง",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoThai.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}

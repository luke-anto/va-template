import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "VA Dashboard",
  description: "Internal operations dashboard for the productized VA + Accounting + BI service."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`min-h-dvh bg-[#0a0a0a] text-[#f0f0f0] font-[family-name:var(--font-inter)] antialiased`}>
        {children}
      </body>
    </html>
  );
}


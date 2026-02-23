import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "VA Dashboard",
  description: "Internal operations dashboard for the productized VA + Accounting + BI service."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-zinc-50 text-zinc-950">{children}</body>
    </html>
  );
}


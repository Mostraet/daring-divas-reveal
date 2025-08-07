import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daring Divas Reveal",
  description: "Reveal your Daring Divas NFTs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


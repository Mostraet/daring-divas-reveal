import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "./WagmiProvider"; // <-- Import our new provider

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
      <body>
        {/* Wrap the children with our new provider */}
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}

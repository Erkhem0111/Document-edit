import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vault OS",
  description: "Document management workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" className="h-full font-sans antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

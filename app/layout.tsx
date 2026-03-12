import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conceito Barbearia",
  description: "Agenda e operacao da Conceito Barbearia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        style={{ background: "#000" }}
        className="antialiased bg-black font-sans"
      >
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PULSEFLEET | AMR Fleet Manager",
  description: "Simulador interactivo para gestión de flotas AMR, misiones, tráfico, mapas e incidentes.",
  other: {
    "codex-preview": "development",
  },
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
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}

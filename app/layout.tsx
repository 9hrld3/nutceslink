import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Big_Shoulders } from "next/font/google";
import "./globals.css";

const display = Big_Shoulders({ variable: "--font-big-shoulders", subsets: ["latin"], weight: ["800", "900"] });
const barlow = Barlow({ variable: "--font-barlow", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const condensed = Barlow_Condensed({ variable: "--font-barlow-condensed", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "NutcesLink",
  description: "Gestión del consultorio nutricional",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${barlow.variable} ${condensed.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

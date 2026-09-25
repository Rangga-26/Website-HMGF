import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import GeoBot from "@/components/GeoBot";

export const metadata: Metadata = {
  title: "HMGF UGM",
  description: "Himpunan Mahasiswa Geofisika Universitas Gadjah Mada",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body><header className="site-header"><Link href="/" className="brand">HMGF <span>UGM</span></Link><nav><Link href="/">Beranda</Link><Link href="/#arsip">Arsip</Link></nav></header>{children}<GeoBot /></body>
    </html>
  );
}

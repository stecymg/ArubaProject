"use client";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav style={{
      padding: "12px 24px",
      backgroundColor: "#f3f3f3",
      borderBottom: "1px solid #ddd",
      marginBottom: "24px"
    }}>
      <Link href="/" style={{ marginRight: 16 }}>
        🏠 Accueil
      </Link>
      <Link href="/dashboard">
        📊 Tableau de bord
      </Link>
    </nav>
  );
}

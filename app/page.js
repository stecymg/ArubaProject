"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Navbar from "./components/Navbar";   // 👈 import Navbar

function fmt(dt) {
  return new Date(dt).toLocaleDateString();
}

export default function Home() {
  const [resas, setResas] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*")
        .order("start_at", { ascending: true });
      if (!error) setResas(data || []);
    };
    fetchData();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <Navbar />   {/* 👈 menu de navigation */}
      <h1>Bienvenue sur Aruba Project ✨</h1>

      {resas.length === 0 ? (
        <p>Aucune réservation.</p>
      ) : (
        <ul>
          {resas.map((r) => (
            <li key={r.id}>
              <strong>{r.guest_name}</strong> 🏡 <br />
              Du {fmt(r.start_at)} au {fmt(r.end_at)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabaseClient";
import Navbar from "../components/Navbar";

function fmt(dt) { return new Date(dt).toLocaleString(); }
const nowISO = () => new Date().toISOString();

function StatusBadge({ status }) {
  const isDone = status === "done";
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 999,
      fontSize: 12, fontWeight: 600,
      background: isDone ? "#e6f7ed" : "#ffecec",
      color: isDone ? "#147d3f" : "#b11a1a",
      border: `1px solid ${isDone ? "#a8e0c1" : "#f5a5a5"}`, marginLeft: 8
    }}>
      {status}
    </span>
  );
}

export default function Dashboard() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [auto, setAuto] = useState(true); // auto-refresh on/off

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("properties")
      .select(`
        id, name,
        reservations (
          id, guest_name, start_at, end_at,
          cleaning_tasks ( id, window_start, window_end, status )
        )
      `);
    if (!error) {
      const sorted = (data || [])
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        .map((p) => ({
          ...p,
          reservations: (p.reservations || [])
            .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
            .map((r) => ({
              ...r,
              cleaning_tasks: (r.cleaning_tasks || [])
                .sort((a, b) => new Date(a.window_start) - new Date(b.window_start)),
            })),
        }));
      setProperties(sorted);
    } else {
      console.error("Erreur chargement:", error);
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

// Realtime (une seule fois, pas à chaque render)
useEffect(() => {
  const channel = supabase
    .channel("rt-cleaning")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cleaning_tasks" },
      (payload) => {
        console.log("✅ Realtime event:", payload.eventType, payload.new || payload.old);
        loadData();
      }
    )
    .subscribe((status) => {
      console.log("📡 Realtime status:", status); // doit rester "SUBSCRIBED"
    });

  return () => {
    // bien nettoyer à l’unmount
    supabase.removeChannel(channel);
  };
}, []); // 👈 important : tableau vide = une seule souscription

  // Auto-refresh toutes les 60s
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(loadData, 60_000);
    return () => clearInterval(t);
  }, [auto]);

  // Compteurs & vues dérivées
  const { pendingCount, doneCount, tasksFlat } = useMemo(() => {
    const tasks = [];
    for (const p of properties) for (const r of p.reservations || [])
      for (const t of r.cleaning_tasks || [])
        tasks.push({ ...t, propertyName: p.name, guestName: r.guest_name });
    const pending = tasks.filter(t => t.status === "pending").length;
    const done = tasks.filter(t => t.status === "done").length;
    return { pendingCount: pending, doneCount: done, tasksFlat: tasks };
  }, [properties]);

  const now = new Date();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

  const tasksNow = tasksFlat.filter(t =>
    new Date(t.window_start) <= now && new Date(t.window_end) >= now
  ).sort((a,b) => new Date(a.window_start) - new Date(b.window_start));

  const tasksToday = tasksFlat.filter(t => {
    const ws = new Date(t.window_start);
    return ws >= todayStart && ws <= todayEnd;
  }).sort((a,b) => new Date(a.window_start) - new Date(b.window_start));

  async function markDone(taskId) {
    try {
      setUpdatingId(taskId);
      const { error } = await supabase
        .from("cleaning_tasks")
        .update({ status: "done" })
        .eq("id", taskId);
      if (error) {
        console.error("Erreur update:", error);
        alert("Mise à jour refusée : " + error.message);
        return;
      }
      await loadData();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Navbar />
      <h1>📊 Tableau de bord Aruba Project</h1>

      <div style={{
        display: "flex", gap: 12, alignItems: "center",
        margin: "8px 0 16px"
      }}>
        <button onClick={loadData} style={{ padding: "6px 10px" }}>🔄 Rafraîchir</button>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />
          Auto-refresh (60s)
        </label>
        <span style={{ marginLeft: "auto" }}>
          Pending: <strong style={{ color: "#b11a1a" }}>{pendingCount}</strong> ·
          Done: <strong style={{ color: "#147d3f", marginLeft: 6 }}>{doneCount}</strong>
        </span>
      </div>

      {/* A FAIRE MAINTENANT */}
      <section style={{ marginBottom: 20 }}>
        <h2>🟢 À faire maintenant</h2>
        {tasksNow.length === 0 ? <p>Aucune tâche en cours de fenêtre.</p> : (
          <ul>
            {tasksNow.map(t => (
              <li key={t.id} style={{ marginBottom: 8 }}>
                <strong>{t.propertyName}</strong> — {t.guestName || "Invité"}<br/>
                Fenêtre : {fmt(t.window_start)} → {fmt(t.window_end)}
                <StatusBadge status={t.status} />
                {t.status === "pending" && (
                  <button
                    onClick={() => markDone(t.id)}
                    disabled={updatingId === t.id}
                    style={{
                      marginLeft: 10, padding: "4px 10px",
                      background: "#147d3f", color: "white",
                      border: "none", borderRadius: 6, cursor: "pointer",
                      opacity: updatingId === t.id ? 0.6 : 1
                    }}
                  >
                    {updatingId === t.id ? "…" : "✅"} Terminer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* AUJOURD’HUI */}
      <section style={{ marginBottom: 20 }}>
        <h2>📅 Tâches d’aujourd’hui</h2>
        {tasksToday.length === 0 ? <p>Rien aujourd’hui.</p> : (
          <ul>
            {tasksToday.map(t => (
              <li key={t.id} style={{ marginBottom: 6 }}>
                <strong>{t.propertyName}</strong> — {t.guestName || "Invité"}<br/>
                Fenêtre : {fmt(t.window_start)} → {fmt(t.window_end)}
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* TOUTES PAR PROPRIÉTÉ */}
      <section>
        <h2>🏡 Par propriété</h2>
        {loading ? <p>Chargement…</p> : properties.length === 0 ? (
          <p>Aucune propriété trouvée.</p>
        ) : (
          properties.map((p) => (
            <div key={p.id} style={{
              marginBottom: 24, padding: 16, border: "1px solid #eee", borderRadius: 12
            }}>
              <h3>{p.name}</h3>
              {p.reservations.length === 0 ? (
                <p>Aucune réservation.</p>
              ) : (
                <ul style={{ marginTop: 8 }}>
                  {p.reservations.map((r) => (
                    <li key={r.id} style={{ marginBottom: 12 }}>
                      <strong>{r.guest_name || "Invité"}</strong><br/>
                      Séjour : {fmt(r.start_at)} → {fmt(r.end_at)}
                      {(r.cleaning_tasks || []).length === 0 ? (
                        <div style={{ color: "#777" }}>Aucune tâche</div>
                      ) : (
                        <ul style={{ marginTop: 6 }}>
                          {r.cleaning_tasks.map((t) => {
                            const pending = t.status === "pending";
                            return (
                              <li key={t.id} style={{ marginBottom: 6 }}>
                                🧹 {fmt(t.window_start)} → {fmt(t.window_end)}
                                <StatusBadge status={t.status} />
                                {pending && (
                                  <button
                                    onClick={() => markDone(t.id)}
                                    disabled={updatingId === t.id}
                                    style={{
                                      marginLeft: 10, padding: "4px 10px",
                                      background: "#147d3f", color: "white",
                                      border: "none", borderRadius: 6, cursor: "pointer",
                                      opacity: updatingId === t.id ? 0.6 : 1
                                    }}
                                  >
                                    {updatingId === t.id ? "…" : "✅"} Terminer
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

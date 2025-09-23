// app/api/sync/route.js
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const SYNC_SECRET = process.env.SYNC_SECRET; // 👈 doit exister en prod si tu veux sécuriser

// Utils
const toDate = (v) => (v instanceof Date ? v : new Date(v));
const addHours = (d, h) => new Date(toDate(d).getTime() + h * 3600 * 1000);

export async function GET(req) {
  // 🔐 Vérif du secret (obligatoire si défini)
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  if (SYNC_SECRET && secret !== SYNC_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // 1) Propriétés
    const { data: props, error: pErr } = await supabaseAdmin
      .from("properties")
      .select("id, name");
    if (pErr) throw pErr;

    let created = 0;
    let touchedReservations = 0;

    for (const prop of props || []) {
      // 2) Réservations triées
      const { data: resas, error: rErr } = await supabaseAdmin
        .from("reservations")
        .select("id, start_at, end_at, property_id, guest_name")
        .eq("property_id", prop.id)
        .order("start_at", { ascending: true });
      if (rErr) throw rErr;

      // 3) Fenêtres ménage & upsert tâches
      for (let i = 0; i < (resas?.length || 0); i++) {
        const resa = resas[i];
        const nextResa = resas[i + 1] || null;

        const windowStart = toDate(resa.end_at);
        const bufferMs = 60 * 60 * 1000; // 1h avant check-in suivant
        const windowEnd = nextResa
          ? new Date(toDate(nextResa.start_at).getTime() - bufferMs)
          : addHours(windowStart, 3); // défaut: 3h après sortie

        const safeEnd =
          windowEnd.getTime() > windowStart.getTime()
            ? windowEnd
            : addHours(windowStart, 1);

        const { error: tErr } = await supabaseAdmin
          .from("cleaning_tasks")
          .upsert(
            {
              property_id: prop.id,
              reservation_id: resa.id,
              window_start: windowStart.toISOString(),
              window_end: safeEnd.toISOString(),
              status: "pending",
              notes: "Auto (local sync)",
            },
            { onConflict: "reservation_id" } // nécessite l'index unique
          );
        if (tErr && tErr.code !== "23505") throw tErr;

        created += 1;
        touchedReservations += 1;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, touchedReservations, upserts: created }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sync error", e);
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

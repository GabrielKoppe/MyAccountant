// Guarda de segurança: recusa rodar um seed destrutivo contra banco remoto/prod.
// Um seed apaga TODOS os dados — só pode rodar contra dev/e2e local.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "postgres", "postgres-e2e"]);
const REMOTE_MARKERS = /(neon\.tech|supabase|amazonaws|rds\.|render\.com|railway|azure|\.cloud)/i;

export function assertSafeSeedTarget(opts?: { requireDbSuffix?: string; label?: string }) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("[seed-guard] Recusado: NODE_ENV=production. Um seed apaga todos os dados.");
  }
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("[seed-guard] DATABASE_URL não definido.");
  let host = "",
    db = "";
  try {
    const u = new URL(raw);
    host = u.hostname;
    db = u.pathname.replace(/^\//, "");
  } catch {
    throw new Error("[seed-guard] DATABASE_URL inválido.");
  }
  if (REMOTE_MARKERS.test(raw) || !LOCAL_HOSTS.has(host)) {
    throw new Error(
      `[seed-guard] Recusado: host '${host}' não é local. Um seed apaga TODOS os dados — nunca rode contra banco remoto/prod.`
    );
  }
  if (opts?.requireDbSuffix && !db.endsWith(opts.requireDbSuffix)) {
    throw new Error(
      `[seed-guard] Recusado: banco '${db}' não termina com '${opts.requireDbSuffix}'. Esperado o banco de ${opts.label ?? "teste"}.`
    );
  }
}

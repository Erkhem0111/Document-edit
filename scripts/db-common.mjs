// ─── Өгөгдлийн сангийн нөөц (Docker дээрх PostgreSQL) — нийтлэг тохиргоо ─────
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// .env-ээс POSTGRES_USER / POSTGRES_DB / DB_CONTAINER-ийг уншина (байхгүй бол анхдагч)
function readEnvFile() {
  const path = join(process.cwd(), ".env");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...readEnvFile(), ...process.env };

export const config = {
  container: env.DB_CONTAINER || "company_db",
  user: env.POSTGRES_USER || "admin",
  database: env.POSTGRES_DB || "company_system",
  dir: join(process.cwd(), "backups"),
  keep: Number(env.DB_BACKUP_KEEP || 20),
};

export function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
}

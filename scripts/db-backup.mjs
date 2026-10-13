// ─── npm run db:backup ────────────────────────────────────────────────────────
// Docker дээрх өгөгдлийн сангийн бүтэн нөөцийг backups/ хавтсанд хадгална.
// (PowerShell-ийн ">" нь файлыг UTF-16 болгож кирилл үсгийг эвдэх тул
// pg_dump-ийн гаралтыг Node-оор шууд файл руу бичнэ.)
import { spawn } from "node:child_process";
import { closeSync, createWriteStream, mkdirSync, openSync, readSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { config, stamp } from "./db-common.mjs";

// Том файлыг бүтнээр нь уншихгүй — pg_dump амжилттай дууссан тэмдэг төгсгөлд байдаг
function tail(file, bytes = 4096) {
  const size = statSync(file).size;
  const fd = openSync(file, "r");
  const buf = Buffer.alloc(Math.min(bytes, size));
  readSync(fd, buf, 0, buf.length, Math.max(0, size - buf.length));
  closeSync(fd);
  return buf.toString("utf8");
}

export function backup(label = "") {
  mkdirSync(config.dir, { recursive: true });
  const file = join(config.dir, `${config.database}_${stamp()}${label ? `_${label}` : ""}.sql`);
  return new Promise((resolve, reject) => {
    const out = createWriteStream(file);
    const child = spawn("docker", [
      "exec",
      config.container,
      "pg_dump",
      "-U",
      config.user,
      "-d",
      config.database,
      "--clean",
      "--if-exists",
      "--no-owner",
    ]);
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.stdout.pipe(out);
    child.on("error", (err) => {
      rmSync(file, { force: true });
      reject(new Error(`docker ажиллуулж чадсангүй (${err.message}). Docker Desktop асаалттай эсэхийг шалгана уу.`));
    });
    child.on("close", (code) => {
      out.end(() => {
        const ok = code === 0 && tail(file).includes("PostgreSQL database dump complete");
        if (!ok) {
          rmSync(file, { force: true });
          reject(new Error(`Нөөц хийж чадсангүй (код ${code}).\n${stderr.trim()}`));
          return;
        }
        resolve(file);
      });
    });
  });
}

// Хуучин нөөцүүдээс сүүлийн N-ийг үлдээнэ
function prune() {
  const files = readdirSync(config.dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({ f, t: statSync(join(config.dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(config.keep)) rmSync(join(config.dir, f));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const file = await backup();
    prune();
    const kb = Math.round(statSync(file).size / 1024);
    console.log(`✔ Нөөц хадгалагдлаа: ${file} (${kb} KB)`);
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(1);
  }
}

// ─── npm run db:restore -- backups/<файл>.sql --yes ──────────────────────────
// Нөөцөөс өгөгдлийн санг сэргээнэ. ОДООГИЙН ӨГӨГДӨЛ НӨӨЦИЙН АГУУЛГААР
// СОЛИГДОНО — тиймээс эхлээд одоогийн байдлыг автоматаар нөөцөлнө.
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { backup } from "./db-backup.mjs";
import { config } from "./db-common.mjs";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file || !existsSync(file)) {
  console.error("Хэрэглээ: npm run db:restore -- backups/<файл>.sql --yes");
  process.exit(1);
}
if (!args.includes("--yes")) {
  console.error(
    `⚠ "${config.database}" өгөгдлийн сангийн одоогийн агуулга "${file}"-ээр солигдоно.\n` +
      "  Итгэлтэй бол төгсгөлд нь --yes нэмж дахин ажиллуулна уу.",
  );
  process.exit(1);
}

try {
  const safety = await backup("before-restore");
  console.log(`✔ Сэргээхээс өмнөх нөөц: ${safety}`);
} catch (err) {
  // Шинэ, хоосон сан бол нөөцлөх зүйлгүй байж болно — үргэлжлүүлнэ
  console.warn(`… Урьдчилсан нөөц хийгдсэнгүй: ${err.message.split("\n")[0]}`);
}

const child = spawn(
  "docker",
  ["exec", "-i", config.container, "psql", "-U", config.user, "-d", config.database, "-v", "ON_ERROR_STOP=1", "-q"],
  { stdio: ["pipe", "inherit", "inherit"] },
);
createReadStream(file).pipe(child.stdin);
child.on("error", (err) => {
  console.error(`✖ docker ажиллуулж чадсангүй: ${err.message}`);
  process.exit(1);
});
child.on("close", (code) => {
  if (code === 0) console.log(`✔ Сэргээгдлээ: ${file}`);
  else console.error(`✖ Сэргээх үед алдаа гарлаа (код ${code}). Дээрх мессежийг харна уу.`);
  process.exit(code ?? 1);
});

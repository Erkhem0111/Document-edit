// lib/otp.ts — Production-ready (Upstash Redis + fallback Map)
import { Redis } from "@upstash/redis";

const OTP_TTL_SECONDS = 300; // 5 минут хүчинтэй
const MAX_ATTEMPTS = 3; // 3 удаа буруу оруулбал блок
const SEND_COOLDOWN_SECONDS = 60; // 1 минутад нэг л код авна

const redis = process.env.UPSTASH_REDIS_REST_URL ? Redis.fromEnv() : null;

async function getRedis() {
  return redis;
}

// Dev fallback (Redis байхгүй үед)
const memStore = new Map<
  string,
  { code: string; expiresAt: number; attempts: number }
>();

export function generateOTP(): string {
  // Math.random() биш — crypto ашиглах нь аюулгүй
  return String(
    (crypto.getRandomValues(new Uint32Array(1))[0] % 900000) + 100000,
  );
}

export async function canSendOTP(phone: string): Promise<boolean> {
  const redis = await getRedis();
  if (redis) {
    return (await redis.exists(`otp:cooldown:${phone}`)) === 0;
  }
  const rec = memStore.get(phone);
  return !rec || Date.now() > rec.expiresAt;
}

export async function saveOTP(phone: string, code: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    const tx = redis.multi();
    tx.setex(
      `otp:${phone}`,
      OTP_TTL_SECONDS,
      JSON.stringify({ code, attempts: 0 }),
    );
    tx.setex(`otp:cooldown:${phone}`, SEND_COOLDOWN_SECONDS, "1");
    await tx.exec();
  } else {
    memStore.set(phone, {
      code,
      expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
      attempts: 0,
    });
  }
}

export type VerifyResult =
  | { success: true }
  | {
      success: false;
      error: "expired" | "invalid" | "too_many_attempts" | "not_found";
    };

export async function verifyOTP(
  phone: string,
  inputCode: string,
): Promise<VerifyResult> {
  const redis = await getRedis();

  if (redis) {
    const raw = await redis.get<string>(`otp:${phone}`);
    if (!raw) return { success: false, error: "not_found" };

    const rec = JSON.parse(raw) as { code: string; attempts: number };

    if (rec.attempts >= MAX_ATTEMPTS) {
      await redis.del(`otp:${phone}`);
      return { success: false, error: "too_many_attempts" };
    }
    if (rec.code !== inputCode) {
      const ttl = await redis.ttl(`otp:${phone}`);
      rec.attempts += 1;
      await redis.setex(`otp:${phone}`, Math.max(ttl, 10), JSON.stringify(rec));
      return { success: false, error: "invalid" };
    }
    await redis.del(`otp:${phone}`);
    return { success: true };
  }

  // In-memory fallback
  const rec = memStore.get(phone);
  if (!rec) return { success: false, error: "not_found" };
  if (Date.now() > rec.expiresAt) {
    memStore.delete(phone);
    return { success: false, error: "expired" };
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    memStore.delete(phone);
    return { success: false, error: "too_many_attempts" };
  }
  if (rec.code !== inputCode) {
    rec.attempts += 1;
    return { success: false, error: "invalid" };
  }
  memStore.delete(phone);
  return { success: true };
}

export function validateMongolianPhone(phone: string): string | null {
  const cleaned = phone.replace(/\s+/g, "").replace(/^0+/, "");
  const w = cleaned.startsWith("976") ? `+${cleaned}` : `+976${cleaned}`;
  return /^\+976[0-9]{8}$/.test(w) ? w : null;
}

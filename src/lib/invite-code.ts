import { randomInt } from "crypto";

// Shared folder-ийн урих код үүсгэнэ.
// O, I, 0, 1-г хассан — андуурахаас сэргийлнэ.
// crypto.randomInt — таамаглах боломжгүй; 8 тэмдэгт = 32^8 (~1.1e12) хувилбар.
export function generateInviteCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[randomInt(chars.length)];
  }
  return code;
}

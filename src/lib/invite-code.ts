// Shared folder-ийн урих код үүсгэнэ.
// O, I, 0, 1-г хассан — андуурахаас сэргийлнэ.
export function generateInviteCode(length = 5): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

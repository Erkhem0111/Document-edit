export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

// Үүнээс том файлыг browser шууд R2 руу илгээнэ (Vercel-ийн 4.5MB хязгаараас
// доогуур, multipart-ын нэмэлт байтад зай үлдээсэн)
export const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024;

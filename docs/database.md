# Өгөгдлийн сан (Docker) — нөөц, сэргээлт

## Тогтмол хэрэглэх командууд

| Юу хийх | Команд |
|---|---|
| Асаах | `docker compose up -d db` |
| Зогсоох (өгөгдөл үлдэнэ) | `docker compose stop db` |
| Нөөц хийх | `npm run db:backup` → `backups/` хавтсанд |
| Нөөцөөс сэргээх | `npm run db:restore -- backups/<файл>.sql --yes` |

- Өгөгдөл `company_db_data` нэртэй Docker volume-д хадгалагдана — контейнерийг
  устгаж дахин үүсгэсэн ч алга болохгүй.
- **Хэзээ ч бүү ажиллуул:** `docker compose down -v`, `docker volume rm company_db_data`,
  `npx prisma migrate dev` (өгөгдлийн санг цэвэрлэж болзошгүй). Схемийн өөрчлөлтийг
  үргэлж `npx prisma migrate deploy`-оор оруулна.
- `backups/` хавтас хэрэглэгчийн имэйл, нууц үгийн hash агуулдаг тул git-д орохгүй
  (`.gitignore`). Чухал нөөцийг өөр газар (гадаад диск, cloud) хуулж хадгална.
- `npm run db:restore` нь сэргээхээсээ өмнө одоогийн байдлыг автоматаар нөөцөлнө.

## Нэг удаагийн шилжүүлэлт: нэргүй volume → `company_db_data`

Хуучин `docker-compose.yml` volume заагаагүй байсан тул өгөгдөл Docker-ийн
автоматаар үүсгэсэн *нэргүй* volume-д байгаа. `docker compose down` хийгээд дахин
асаавал шинэ хоосон volume үүсч, өгөгдөл "алга болсон" мэт харагдана.
Доорх алхмууд **юу ч устгахгүй** — хуучин контейнер нөөц болж үлдэнэ.

1. `.env` файлд нэмнэ (DATABASE_URL дахь нууц үгтэй ижил):
   ```
   POSTGRES_PASSWORD=<DATABASE_URL дахь нууц үг>
   ```
2. Нөөц: `npm run db:backup` → `✔ Нөөц хадгалагдлаа: ...` гарах ёстой.
3. Хуучин контейнерийг зогсоож, нэрийг нь сольж нөөц болгон үлдээнэ:
   ```
   docker stop company_db
   docker update --restart=no company_db
   docker rename company_db company_db_old
   ```
4. Шинэ контейнер (нэртэй volume-тэй): `docker compose up -d db`
   — 10-20 секунд хүлээгээд `docker ps`-д `company_db ... (healthy)` гэж гарна.
5. Сэргээх: `npm run db:restore -- backups/<2-р алхмын файл>.sql --yes`
6. Шалгах: `npx prisma migrate status` → "Database schema is up to date!",
   `npm run dev` → нэвтэрч, төсөл, файлууд хэвээр эсэхийг харна.
7. Бүх зүйл зөв бол (хэдэн өдрийн дараа) хуучныг устгана:
   ```
   docker rm company_db_old
   ```

### Ямар нэг юм буруу болбол
Шинийг зогсоогоод хуучныг буцааж асаана — яг өмнөх байдалдаа орно:
```
docker compose stop db
docker rename company_db company_db_new
docker rename company_db_old company_db
docker start company_db
```

# VMS API Starter

Backend starter untuk Visitor Management System, dibangun dengan NestJS, Prisma, dan PostgreSQL. Modul contoh memperlihatkan pola pemisahan controller, service, DTO, dan module yang dapat dijadikan acuan untuk modul VMS.

## Menjalankan aplikasi

1. Salin `.env.example` menjadi `.env`, lalu sesuaikan `DATABASE_URL` dan konfigurasi lokal.
2. Pasang dependensi dan generate Prisma Client:

   ```bash
   npm install
   npm run db:generate
   ```

3. Buat tabel awal pada database:

   ```bash
   npm run db:migrate -- --name init
   ```

4. Jalankan API:

   ```bash
   npm run start:dev
   ```

API berjalan pada `http://localhost:3000` secara default.

## Endpoint starter

- `GET /api/v1/health` — status API.
- `GET /api/v1/example-items` — daftar berpaginasi (`page`, `limit`, `search`).
- `GET /api/v1/example-items/:id` — detail item.
- `POST /api/v1/example-items` — tambah item.
- `PATCH /api/v1/example-items/:id` — ubah item.
- `DELETE /api/v1/example-items/:id` — hapus item.
- `GET /api/webapp-docs` — dokumentasi Swagger.
- `GET /api/webapp-docs-json` — dokumen OpenAPI untuk code generation frontend.

Modul `example-items` hanya contoh alur CRUD. Ganti atau hapus modul itu saat menambahkan domain VMS.

## Struktur kode

```text
src/
├── common/                 # Utilitas dan komponen lintas modul
├── modules/
│   └── example-items/      # Contoh DTO, controller, service, module
├── app.module.ts           # Registrasi modul aplikasi
├── health.controller.ts    # Endpoint health check
├── main.ts                 # Bootstrap, validasi, CORS, Swagger
└── prisma.module.ts        # Prisma client global
prisma/
└── schema.prisma           # Model database starter
```

## Perintah utama

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
npm run db:generate
npm run db:migrate
npm run db:deploy
```

`CORS_ORIGIN` menerima satu atau beberapa origin yang dipisahkan koma. Jika kosong, NestJS merefleksikan origin request untuk pengembangan lokal.
# nest-template
# vms-be

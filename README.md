# LEMIGAS Visitor Management System API

Backend VMS untuk pilot Ruangan Telematika LEMIGAS. API menggunakan NestJS, Prisma, dan PostgreSQL. Modul mengikuti pola controller, DTO, service, dan module agar endpoint baru tetap konsisten.

## Setup lokal

1. Salin `.env.example` ke `.env`, lalu isi koneksi database, secret aplikasi, kredensial Tuya, dan gateway notifikasi. Jangan commit `.env`.
2. Install package dan buat Prisma Client:

   ```bash
   npm install
   npm run db:generate
   ```

3. Terapkan migrasi ke database yang dipilih:

   ```bash
   npm run db:deploy
   ```

   Migrasi awal membuat tabel VMS dan trigger PostgreSQL yang menolak update, delete, dan truncate pada log pintu serta riwayat status. Pastikan `DATABASE_URL` menunjuk database target yang benar sebelum menjalankan migrasi.

4. Jalankan API:

   ```bash
   npm run start:dev
   ```

API memakai prefix `/api/v1`. Swagger tersedia di `/api/webapp-docs`, sedangkan OpenAPI JSON untuk `vms-fe` tersedia di `/api/webapp-docs-json`.

## Bootstrap akun dan autentikasi

Set `JWT_SECRET_KEY` (minimal 16 karakter untuk lokal; 32 karakter untuk production) dan `SECRET_KEY` (minimal 16 karakter untuk lokal; 32 karakter untuk production). `JWT_SECRET_KEY` menandatangani token, sedangkan `SECRET_KEY` menjadi kunci turunan untuk enkripsi PIN. Untuk deployment baru, disarankan set `CREDENTIAL_ENCRYPTION_KEY` eksplisit sebagai 32-byte hex. `JWT_EXPIRES_IN` menerima detik atau durasi seperti `12h`.

Login menerima `BYPASS_LOGIN` sebagai password bersama hanya bila `APP_ENV` atau `NODE_ENV` menunjukkan `dev`, `development`, `local`, atau `test`; bypass ditolak di production. Username tetap harus milik akun aktif. Seeder membuat akun dev `admin.vms`, `pic.telematika`, dan `auditor.vms`. Password akun seed dibuat acak; isi `SEED_ADMIN_PASSWORD`, `SEED_PIC_PASSWORD`, atau `SEED_AUDITOR_PASSWORD` untuk menetapkan password normal. Jika tidak diisi, akun lokal tetap dapat diakses lewat bypass dev. Buat admin pertama melalui `POST /api/v1/auth/bootstrap` dengan header `x-bootstrap-key` jika tidak memakai seeder. Setelah login di `POST /api/v1/auth/login`, kirim token sebagai `Authorization: Bearer <token>`.

Jalankan seed lokal dengan `npm run db:seed`. Seeder tidak membuat perangkat palsu; konfigurasi `TUYA_DEVICE_ID` terlebih dahulu agar ruang pilot ikut dibuat.

Peran internal: `PIC`, `ADMIN`, `AUDITOR`. PIC hanya melihat dan mengelola kunjungan yang ditujukan kepadanya. Admin mengelola perangkat, pengguna, setting, kunjungan, dan laporan. Auditor hanya membaca kunjungan, audit, serta laporan.

## Endpoint utama

| Area             | Endpoint                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Pengguna         | `POST /auth/login`, `POST /auth/bootstrap`, `GET /auth/me`, `/users`                                                  |
| Kunjungan        | `GET /visits/pics`, `POST /visits`, `POST /visits/walk-in`, `GET /visits`, `GET /visits/:id`                          |
| Approval         | `POST /visits/:id/approve`, `/reject`, `/provision`, `/extend`, `/check-out`, `/revoke`, `/manual-check-in`           |
| Perangkat        | `GET /devices`, `POST /devices`, `PATCH /devices/:id`                                                                 |
| Pengaturan       | `GET /settings`, `PATCH /settings`                                                                                    |
| Event pintu      | `POST /integrations/tuya/events`                                                                                      |
| Audit dan ekspor | `GET /audit-logs`, `/reports/visits.csv`, `/reports/visits.pdf`, `/reports/door-audit.csv`, `/reports/door-audit.pdf` |

Pengajuan publik dimulai dengan status `PENDING_APPROVAL`. Approval membuat PIN sementara melalui Tuya dengan buffer akses default 15 menit sebelum dan sesudah jadwal. PIC/Admin dapat memperpanjang kunjungan aktif 30 atau 60 menit dengan PIN dan `password_id` yang sama. Check-out dan pembatalan menghapus PIN di Tuya terlebih dahulu; jika penghapusan gagal, kunjungan tidak ditandai selesai/dicabut.

PIN hanya dikembalikan pada respons provisioning yang berizin. Database menyimpan PIN terenkripsi AES-256-GCM dan tampilan tersamarkan. Payload antrean notifikasi tidak disimpan. Atur `NOTIFICATION_GATEWAY_URL` ke adapter internal yang menerima `channel`, `recipient`, `subject`, dan `message`, lalu meneruskan ke email/WhatsApp; status dan kegagalan pengiriman tersimpan di `notification_deliveries`.

## Integrasi Tuya dan batas pilot

- Isi `TUYA_API_ENDPOINT` dengan region Tuya cloud yang sesuai, serta `TUYA_ACCESS_ID` dan `TUYA_ACCESS_SECRET`. Adapter menandatangani request HMAC-SHA256, meminta ticket password, membuat/memperbarui temporary PIN, dan menghapus PIN.
- `TUYA_BATTERY_DP_CODES` mengatur kode status Tuya yang dipakai untuk membaca persentase baterai. Job melakukan sinkronisasi setiap enam jam dan mengirim peringatan saat baterai melewati batas 20%.
- Tuya Message Queue perlu consumer terpisah untuk menerima/dekripsi payload Tuya dan mengirim bentuk event normal ke `/api/v1/integrations/tuya/events` menggunakan header `x-vms-integration-key`. Endpoint tersebut bukan endpoint push langsung Tuya.
- Algoritme offline PIN lokal dalam PRD belum dapat dijalankan dengan aman dari informasi yang tersedia. API tidak membuat PIN fallback palsu; provisioning yang gagal tetap berstatus `APPROVED`, menyimpan alasan kegagalan, dan dapat dicoba ulang setelah diverifikasi. Sebelum mode offline diaktifkan, validasi dukungan/izin API, model DLP 3121, panjang PIN, timezone perangkat, dan proses pencabutan langsung pada perangkat.
- Jam operasional belum ditentukan di PRD. Sampai Admin mengatur `operating_hours_start` dan `operating_hours_end`, validasi jam tidak membatasi pengajuan. Kunjungan darurat dapat melewati batas jam yang sudah dikonfigurasi.

## Konfigurasi

| Variable                                                 | Kegunaan                                             |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`                                           | Koneksi PostgreSQL                                   |
| `APP_ENV`                                                | Mode aplikasi; `dev` mengaktifkan login bypass lokal |
| `JWT_SECRET_KEY`                                         | Tanda tangan bearer token                            |
| `JWT_EXPIRES_IN`                                         | Masa berlaku token, misalnya `12h`                   |
| `BYPASS_LOGIN`                                           | Password bypass khusus environment non-production    |
| `SECRET_KEY`                                             | Kunci turunan enkripsi PIN lokal                     |
| `CREDENTIAL_ENCRYPTION_KEY`                              | Override kunci AES-256-GCM, 64 karakter hex          |
| `BOOTSTRAP_ADMIN_KEY`                                    | Secret sekali pakai untuk bootstrap admin pertama    |
| `TUYA_API_ENDPOINT`                                      | Endpoint regional Tuya Cloud                         |
| `TUYA_ACCESS_ID`, `TUYA_ACCESS_SECRET`                   | Kredensial Tuya Cloud                                |
| `TUYA_INGESTION_KEY`                                     | Secret untuk consumer event Tuya                     |
| `TUYA_BATTERY_DP_CODES`                                  | Kode Tuya status baterai                             |
| `NOTIFICATION_GATEWAY_URL`, `NOTIFICATION_GATEWAY_TOKEN` | Adapter email/WhatsApp internal                      |
| `VMS_TIMEZONE`                                           | Zona waktu aplikasi, default `Asia/Jakarta`          |
| `CORS_ORIGIN`                                            | Satu atau beberapa origin frontend, dipisahkan koma  |

## Perintah

```bash
npm run build
npm run lint
npm run db:generate
npm run db:deploy
npm run db:seed
```

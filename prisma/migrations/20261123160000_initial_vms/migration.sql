-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PIC', 'ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'PROVISIONED', 'OFFLINE_FALLBACK', 'CHECKED_IN', 'REJECTED', 'COMPLETED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('ONLINE_TEMP', 'OFFLINE_TEMP', 'RFID_BACKUP');

-- CreateEnum
CREATE TYPE "DeviceConnectionStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DoorEventType" AS ENUM ('UNLOCK_PIN', 'UNLOCK_RFID', 'WRONG_PIN', 'TAMPER', 'LOW_BATTERY', 'DEVICE_ONLINE', 'DEVICE_OFFLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "nip_username" VARCHAR(80) NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone_number" VARCHAR(32),
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PIC',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_devices" (
    "id" UUID NOT NULL,
    "room_name" VARCHAR(160) NOT NULL,
    "tuya_device_id" VARCHAR(120) NOT NULL,
    "pin_length" INTEGER NOT NULL DEFAULT 7,
    "battery_level" INTEGER,
    "connection_status" "DeviceConnectionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "last_synced_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "room_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_requests" (
    "id" UUID NOT NULL,
    "visit_code" VARCHAR(32) NOT NULL,
    "visitor_name" VARCHAR(160) NOT NULL,
    "visitor_identity_no" VARCHAR(80) NOT NULL,
    "visitor_institution" VARCHAR(160) NOT NULL,
    "visitor_phone" VARCHAR(32) NOT NULL,
    "visitor_email" VARCHAR(254) NOT NULL,
    "purpose" TEXT NOT NULL,
    "pic_user_id" UUID NOT NULL,
    "room_device_id" UUID NOT NULL,
    "registered_by_id" UUID,
    "approved_by_id" UUID,
    "scheduled_start" TIMESTAMPTZ(6) NOT NULL,
    "scheduled_end" TIMESTAMPTZ(6) NOT NULL,
    "is_emergency" BOOLEAN NOT NULL DEFAULT false,
    "status" "VisitStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "provisioning_error" VARCHAR(500),
    "provisioning_started_at" TIMESTAMPTZ(6),
    "rejection_reason" VARCHAR(500),
    "expiry_reminder_sent_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "checked_in_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "visit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_credentials" (
    "id" UUID NOT NULL,
    "visit_request_id" UUID NOT NULL,
    "tuya_password_id" VARCHAR(100),
    "pin_code_masked" VARCHAR(16) NOT NULL,
    "pin_ciphertext" TEXT NOT NULL,
    "pin_iv" VARCHAR(64) NOT NULL,
    "pin_auth_tag" VARCHAR(64) NOT NULL,
    "pin_type" "CredentialType" NOT NULL DEFAULT 'ONLINE_TEMP',
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_until" TIMESTAMPTZ(6) NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "access_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "door_audit_logs" (
    "id" UUID NOT NULL,
    "event_key" VARCHAR(160),
    "room_device_id" UUID NOT NULL,
    "visit_request_id" UUID,
    "event_type" "DoorEventType" NOT NULL,
    "tuya_credential_ref" VARCHAR(100),
    "raw_payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "door_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_status_logs" (
    "id" UUID NOT NULL,
    "visit_request_id" UUID NOT NULL,
    "from_status" "VisitStatus",
    "to_status" "VisitStatus" NOT NULL,
    "changed_by_id" UUID,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "visit_request_id" UUID,
    "room_device_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" VARCHAR(254) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" VARCHAR(500),
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_nip_username_key" ON "users"("nip_username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "room_devices_tuya_device_id_key" ON "room_devices"("tuya_device_id");

-- CreateIndex
CREATE UNIQUE INDEX "visit_requests_visit_code_key" ON "visit_requests"("visit_code");

-- CreateIndex
CREATE INDEX "visit_requests_status_scheduled_start_idx" ON "visit_requests"("status", "scheduled_start");

-- CreateIndex
CREATE INDEX "visit_requests_pic_user_id_created_at_idx" ON "visit_requests"("pic_user_id", "created_at");

-- CreateIndex
CREATE INDEX "visit_requests_visitor_identity_no_idx" ON "visit_requests"("visitor_identity_no");

-- CreateIndex
CREATE UNIQUE INDEX "access_credentials_visit_request_id_key" ON "access_credentials"("visit_request_id");

-- CreateIndex
CREATE INDEX "access_credentials_tuya_password_id_idx" ON "access_credentials"("tuya_password_id");

-- CreateIndex
CREATE INDEX "access_credentials_effective_until_is_revoked_idx" ON "access_credentials"("effective_until", "is_revoked");

-- CreateIndex
CREATE UNIQUE INDEX "door_audit_logs_event_key_key" ON "door_audit_logs"("event_key");

-- CreateIndex
CREATE INDEX "door_audit_logs_occurred_at_idx" ON "door_audit_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "door_audit_logs_event_type_occurred_at_idx" ON "door_audit_logs"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "door_audit_logs_visit_request_id_occurred_at_idx" ON "door_audit_logs"("visit_request_id", "occurred_at");

-- CreateIndex
CREATE INDEX "visit_status_logs_visit_request_id_created_at_idx" ON "visit_status_logs"("visit_request_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_created_at_idx" ON "notification_deliveries"("status", "created_at");

-- AddForeignKey
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_pic_user_id_fkey" FOREIGN KEY ("pic_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_room_device_id_fkey" FOREIGN KEY ("room_device_id") REFERENCES "room_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_visit_request_id_fkey" FOREIGN KEY ("visit_request_id") REFERENCES "visit_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "door_audit_logs" ADD CONSTRAINT "door_audit_logs_room_device_id_fkey" FOREIGN KEY ("room_device_id") REFERENCES "room_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "door_audit_logs" ADD CONSTRAINT "door_audit_logs_visit_request_id_fkey" FOREIGN KEY ("visit_request_id") REFERENCES "visit_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_status_logs" ADD CONSTRAINT "visit_status_logs_visit_request_id_fkey" FOREIGN KEY ("visit_request_id") REFERENCES "visit_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_status_logs" ADD CONSTRAINT "visit_status_logs_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_visit_request_id_fkey" FOREIGN KEY ("visit_request_id") REFERENCES "visit_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_room_device_id_fkey" FOREIGN KEY ("room_device_id") REFERENCES "room_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Audit and visit-state history are append-only at the database layer.
CREATE FUNCTION reject_immutable_record_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Records in % are immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER door_audit_logs_reject_update_delete
BEFORE UPDATE OR DELETE ON "door_audit_logs"
FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();

CREATE TRIGGER door_audit_logs_reject_truncate
BEFORE TRUNCATE ON "door_audit_logs"
FOR EACH STATEMENT EXECUTE FUNCTION reject_immutable_record_mutation();

CREATE TRIGGER visit_status_logs_reject_update_delete
BEFORE UPDATE OR DELETE ON "visit_status_logs"
FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();

CREATE TRIGGER visit_status_logs_reject_truncate
BEFORE TRUNCATE ON "visit_status_logs"
FOR EACH STATEMENT EXECUTE FUNCTION reject_immutable_record_mutation();

CREATE TABLE "buildings" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "address" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "building_floors" (
    "id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "floor_number" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "building_floors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "floor_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "code" VARCHAR(40),
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doors" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(40),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "doors_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "room_devices" ADD COLUMN "door_id" UUID;

CREATE UNIQUE INDEX "buildings_code_key" ON "buildings"("code");
CREATE INDEX "buildings_is_active_name_idx" ON "buildings"("is_active", "name");
CREATE UNIQUE INDEX "building_floors_building_id_name_key" ON "building_floors"("building_id", "name");
CREATE INDEX "building_floors_building_id_floor_number_idx" ON "building_floors"("building_id", "floor_number");
CREATE UNIQUE INDEX "rooms_floor_id_name_key" ON "rooms"("floor_id", "name");
CREATE INDEX "rooms_floor_id_is_active_idx" ON "rooms"("floor_id", "is_active");
CREATE UNIQUE INDEX "doors_room_id_name_key" ON "doors"("room_id", "name");
CREATE INDEX "doors_room_id_is_active_idx" ON "doors"("room_id", "is_active");
CREATE UNIQUE INDEX "room_devices_door_id_key" ON "room_devices"("door_id");

ALTER TABLE "building_floors" ADD CONSTRAINT "building_floors_building_id_fkey"
    FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_floor_id_fkey"
    FOREIGN KEY ("floor_id") REFERENCES "building_floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doors" ADD CONSTRAINT "doors_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "room_devices" ADD CONSTRAINT "room_devices_door_id_fkey"
    FOREIGN KEY ("door_id") REFERENCES "doors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

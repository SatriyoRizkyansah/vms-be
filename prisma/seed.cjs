require('dotenv/config');

const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const roles = [
  {
    role: 'ADMIN',
    usernameEnv: 'SEED_ADMIN_USERNAME',
    fullNameEnv: 'SEED_ADMIN_FULL_NAME',
    emailEnv: 'SEED_ADMIN_EMAIL',
    passwordEnv: 'SEED_ADMIN_PASSWORD',
    username: 'admin.vms',
    fullName: 'VMS Administrator',
    email: 'admin@vms.test',
  },
  {
    role: 'PIC',
    usernameEnv: 'SEED_PIC_USERNAME',
    fullNameEnv: 'SEED_PIC_FULL_NAME',
    emailEnv: 'SEED_PIC_EMAIL',
    passwordEnv: 'SEED_PIC_PASSWORD',
    username: 'pic.telematika',
    fullName: 'PIC Telematika',
    email: 'pic.telematika@vms.test',
  },
  {
    role: 'AUDITOR',
    usernameEnv: 'SEED_AUDITOR_USERNAME',
    fullNameEnv: 'SEED_AUDITOR_FULL_NAME',
    emailEnv: 'SEED_AUDITOR_EMAIL',
    passwordEnv: 'SEED_AUDITOR_PASSWORD',
    username: 'auditor.vms',
    fullName: 'VMS Auditor',
    email: 'auditor@vms.test',
  },
];

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, salt, expectedHex] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function isDevelopmentEnvironment() {
  const values = [process.env.APP_ENV, process.env.NODE_ENV]
    .filter(Boolean)
    .map((value) => value.toLowerCase());
  return (
    !values.some((value) => ['prod', 'production'].includes(value)) &&
    values.some((value) =>
      ['dev', 'development', 'local', 'test'].includes(value),
    )
  );
}

async function seedUser(config) {
  const username = process.env[config.usernameEnv] ?? config.username;
  const full_name = process.env[config.fullNameEnv] ?? config.fullName;
  const email = process.env[config.emailEnv] ?? config.email;
  const configuredPassword = process.env[config.passwordEnv];
  const bypassPassword = process.env.BYPASS_LOGIN;

  if (configuredPassword && configuredPassword.length < 12) {
    throw new Error(`${config.passwordEnv} must be at least 12 characters`);
  }
  if (!configuredPassword && !bypassPassword) {
    throw new Error(
      `${config.passwordEnv} or BYPASS_LOGIN is required to seed accounts`,
    );
  }

  const existing = await prisma.user.findUnique({
    where: { nip_username: username },
    select: { id: true, password_hash: true },
  });
  const randomSeedPassword = randomBytes(32).toString('base64url');
  const createPasswordHash = hashPassword(
    configuredPassword ?? randomSeedPassword,
  );
  const updatePasswordHash = configuredPassword
    ? hashPassword(configuredPassword)
    : existing &&
        bypassPassword &&
        verifyPassword(bypassPassword, existing.password_hash)
      ? hashPassword(randomSeedPassword)
      : undefined;
  const user = await prisma.user.upsert({
    where: { nip_username: username },
    create: {
      nip_username: username,
      full_name,
      email,
      password_hash: createPasswordHash,
      role: config.role,
      is_active: true,
      ...(updatePasswordHash ? { password_hash: updatePasswordHash } : {}),
    },
    update: {
      full_name,
      email,
      role: config.role,
      is_active: true,
    },
    select: { id: true, nip_username: true, role: true },
  });

  process.stdout.write(
    `${existing ? 'Updated' : 'Created'} ${user.role} account: ${user.nip_username}\n`,
  );
}

async function seedDefaults() {
  if (!isDevelopmentEnvironment()) {
    throw new Error(
      'Default accounts may only be seeded in APP_ENV=dev/development/local/test; configure the runtime environment first.',
    );
  }

  for (const role of roles) await seedUser(role);

  for (const [key, value] of [
    ['access_buffer_before_minutes', '15'],
    ['access_buffer_after_minutes', '15'],
  ]) {
    const existing = await prisma.systemSetting.findUnique({ where: { key } });
    if (!existing) await prisma.systemSetting.create({ data: { key, value } });
  }

  const tuyaDeviceId = process.env.TUYA_DEVICE_ID?.trim();
  if (tuyaDeviceId) {
    const existing = await prisma.roomDevice.findUnique({
      where: { tuya_device_id: tuyaDeviceId },
      select: { id: true },
    });
    if (!existing) {
      await prisma.roomDevice.create({
        data: {
          room_name: process.env.SEED_ROOM_NAME ?? 'Ruangan Telematika',
          tuya_device_id: tuyaDeviceId,
          pin_length: Number(process.env.TUYA_PIN_LENGTH ?? 7),
        },
      });
      process.stdout.write('Created the configured pilot room device.\n');
    }
  } else {
    process.stdout.write(
      'Skipped room device seed: TUYA_DEVICE_ID is not configured.\n',
    );
  }
}

seedDefaults()
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

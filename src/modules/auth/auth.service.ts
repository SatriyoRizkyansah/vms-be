import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { signToken } from '../../common/auth';
import { PrismaService } from '../../prisma.module';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { LoginDto } from './dto/login.dto';

const scrypt = promisify(scryptCallback);
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 12;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { nip_username: dto.username },
    });
    const bypassMatches = isValidBypassPassword(dto.password);
    if (
      !user?.is_active ||
      (!bypassMatches &&
        !(await verifyPassword(dto.password, user.password_hash)))
    ) {
      throw new UnauthorizedException('Username or password is incorrect');
    }

    return this.createSession(user);
  }

  async bootstrapAdmin(dto: BootstrapAdminDto, suppliedKey?: string) {
    const expectedKey = process.env.BOOTSTRAP_ADMIN_KEY;
    if (
      !expectedKey ||
      !suppliedKey ||
      !safeStringEqual(expectedKey, suppliedKey)
    ) {
      throw new ForbiddenException(
        'Admin bootstrap is not configured or the key is invalid',
      );
    }

    const password_hash = await hashPassword(dto.password);
    const user = await this.prisma.$transaction(
      async (tx) => {
        const adminCount = await tx.user.count({
          where: { role: UserRole.ADMIN },
        });
        if (adminCount > 0) {
          throw new ConflictException('An admin account already exists');
        }

        return tx.user.create({
          data: {
            nip_username: dto.username,
            full_name: dto.full_name,
            email: dto.email,
            phone_number: dto.phone_number,
            password_hash,
            role: UserRole.ADMIN,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    return this.createSession(user);
  }

  async createUserPassword(password: string) {
    return hashPassword(password);
  }

  private createSession(user: {
    id: string;
    nip_username: string;
    full_name: string;
    email: string;
    phone_number: string | null;
    role: UserRole;
  }) {
    const expiresIn = getTokenTtlSeconds();
    const access_token = signToken({
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + expiresIn,
    });
    return {
      access_token,
      token_type: 'Bearer',
      expires_in: expiresIn,
      user: {
        id: user.id,
        nip_username: user.nip_username,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role,
      },
    };
  }
}

function isValidBypassPassword(password: string) {
  const bypassPassword = process.env.BYPASS_LOGIN;
  const environments = [process.env.APP_ENV, process.env.NODE_ENV]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());
  const isDevelopment = environments.some((value) =>
    ['dev', 'development', 'local', 'test'].includes(value),
  );
  const isProduction = environments.some((value) =>
    ['prod', 'production'].includes(value),
  );
  return Boolean(
    bypassPassword &&
    isDevelopment &&
    !isProduction &&
    safeStringEqual(bypassPassword, password),
  );
}

function getTokenTtlSeconds() {
  const configured = process.env.JWT_EXPIRES_IN?.trim();
  if (!configured) return DEFAULT_TOKEN_TTL_SECONDS;

  const match = configured.match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!match) {
    throw new Error('JWT_EXPIRES_IN must be seconds or use s, m, h, or d');
  }
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? 's';
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  const multiplier = multipliers[unit];
  if (!multiplier)
    throw new Error('JWT_EXPIRES_IN has an unsupported duration unit');
  const expiresIn = amount * multiplier;
  if (
    !Number.isSafeInteger(expiresIn) ||
    expiresIn < 60 ||
    expiresIn > 30 * 86400
  ) {
    throw new Error('JWT_EXPIRES_IN must be between 60 seconds and 30 days');
  }
  return expiresIn;
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expectedHex] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function safeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma.module';

export const ROLES_KEY = 'vms:roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthenticatedUser {
  id: string;
  nip_username: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  role: UserRole;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user!,
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Bearer token is required');

    const payload = verifyToken(token);
    if (!payload) throw new UnauthorizedException('Invalid or expired token');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        nip_username: true,
        full_name: true,
        email: true,
        phone_number: true,
        role: true,
        is_active: true,
      },
    });
    if (!user?.is_active)
      throw new UnauthorizedException('Account is inactive');

    request.user = {
      id: user.id,
      nip_username: user.nip_username,
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number,
      role: user.role,
    };
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return Boolean(request.user && roles.includes(request.user.role));
  }
}

interface TokenPayload {
  sub: string;
  exp: number;
}

export function signToken(payload: TokenPayload) {
  const secret = getJwtSecret();

  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): TokenPayload | null {
  let secret: string;
  try {
    secret = getJwtSecret();
  } catch {
    return null;
  }

  const [header, body, signature, extra] = token.split('.');
  if (!header || !body || !signature || extra) return null;
  const expected = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null;
  }

  try {
    const decodedHeader = JSON.parse(
      Buffer.from(header, 'base64url').toString(),
    );
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString(),
    ) as TokenPayload;
    if (
      decodedHeader.alg !== 'HS256' ||
      !payload.sub ||
      payload.exp <= Date.now() / 1000
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function encodeBase64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET_KEY ?? process.env.JWT_SECRET;
  const production = [process.env.APP_ENV, process.env.NODE_ENV]
    .filter(Boolean)
    .some((value) => ['prod', 'production'].includes(value!.toLowerCase()));
  const minLength = production ? 32 : 16;
  if (!secret || Buffer.byteLength(secret) < minLength) {
    throw new Error(
      `JWT secret must be at least ${minLength} bytes for this environment`,
    );
  }
  return secret;
}

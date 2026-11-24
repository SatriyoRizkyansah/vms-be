import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomUUID,
} from 'node:crypto';

interface TuyaEnvelope<T> {
  success: boolean;
  msg?: string;
  code?: number;
  result: T;
}

interface PasswordTicket {
  ticket_id: string;
  ticket_key: string;
}

interface DevicePasswordResponse {
  id: string | number;
}

interface DeviceStateResponse {
  online?: boolean;
  status?: Array<{ code: string; value: unknown }>;
}

@Injectable()
export class TuyaService {
  private accessToken?: string;
  private tokenExpiresAt = 0;

  async createTemporaryPassword(input: {
    device_id: string;
    name: string;
    pin: string;
    phone: string;
    effective_at: Date;
    expires_at: Date;
  }) {
    const ticket = await this.getPasswordTicket(input.device_id);
    const password = encryptWithTicket(
      input.pin,
      ticket.ticket_key,
      this.accessSecret,
    );
    const result = await this.request<DevicePasswordResponse>(
      'POST',
      `/v1.0/devices/${encodeURIComponent(input.device_id)}/door-lock/temp-password`,
      {
        name: input.name.slice(0, 64),
        password,
        effective_time: Math.floor(input.effective_at.getTime() / 1000),
        invalid_time: Math.floor(input.expires_at.getTime() / 1000),
        password_type: 'ticket',
        ticket_id: ticket.ticket_id,
        phone: input.phone,
        type: 0,
      },
    );
    return { password_id: String(result.id) };
  }

  async modifyTemporaryPassword(input: {
    device_id: string;
    password_id: string;
    pin: string;
    phone: string;
    effective_at: Date;
    expires_at: Date;
  }) {
    const ticket = await this.getPasswordTicket(input.device_id);
    const password = encryptWithTicket(
      input.pin,
      ticket.ticket_key,
      this.accessSecret,
    );
    const modified = await this.request<boolean>(
      'PUT',
      `/v1.0/devices/${encodeURIComponent(input.device_id)}/door-lock/temp-passwords/${encodeURIComponent(input.password_id)}/modify-password`,
      {
        phone: input.phone,
        password,
        password_type: 'ticket',
        ticket_id: ticket.ticket_id,
        effective_time: Math.floor(input.effective_at.getTime() / 1000),
        invalid_time: Math.floor(input.expires_at.getTime() / 1000),
      },
    );
    if (!modified)
      throw new ServiceUnavailableException(
        'Tuya did not update the temporary password',
      );
  }

  async deleteTemporaryPassword(device_id: string, password_id: string) {
    const deleted = await this.request<boolean>(
      'DELETE',
      `/v1.0/devices/${encodeURIComponent(device_id)}/door-lock/temp-passwords/${encodeURIComponent(password_id)}`,
    );
    if (!deleted)
      throw new ServiceUnavailableException(
        'Tuya did not delete the temporary password',
      );
  }

  async getDeviceState(device_id: string) {
    return this.request<DeviceStateResponse>(
      'GET',
      `/v1.0/devices/${encodeURIComponent(device_id)}`,
    );
  }

  private async getPasswordTicket(device_id: string) {
    return this.request<PasswordTicket>(
      'POST',
      `/v1.0/devices/${encodeURIComponent(device_id)}/door-lock/password-ticket`,
      {},
    );
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const accessToken = await this.getAccessToken();
    const response = await this.signedFetch<T>(method, path, body, accessToken);
    return response;
  }

  private async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.accessToken;
    }

    const response = await this.signedFetch<{
      access_token: string;
      expire_time: number;
    }>('GET', '/v1.0/token?grant_type=1', undefined, undefined);
    this.accessToken = response.access_token;
    this.tokenExpiresAt = Date.now() + response.expire_time * 1000;
    return this.accessToken;
  }

  private async signedFetch<T>(
    method: string,
    path: string,
    body: unknown,
    accessToken?: string,
  ): Promise<T> {
    const endpoint = this.endpoint;
    const clientId = this.clientId;
    const secret = this.accessSecret;
    const timestamp = Date.now().toString();
    const nonce = randomUUID().replaceAll('-', '');
    const payload = body === undefined ? '' : JSON.stringify(body);
    const contentHash = createHash('sha256').update(payload).digest('hex');
    const stringToSign = `${method}\n${contentHash}\n\n${path}`;
    const signInput = `${clientId}${accessToken ?? ''}${timestamp}${nonce}${stringToSign}`;
    const sign = createHmac('sha256', secret)
      .update(signInput)
      .digest('hex')
      .toUpperCase();
    const headers: Record<string, string> = {
      client_id: clientId,
      t: timestamp,
      nonce,
      sign_method: 'HMAC-SHA256',
      sign,
    };
    if (accessToken) headers.access_token = accessToken;
    if (payload) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await fetch(new URL(path, endpoint), {
        method,
        headers,
        body: payload || undefined,
        signal: AbortSignal.timeout(4_000),
      });
    } catch {
      throw new ServiceUnavailableException('Tuya Cloud is unavailable');
    }

    let envelope: TuyaEnvelope<T>;
    try {
      envelope = (await response.json()) as TuyaEnvelope<T>;
    } catch {
      throw new ServiceUnavailableException(
        'Tuya Cloud returned an invalid response',
      );
    }
    if (!response.ok || !envelope.success) {
      throw new ServiceUnavailableException(
        `Tuya request failed${envelope.code ? ` (${envelope.code})` : ''}: ${envelope.msg ?? 'unknown error'}`,
      );
    }
    return envelope.result;
  }

  private get endpoint() {
    const endpoint = process.env.TUYA_API_ENDPOINT?.trim();
    if (!endpoint)
      throw new ServiceUnavailableException(
        'TUYA_API_ENDPOINT is not configured',
      );
    return endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
  }

  private get clientId() {
    const clientId = process.env.TUYA_ACCESS_ID?.trim();
    if (!clientId)
      throw new ServiceUnavailableException('TUYA_ACCESS_ID is not configured');
    return clientId;
  }

  private get accessSecret() {
    const secret = process.env.TUYA_ACCESS_SECRET?.trim();
    if (!secret)
      throw new ServiceUnavailableException(
        'TUYA_ACCESS_SECRET is not configured',
      );
    return secret;
  }
}

function encryptWithTicket(
  pin: string,
  encryptedTicketKey: string,
  accessSecret: string,
) {
  const aesKey = decryptTicketKey(encryptedTicketKey, accessSecret);
  const cipher = createCipheriv('aes-128-ecb', aesKey, null);
  return Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()])
    .toString('hex')
    .toUpperCase();
}

function decryptTicketKey(encryptedTicketKey: string, accessSecret: string) {
  const masterKey = Buffer.from(accessSecret, 'utf8');
  if (![16, 24, 32].includes(masterKey.length)) {
    throw new ServiceUnavailableException(
      'Tuya access secret has an unsupported AES key length',
    );
  }

  const algorithm = `aes-${masterKey.length * 8}-ecb`;
  try {
    const decipher = createDecipheriv(algorithm, masterKey, null);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedTicketKey, 'hex')),
      decipher.final(),
    ]);
    const text = decrypted.toString('utf8').trim();
    const ticketKey = /^[0-9a-fA-F]{32}$/.test(text)
      ? Buffer.from(text, 'hex')
      : decrypted;
    if (ticketKey.length !== 16)
      throw new Error('Unexpected ticket key length');
    return ticketKey;
  } catch {
    throw new ServiceUnavailableException(
      'Could not decrypt the Tuya password ticket',
    );
  }
}

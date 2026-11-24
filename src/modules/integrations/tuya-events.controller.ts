import {
  Body,
  Controller,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { TuyaEventDto } from './dto/tuya-event.dto';
import { TuyaEventsService } from './tuya-events.service';

@ApiTags('Integrations')
@Controller('integrations/tuya')
export class TuyaEventsController {
  constructor(private readonly tuyaEventsService: TuyaEventsService) {}

  @Post('events')
  @ApiOperation({
    summary: 'Receive normalized Tuya lock events from the MQ consumer',
  })
  ingest(
    @Body() dto: TuyaEventDto,
    @Headers('x-vms-integration-key') providedKey?: string,
  ) {
    const expectedKey = process.env.TUYA_INGESTION_KEY;
    if (!expectedKey) {
      throw new ServiceUnavailableException(
        'TUYA_INGESTION_KEY is not configured',
      );
    }
    if (!providedKey || !safeEqual(expectedKey, providedKey)) {
      throw new UnauthorizedException('Invalid Tuya integration key');
    }
    return this.tuyaEventsService.ingest(dto);
  }
}

function safeEqual(expected: string, provided: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({ format: 'uuid', description: 'Door the smart lock is installed on' })
  @IsUUID()
  door_id: string;

  @ApiProperty({ example: 'tuya-device-id' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  tuya_device_id: string;

  @ApiProperty({ enum: [6, 7], default: 7 })
  @IsIn([6, 7])
  pin_length = 7;
}

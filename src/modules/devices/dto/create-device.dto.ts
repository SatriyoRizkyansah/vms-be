import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDeviceDto {
  @ApiProperty({ example: 'Ruangan Telematika' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  room_name: string;

  @ApiProperty({ example: 'tuya-device-id' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  tuya_device_id: string;

  @ApiProperty({ enum: [6, 7], default: 7 })
  @IsIn([6, 7])
  pin_length = 7;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'pic.telematika' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  username: string;

  @ApiProperty({ example: 'YourStrongPassword' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

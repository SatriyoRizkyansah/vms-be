import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard, CurrentUser } from '../../common/auth';
import type { AuthenticatedUser } from '../../common/auth';
import { AuthService } from './auth.service';
import { BootstrapAdminDto } from './dto/bootstrap-admin.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with an internal VMS account' })
  @ApiOkResponse({ description: 'Bearer access token and account profile' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current internal VMS account profile' })
  @ApiOkResponse({
    description: 'Current account profile without password data',
  })
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('bootstrap')
  @ApiOperation({ summary: 'Create the first admin account' })
  @ApiCreatedResponse({ description: 'Initial admin account and access token' })
  bootstrap(
    @Body() dto: BootstrapAdminDto,
    @Headers('x-bootstrap-key') bootstrapKey?: string,
  ) {
    return this.authService.bootstrapAdmin(dto, bootstrapKey);
  }
}

import { Body, Controller, Get, HttpCode, Param, Post, Render, Req } from '@nestjs/common';
import { Request } from 'express';
import { getBaseUrl } from '../seo/seo';
import { AddMemberDto, ChangeRoleDto } from './dto/team.dto';
import { TeamService } from './team.service';

const mailInfo = (req: Request) => ({
  baseUrl: getBaseUrl(req),
  locale: req.locale === 'en' ? ('en' as const) : ('ar' as const),
});

/** Owners manage who can sign in. Cashier and kitchen accounts never reach this: see AdminRoleMiddleware. */
@Controller('admin/team')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  private restaurantOf = (req: Request): string => req.session.restaurantId as string;

  @Get()
  @Render('admin/team')
  async index(@Req() req: Request) {
    return {
      section: 'team',
      me: req.session.adminUserId,
      ...(await this.team.overview(this.restaurantOf(req))),
    };
  }

  @Post()
  @HttpCode(200)
  @Render('admin/partials/team-panel')
  async add(@Body() body: AddMemberDto, @Req() req: Request) {
    const restaurantId = this.restaurantOf(req);
    const secret = await this.team.add(restaurantId, body, mailInfo(req));
    return { secret, ...(await this.team.overview(restaurantId)), me: req.session.adminUserId };
  }

  @Post(':id/role')
  @HttpCode(200)
  @Render('admin/partials/team-panel')
  async role(@Param('id') id: string, @Body() body: ChangeRoleDto, @Req() req: Request) {
    const restaurantId = this.restaurantOf(req);
    await this.team.setRole(restaurantId, id, body.role, req.session.adminUserId as string);
    return { ...(await this.team.overview(restaurantId)), me: req.session.adminUserId };
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @Render('admin/partials/team-panel')
  async reset(@Param('id') id: string, @Req() req: Request) {
    const restaurantId = this.restaurantOf(req);
    const secret = await this.team.resetPassword(restaurantId, id, mailInfo(req));
    return { secret, ...(await this.team.overview(restaurantId)), me: req.session.adminUserId };
  }

  @Post(':id/remove')
  @HttpCode(200)
  @Render('admin/partials/team-panel')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const restaurantId = this.restaurantOf(req);
    await this.team.remove(restaurantId, id, req.session.adminUserId as string);
    return { ...(await this.team.overview(restaurantId)), me: req.session.adminUserId };
  }
}

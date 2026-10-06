import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Plain HTML forms carry the CSRF token as a body field (htmx requests use
 * a header). The CSRF middleware has already checked it by the time a DTO
 * is built, so it is only declared here so that whitelisting does not
 * reject every form that includes it.
 */
export class BaseFormDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  csrf_token?: string;
}

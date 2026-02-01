import { IsUrl, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class StartUrlDto {
  @IsNotEmpty({ message: 'URL is required' })
  @IsUrl({ require_protocol: true }, { message: 'Please provide a valid URL (must start with http:// or https://)' })
  @Transform(({ value }) => value?.trim())
  url: string;
}

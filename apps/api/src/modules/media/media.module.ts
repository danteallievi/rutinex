import { Module } from '@nestjs/common';

import { ExercisesModule } from '../exercises/exercises.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import {
  buildR2Client,
  buildR2Config,
  R2_CLIENT,
  R2_CONFIG,
} from './r2.config';

@Module({
  imports: [ExercisesModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: R2_CLIENT,
      useFactory: () => buildR2Client(),
    },
    {
      provide: R2_CONFIG,
      useFactory: () => buildR2Config(),
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}

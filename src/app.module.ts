import { Module } from '@nestjs/common';
import { PointModule } from './point/point.module';

@Module({
  imports: [PointModule],
  controllers: [],
  providers: [],
})
export class AppModule {}

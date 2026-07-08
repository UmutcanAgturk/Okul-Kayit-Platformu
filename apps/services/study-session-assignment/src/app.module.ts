import { Module } from "@nestjs/common";
import { StudySessionModule } from "./study-session/study-session.module";

@Module({
  imports: [StudySessionModule],
})
export class AppModule {}

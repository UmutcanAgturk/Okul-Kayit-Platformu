import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { PrismaService } from "../prisma/prisma.service";
import { StudySessionService } from "./study-session.service";
import { ExamFailureListener } from "./listeners/exam-failure.listener";
import { TeacherAvailabilityService } from "./smart-matching/teacher-availability.service";

@Module({
  imports: [
    ClientsModule.register([
      {
        name: "STUDY_SESSION_EVENTS",
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: "study-session-assignment",
            brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
          },
          consumer: {
            groupId: "study-session-assignment-producer",
          },
        },
      },
    ]),
  ],
  controllers: [ExamFailureListener],
  providers: [StudySessionService, TeacherAvailabilityService, PrismaService],
})
export class StudySessionModule {}

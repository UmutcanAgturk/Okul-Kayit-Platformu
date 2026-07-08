import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: "study-session-assignment",
        brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
      },
      consumer: {
        groupId: "study-session-assignment-consumer",
      },
    },
  });

  await app.listen();
  // eslint-disable-next-line no-console
  console.log("Seviye 360 - AI Otomatik Etüt Atama Servisi dinlemede...");
}

bootstrap();

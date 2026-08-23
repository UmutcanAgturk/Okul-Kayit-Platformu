-- Taksit vadesi hatırlatma cron'u için son gönderim zamanı (idempotency).
ALTER TABLE "PaymentInstallment" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

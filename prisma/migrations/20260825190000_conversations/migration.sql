-- DropForeignKey

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "teacherUserId" TEXT NOT NULL,
    "studentId" TEXT,
    "subject" TEXT NOT NULL,
    "parentLastReadAt" TIMESTAMP(3),
    "teacherLastReadAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_tenantId_parentUserId_lastMessageAt_idx" ON "Conversation"("tenantId", "parentUserId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_tenantId_teacherUserId_lastMessageAt_idx" ON "Conversation"("tenantId", "teacherUserId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS: Conversation tenant izolasyonu (katılımcı kısıtı uygulama katmanında).
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Conversation"
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- ConversationMessage: üst kayıt (Conversation) üzerinden tenant izolasyonu.
ALTER TABLE "ConversationMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationMessage" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ConversationMessage"
  USING (
    EXISTS (
      SELECT 1 FROM "Conversation" c
      WHERE c."id" = "ConversationMessage"."conversationId"
        AND c."tenantId" = current_setting('app.tenant_id', true)
    )
  );

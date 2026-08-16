-- User.phone: global @unique yerine tenant başına benzersizlik.
-- Sebep: BRANCH_ADMIN'in veli/personel telefonu güncellerken tetiklediği
-- P2002/pre-check, önceden TÜM tenant'lar genelinde global benzersizliğe
-- dayanıyordu — bu da bir şube yöneticisinin başka bir şubenin kayıtlı
-- telefon numaralarını 409/200 yanıtından teşhis edebilmesine (cross-tenant
-- existence oracle) yol açıyordu.
DROP INDEX "User_phone_key";

CREATE UNIQUE INDEX "User_tenantId_phone_key" ON "User"("tenantId", "phone");

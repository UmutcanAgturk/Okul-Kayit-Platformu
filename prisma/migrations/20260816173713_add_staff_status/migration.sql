-- StaffProfile.status: demo'daki Aktif/İzinli/Ayrıldı üç-durumlu personel
-- durumu — önceden yalnızca User.isActive (iki durumlu: Aktif/Devre Dışı)
-- vardı.
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'RESIGNED');

ALTER TABLE "StaffProfile" ADD COLUMN "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE';

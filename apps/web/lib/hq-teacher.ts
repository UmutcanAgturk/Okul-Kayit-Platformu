import { Prisma, PrismaClient, UserRole } from "@prisma/client";

type Actor = { id: string; role: UserRole; actingTenantId?: string | null };

/**
 * Sınıflarım / Etüt Onayı / Sınıf Röntgeni gibi öğretmenin KENDİ kimliğinden
 * (TeacherProfile.userId === actor.id) türetilen self-servis route'larda,
 * Genel Merkez'in (bare SUPERADMIN) HqTeacherPicker ile seçtiği bir
 * öğretmen "gibi" görüntüleyebilmesini sağlar (bkz. components/hq/HqTeacherPicker.tsx).
 * `?asTeacherId=` yalnızca SUPERADMIN için anlamlıdır ve seçilen öğretmenin
 * o an "Bu Şube Olarak Yönet"le seçili şubeye (actor.actingTenantId) ait
 * olduğu DOĞRULANIR — aksi halde null döner (başka bir şubenin öğretmeni
 * asTeacherId ile geçirilemez).
 */
export async function resolveTeacherProfile(
  actor: Actor,
  tx: Prisma.TransactionClient | PrismaClient,
  asTeacherId: string | null,
) {
  if (actor.role === UserRole.TEACHER) {
    return tx.teacherProfile.findUnique({ where: { userId: actor.id } });
  }
  if (actor.role === UserRole.SUPERADMIN && asTeacherId) {
    const teacher = await tx.teacherProfile.findUnique({ where: { id: asTeacherId }, include: { user: true } });
    if (!teacher || teacher.user.tenantId !== actor.actingTenantId) return null;
    return teacher;
  }
  return null;
}

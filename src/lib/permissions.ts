import type { Prisma } from "@prisma/client";
import type { ProjectRole, ProjectVisibility } from "@/types/domain";

// ─── Эрхийн дүрэм — НЭГ эх сурвалж ──────────────────────────────────────────
// Хэн ямар төслийг харах, засах вэ гэдгийг зөвхөн энд тодорхойлно. API
// (requireProjectRole), жагсаалтын шүүлтүүр (visibleProjectsWhere), мэдэгдэл
// (notify) бүгд эндээс авна. Өмнө нь 4–5 газар тус тусдаа бичигдээд зөрсөн байсан
// (жишээ нь: зөвшөөрөгдөөгүй хэрэглэгч уригдсан "Компанийн бүх хүн" төслийг
// нээж чаддаг ч даалгаврууд нь "Миний даалгавар"-т харагддаггүй байв).
//
// Дүрэм:
//  • PRIVATE   — зөвхөн эзэн (админ ч биш)
//  • SHARED    — зөвхөн уригдсан гишүүд, өөрийн эрхээр; админ = эзэн
//  • PUBLIC    — бүгд үзэгч (гишүүн бол өөрийн эрхээр); админ = эзэн
//  • REFERENCE — бүгд үзэгч, эзэн нь л удирдана; админ = эзэн
//  • Админ зөвшөөрөөгүй шинэ хэрэглэгч PUBLIC/REFERENCE-ийг зөвхөн уригдсан
//    (гишүүн) бол харна
//  • Хогийн саванд байгаа төсөл — зөвхөн эзэнд (сэргээх / бүр мөсөн устгах)

export const ROLE_POWER: Record<ProjectRole, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export type PermissionUser = { id: string; role?: string | null; isApproved?: boolean | null };

export function hasRole(role: ProjectRole | null | undefined, minimum: ProjectRole) {
  return Boolean(role) && ROLE_POWER[role as ProjectRole] >= ROLE_POWER[minimum];
}

function roleByVisibility(
  visibility: ProjectVisibility,
  membershipRole: ProjectRole | null,
  approved: boolean,
): ProjectRole | null {
  if (!approved && (visibility === "PUBLIC" || visibility === "REFERENCE")) {
    if (visibility === "PUBLIC") return membershipRole;
    return membershipRole === "OWNER" ? "OWNER" : membershipRole ? "VIEWER" : null;
  }
  switch (visibility) {
    case "PUBLIC":
      return membershipRole ?? "VIEWER";
    case "REFERENCE":
      // Бүгд уншина; файлын агуулга засахыг route бүр тусад нь хориглоно
      return membershipRole === "OWNER" ? "OWNER" : "VIEWER";
    case "SHARED":
      return membershipRole;
    case "PRIVATE":
      return membershipRole === "OWNER" ? "OWNER" : null;
  }
}

// Хэрэглэгчийн тухайн төсөл дээрх бодит эрх (null = хандахгүй)
export function effectiveProjectRole(
  project: { visibility: ProjectVisibility | string; trashedAt?: Date | string | null },
  membershipRole: ProjectRole | string | null | undefined,
  user: PermissionUser,
): ProjectRole | null {
  const visibility = project.visibility as ProjectVisibility;
  const member = (membershipRole as ProjectRole | null | undefined) ?? null;
  let role: ProjectRole | null;
  if (visibility === "PRIVATE") role = member === "OWNER" ? "OWNER" : null;
  else if (user.role === "ADMIN") role = "OWNER";
  else role = roleByVisibility(visibility, member, user.isApproved !== false);
  if (role && project.trashedAt && role !== "OWNER") return null;
  return role;
}

// effectiveProjectRole(...) !== null байх төслүүдийн Prisma шүүлтүүр.
// activeOnly — хогийн савныхыг огт оруулахгүй (даалгавар, хайлт г.м.).
// Тест: эрхийн бүх хослол дээр энэ шүүлтүүр болон effectiveProjectRole
// яг ижил төслүүдийг сонгодог эсэхийг шалгадаг.
export function visibleProjectsWhere(
  user: PermissionUser,
  { activeOnly = false }: { activeOnly?: boolean } = {},
): Prisma.ProjectWhereInput {
  const ownerOfPrivate: Prisma.ProjectWhereInput = {
    visibility: "PRIVATE",
    members: { some: { userId: user.id, role: "OWNER" } },
  };
  const active: Prisma.ProjectWhereInput = activeOnly ? { trashedAt: null } : {};

  if (user.role === "ADMIN") {
    return { ...active, OR: [ownerOfPrivate, { visibility: { not: "PRIVATE" } }] };
  }

  const approved = user.isApproved !== false;
  return {
    ...active,
    OR: [
      ownerOfPrivate,
      // Гишүүн (SHARED, мөн зөвшөөрөгдөөгүй хүний уригдсан PUBLIC/REFERENCE) —
      // хогийн саванд орсон бол зөвхөн эзэнд
      { visibility: { not: "PRIVATE" }, trashedAt: null, members: { some: { userId: user.id } } },
      { visibility: { not: "PRIVATE" }, members: { some: { userId: user.id, role: "OWNER" } } },
      ...(approved
        ? [{ visibility: { in: ["PUBLIC", "REFERENCE"] }, trashedAt: null } as Prisma.ProjectWhereInput]
        : []),
    ],
  };
}

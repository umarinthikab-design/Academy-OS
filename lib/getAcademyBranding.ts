// Public academy branding for pages that render before a session exists (login)
// or where branding is needed app-wide (sidebar, mobile nav, dashboard, metadata).
//
// Deliberately selects ONLY the safe display fields - the operational
// AcademySettings config (confirmation windows, permission toggles) is never
// exposed through this helper.
import { prisma } from "./prisma";

export async function getAcademyBranding() {
  const settings = await prisma.academySettings.findFirst({
    select: { academyName: true, logoUrl: true },
  });
  return {
    academyName: settings?.academyName ?? "My Academy",
    logoUrl: settings?.logoUrl ?? null,
  };
}

export type AcademyBranding = Awaited<ReturnType<typeof getAcademyBranding>>;
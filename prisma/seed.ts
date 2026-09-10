import { PrismaClient, Designation } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Default academy structure: Little League is the young/foundation groups
// (U4, U6), Junior Varsity the competitive ones (U8-U16). Even-numbered per
// the club's age-band split.
const AGE_GROUPS: { name: string; categoryName: string }[] = [
  { name: "U4", categoryName: "Little League" },
  { name: "U6", categoryName: "Little League" },
  { name: "U8", categoryName: "Junior Varsity" },
  { name: "U10", categoryName: "Junior Varsity" },
  { name: "U12", categoryName: "Junior Varsity" },
  { name: "U14", categoryName: "Junior Varsity" },
  { name: "U16", categoryName: "Junior Varsity" },
];
const SEED_PASSWORD = "touchline123"; // change this after first login

async function main() {
  console.log("Seeding age group categories...");
  const categoryNames = [...new Set(AGE_GROUPS.map((g) => g.categoryName))];
  const categoryIdByName: Record<string, string> = {};
  for (let i = 0; i < categoryNames.length; i++) {
    const c = await prisma.ageGroupCategoryOption.upsert({
      where: { name: categoryNames[i] },
      update: {},
      create: { name: categoryNames[i], sortOrder: i },
    });
    categoryIdByName[c.name] = c.id;
  }

  console.log("Seeding age groups...");
  const ageGroups: Record<string, string> = {};
  for (let i = 0; i < AGE_GROUPS.length; i++) {
    const categoryId = categoryIdByName[AGE_GROUPS[i].categoryName];
    const ag = await prisma.ageGroup.upsert({
      where: { name: AGE_GROUPS[i].name },
      update: { categoryId },
      create: { name: AGE_GROUPS[i].name, categoryId, sortOrder: i },
    });
    ageGroups[ag.name] = ag.id;
  }

  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);

  console.log("Seeding a starter admin + head coach account...");
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@touchline.local" },
    update: { name: "Umar Inthikab" },
    create: {
      email: "admin@touchline.local",
      password: hashedPassword,
      name: "Umar Inthikab",
      role: "ADMIN",
    },
  });

  const headUser = await prisma.user.upsert({
    where: { email: "umar@touchline.local" },
    update: {},
    create: {
      email: "umar@touchline.local",
      password: hashedPassword,
      name: "Umar",
      role: "HEAD_COACH",
      coach: {
        create: {
          designation: Designation.HEAD,
          canApproveRequests: true,
          primaryFocus: {
            connect: [{ id: ageGroups["U10"] }, { id: ageGroups["U12"] }],
          },
        },
      },
    },
  });

  console.log("Seeding a sample location...");
  await prisma.location.upsert({
    where: { name: "CR7, Colombo 03" },
    update: {},
    create: { name: "CR7, Colombo 03" },
  });

  console.log("Done.");
  console.log({ adminUser: adminUser.email, headUser: headUser.email, seedPassword: SEED_PASSWORD });
  console.log("Note: if these accounts already existed from before auth was added, this upsert did NOT overwrite their password.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

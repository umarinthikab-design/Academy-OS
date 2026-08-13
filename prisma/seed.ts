import { PrismaClient, Designation } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const AGE_GROUPS = ["U7", "U9", "U11", "U13", "U15"];
const SEED_PASSWORD = "touchline123"; // change this after first login

async function main() {
  console.log("Seeding age groups...");
  const ageGroups: Record<string, string> = {};
  for (let i = 0; i < AGE_GROUPS.length; i++) {
    const ag = await prisma.ageGroup.upsert({
      where: { name: AGE_GROUPS[i] },
      update: {},
      create: { name: AGE_GROUPS[i], sortOrder: i },
    });
    ageGroups[ag.name] = ag.id;
  }

  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);

  console.log("Seeding a starter admin + head coach account...");
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@touchline.local" },
    update: {},
    create: {
      email: "admin@touchline.local",
      password: hashedPassword,
      name: "Admin",
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
            connect: [{ id: ageGroups["U9"] }, { id: ageGroups["U11"] }],
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
  console.log("Note: if these accounts already existed from before auth was added, this upsert did NOT overwrite their password - use 'npm run set-password' instead.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

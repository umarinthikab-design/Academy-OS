// Run this from your terminal, never expose it as a web page:
//   npm run set-password -- someone@email.com theirnewpassword
//
// This exists to fix accounts created before real login existed
// (admin@touchline.local, umar@touchline.local, and any test coaches),
// whose password field currently holds the placeholder "CHANGE_ME"
// instead of a real hash.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [, , email, password] = process.argv;

  if (!email || !password) {
    console.error("Usage: npm run set-password -- someone@email.com newpassword");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.update({
      where: { email },
      data: { password: hash },
    });
    console.log(`Password updated for ${user.email} (${user.role}).`);
  } catch {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

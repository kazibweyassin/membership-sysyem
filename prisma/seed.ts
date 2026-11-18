import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Membership categories (spec 3.1). Fees are placeholders - edit them in
  // Settings > Categories to match the FITSPA fee schedule.
  const categories = await Promise.all(
    [
      { name: "Bronze", fee: 0, description: "Entry level membership" },
      { name: "Silver", fee: 0, description: "Standard membership" },
      { name: "Gold", fee: 0, description: "Premium membership" },
      { name: "Platinum", fee: 0, description: "Top tier membership" },
    ].map((c) =>
      prisma.membershipCategory.upsert({
        where: { name: c.name },
        update: {},
        create: c,
      })
    )
  );

  console.log("Categories:", categories.map((c) => c.name).join(", "));

  // Bootstrap administrator
  const email = process.env.SEED_ADMIN_EMAIL || "admin@fitspa.ug";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      email: email.toLowerCase(),
      name: "System Administrator",
      passwordHash,
      role: Role.ADMINISTRATOR,
    },
  });

  // System settings (spec 7.1, 8.3)
  const settings = [
    {
      key: "membership_period_months",
      value: "12",
      description: "Membership validity in months after a confirmed payment",
    },
    {
      key: "renewal_alert_days",
      value: "30,14,7,0",
      description: "Comma-separated days before expiry to raise renewal alerts",
    },
    {
      key: "automated_reminders_enabled",
      value: "false",
      description: "Set to true to let the scheduler dispatch reminder emails",
    },
    {
      key: "org_timezone",
      value: process.env.ORG_TIMEZONE || "Africa/Kampala",
      description: "Organisation timezone used for all date handling",
    },
    {
      key: "org_currency",
      value: process.env.ORG_CURRENCY || "UGX",
      description: "Currency used for invoices and payments",
    },
    {
      key: "org_address",
      value: "1st Floor, Wildlife Tower, Plot 31 Kanjokya St, P. O. Box 111834, Kampala",
      description: "Organisation postal address",
    },
    {
      key: "org_email",
      value: "info@fitspa.ug",
      description: "Organisation contact email",
    },
    {
      key: "org_phone",
      value: "+256 393 225 818",
      description: "Organisation contact phone",
    },
    {
      key: "invoice_prefix",
      value: "INV",
      description: "Prefix used for generated invoice numbers",
    },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  console.log("Settings seeded");
  console.log(`\nAdministrator login:`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`\nChange this password immediately after first login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

/**
 * Idempotent. Safe to run on every deploy: categories and settings are
 * upserted, and the administrator is only created when none exists.
 *
 * When SEED_ADMIN_PASSWORD is unset and an admin must be created, a random
 * password is generated and printed once to the build log.
 */

async function main() {
  // Membership categories (spec 3.1). Fees are placeholders - edit them in
  // Settings > Categories to match the FITSPA fee schedule.
  const categories = await Promise.all(
    [
      { name: "Bronze", fee: 0, description: "Entry level membership" },
      { name: "Silver", fee: 0, description: "Standard membership" },
      { name: "Gold", fee: 0, description: "Premium membership" },
      { name: "Platinum", fee: 0, description: "Top tier membership" },
      { name: "Associate Member", fee: 0, description: "Associate membership category" },
    ].map((c) =>
      prisma.membershipCategory.upsert({
        where: { name: c.name },
        update: {},
        create: c,
      })
    )
  );

  console.log("Categories:", categories.map((c) => c.name).join(", "));

  const email = (
    process.env.SEED_ADMIN_EMAIL || "admin@fitspa.ug"
  ).toLowerCase();

  // Bootstrap administrator.
  //
  // Three cases, in priority order:
  //   1. SEED_ADMIN_PASSWORD is set  -> that password is applied to the
  //      configured admin email, creating the user if absent. This is the
  //      recovery path when a generated password has been lost.
  //   2. No administrator exists     -> create one with a random password and
  //      print it once.
  //   3. An administrator exists     -> leave credentials untouched, so a
  //      redeploy never silently resets someone's password.
  const explicitPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || null;

  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMINISTRATOR },
    select: { id: true },
  });

  let generatedPassword: string | null = null;
  let appliedPassword = false;

  if (explicitPassword) {
    const passwordHash = await bcrypt.hash(explicitPassword, 10);

    await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: {
        email,
        name: "System Administrator",
        passwordHash,
        role: Role.ADMINISTRATOR,
      },
    });

    appliedPassword = true;
  } else if (!existingAdmin) {
    generatedPassword = randomBytes(12).toString("base64url").slice(0, 16);

    const passwordHash = await bcrypt.hash(generatedPassword, 10);

    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: "System Administrator",
        passwordHash,
        role: Role.ADMINISTRATOR,
      },
    });
  }

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

  if (appliedPassword) {
    console.log(`Administrator password set from SEED_ADMIN_PASSWORD`);
    console.log(`  Email: ${email}`);
  } else if (generatedPassword) {
    console.log(`\nAdministrator created:`);
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${generatedPassword}`);
    console.log(
      `\nStore this password, then change it after first login.\n` +
        `It is only printed here, at creation time.`
    );
  } else {
    console.log("Administrator already present, left unchanged");
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
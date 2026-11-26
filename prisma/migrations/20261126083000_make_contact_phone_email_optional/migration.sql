-- Make contact phone and email optional
-- Members can register contact persons without an email address, a phone
-- number, or both (changes.md: contact details are not mandatory).

-- AlterTable
ALTER TABLE "MemberContact" ALTER COLUMN "phone" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MemberContact" ALTER COLUMN "email" DROP NOT NULL;

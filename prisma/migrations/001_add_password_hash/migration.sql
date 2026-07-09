-- Add password hash column for local credentials
ALTER TABLE "User"
ADD COLUMN "passwordHash" TEXT;

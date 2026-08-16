-- Temporary seed of the admin account into any environment that lacks it
-- (e.g. the production DB, which only has demo.* accounts). Ensures the
-- temporary dev account-switcher can log in as admin everywhere. REMOVE
-- TOGETHER WITH components/DevAccountSwitcher.tsx before the real-user pilot.

INSERT INTO "User" ("id", "email", "password", "name", "role", "createdAt", "theme")
SELECT 'cm0devadmin0000000000000001', 'admin@touchline.local', '$2a$10$F9vvF3ASrXxVD2pHg05h6Orr2uTX5jQHC9JWW/v8Y2tr78eevfJEu', 'Umar Inthikab', 'ADMIN', NOW(), 'light'
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = 'admin@touchline.local');
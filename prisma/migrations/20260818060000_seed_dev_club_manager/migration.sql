-- Temporary seed of a Club Manager account into any environment that lacks
-- it, so the temporary dev account-switcher can log in as a club manager
-- everywhere. REMOVE TOGETHER WITH components/DevAccountSwitcher.tsx before
-- the real-user pilot.
--
-- Password is 'touchline123' (bcrypt hash).

INSERT INTO "User" ("id", "email", "password", "name", "role", "createdAt", "theme")
SELECT 'cm0devcm0000000000000000001', 'cm@touchline.local', '$2a$10$F9vvF3ASrXxVD2pHg05h6Orr2uTX5jQHC9JWW/v8Y2tr78eevfJEu', 'Demo Club Manager', 'CLUB_MANAGER', NOW(), 'light'
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "email" = 'cm@touchline.local');
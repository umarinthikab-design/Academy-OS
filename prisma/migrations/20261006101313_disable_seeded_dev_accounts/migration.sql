-- Disable previously seeded dev accounts whose passwords are the known
-- public hash (touchline123). These accounts are not deleted (activity
-- logs may reference them) but are rendered unable to log in.
--
-- Changes applied only where password matches the known hash exactly;
-- if the password was already changed, this migration leaves it untouched.
UPDATE "User"
SET
  password = '!disabled',
  archivedAt = NOW(),
  "sessionVersion" = "sessionVersion" + 1
WHERE email IN ('admin@touchline.local', 'cm@touchline.local')
  AND password = '$2a$10$F9vvF3ASrXxVD2pHg05h6Orr2uTX5jQHC9JWW/v8Y2tr78eevfJEu';
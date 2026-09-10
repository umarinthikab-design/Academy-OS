-- CreateTable
CREATE TABLE "SkillDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "band" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SkillDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SkillDefinition_name_band_key" ON "SkillDefinition"("name", "band");

-- Seed the skill dimensions previously hardcoded in lib/skills.ts's
-- SKILL_BANDS, preserving each band's exact current list (including
-- "First Touch" and "Shooting", which intentionally appear in two bands).
INSERT INTO "SkillDefinition" ("id", "name", "band", "sortOrder") VALUES
    ('skd_foundation_movement', 'Movement & Agility', 'Foundation', 0),
    ('skd_foundation_ball', 'Ball Comfort', 'Foundation', 1),
    ('skd_foundation_focus', 'Focus & Energy', 'Foundation', 2),
    ('skd_foundation_social', 'Social Sharing', 'Foundation', 3),
    ('skd_acquisition_dribbling', 'Dribbling & 1v1', 'Skill Acquisition', 0),
    ('skd_acquisition_touch', 'First Touch', 'Skill Acquisition', 1),
    ('skd_acquisition_passing', 'Short Passing', 'Skill Acquisition', 2),
    ('skd_acquisition_shooting', 'Shooting', 'Skill Acquisition', 3),
    ('skd_acquisition_coach', 'Coachability', 'Skill Acquisition', 4),
    ('skd_youth_touch', 'First Touch', 'Youth Development', 0),
    ('skd_youth_passing', 'Passing Range', 'Youth Development', 1),
    ('skd_youth_decision', 'Decision Making', 'Youth Development', 2),
    ('skd_youth_tactical', 'Tactical Awareness', 'Youth Development', 3),
    ('skd_youth_stamina', 'Physical Stamina', 'Youth Development', 4),
    ('skd_youth_defending', 'Defending', 'Youth Development', 5),
    ('skd_youth_shooting', 'Shooting', 'Youth Development', 6);

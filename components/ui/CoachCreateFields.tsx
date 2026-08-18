"use client";

// "Add a coach" form fields, extracted so the coach-only inputs (gender,
// primary focus) can be hidden when "Club Manager" is selected - club
// managers are staff accounts with no Coach record. The parent page renders
// this inside the server-action form.

import { useState } from "react";
import { inputBase } from "@/components/ui/Form";

type Designation = "HEAD" | "ASSISTANT" | "CLUB_MANAGER";

export function CoachCreateFields({ ageGroups }: { ageGroups: { id: string; name: string }[] }) {
  const [designation, setDesignation] = useState<Designation>("HEAD");
  const isCoach = designation !== "CLUB_MANAGER";

  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text)" };

  return (
    <div className="form-grid-2col" style={{ gap: 12 }}>
      <div>
        <label style={fieldLabel}>Name</label>
        <input name="name" required style={inputBase} />
      </div>
      <div>
        <label style={fieldLabel}>Email (this is what they'll log in with)</label>
        <input name="email" type="email" required style={inputBase} />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={fieldLabel}>Temporary password</label>
        <input name="password" type="text" required placeholder="Share this with them - they must change it on first login" style={inputBase} />
      </div>
      <div>
        <label style={fieldLabel}>Role</label>
        <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
          <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <input type="radio" name="designation" value="HEAD" checked={designation === "HEAD"} onChange={() => setDesignation("HEAD")} /> Head Coach
          </label>
          <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <input type="radio" name="designation" value="ASSISTANT" checked={designation === "ASSISTANT"} onChange={() => setDesignation("ASSISTANT")} /> Assistant Coach
          </label>
          <label style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <input type="radio" name="designation" value="CLUB_MANAGER" checked={designation === "CLUB_MANAGER"} onChange={() => setDesignation("CLUB_MANAGER")} /> Club Manager
          </label>
        </div>
        {!isCoach && (
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 6 }}>
            Club managers run the club (staff, schedule, settings) but aren&apos;t assigned to batches.
          </div>
        )}
      </div>
      {isCoach ? (
        <>
          <div>
            <label style={fieldLabel}>Gender</label>
            <select name="gender" required defaultValue="" style={inputBase}>
              <option value="" disabled>Select gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={fieldLabel}>Primary focus</label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
              {ageGroups.map((ag) => (
                <label key={ag.id} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <input type="checkbox" name="primaryFocus" value={ag.id} /> {ag.name}
                </label>
              ))}
              {ageGroups.length === 0 && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>No age groups seeded yet.</span>}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
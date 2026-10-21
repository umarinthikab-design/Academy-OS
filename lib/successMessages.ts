// Success text arrives in the URL (?success=...), so anyone can craft a link
// that shows any message on our pages. Only messages the app itself produces
// are displayed; anything else falls back to a neutral "Done.".
// When you add a new success message in a server action, add it here too.

const KNOWN: ReadonlySet<string> = new Set([
  "Session cancelled.",
  "Session reinstated.",
  "Closure day applied.",
  "Club settings updated.",
  "Category renamed.",
  "Category removed.",
  "Age group removed.",
  "Attendance recorded.",
  "Attendance proposal updated.",
  "Attendance proposal submitted for approval.",
  "Attendance approved.",
  "Attendance proposal rejected \u2014 the assistant can resubmit.",
  "Attendance finalized for this session.",
  "Checked in.",
  "Coach attendance updated.",
  "Advance attendance saved.",
  "Batch removed.",
  "Coach removed.",
  "Coach archived.",
  "Coach reactivated.",
  "Staff member archived.",
  "Staff member reactivated.",
  "Active sessions revoked \u2014 this coach must log in again.",
  "Coach promoted to head coach.",
  "You now have a coach profile and can create session plans.",
  "Drill updated.",
  "Feedback added.",
  "Drill approved and added to the library.",
  "Drill rejected.",
  "Drill archived.",
  "Drill restored to the library.",
  "Drill deleted permanently.",
  "Location removed.",
  "Registration rejected.",
  "Session scheduled.",
  "Session removed.",
  "Session updated.",
  "Session plan attached.",
  "Session plan removed.",
  "Session plan shared with the team.",
  "Share request sent for approval.",
  "Share request rejected - the plan stays private.",
  "Profile updated.",
  "Password changed. Other devices signed out.",
  "Note added.",
  "Player details updated.",
  "Player removed.",
  "Skill renamed.",
  "Skill removed.",
  "Player photo saved.",
  "Age group updated. Batch memberships are unchanged.",
  "Request approved.",
  "Request rejected.",
  "Feedback sent.",
]);

// Messages that include a name or a number.
const PATTERNS: RegExp[] = [
  /^.{1,80} added\.$/,
  /^.{1,80} category added\.$/,
  /^.{1,80} created\.$/,
  /^.{1,80} added to .{1,60}\.$/,
  /^.{1,80} published to the library\.$/,
  /^.{1,80} submitted for approval\.$/,
  /^Moved \d{1,4} players? to .{1,80}\.$/,
  /^\d{1,2} weekly sessions scheduled\.$/,
  /^Password reset for .{1,120} \u2014 see the temporary password below \(must change on next login\)\.$/,
  /^Password set\. Welcome to .{1,80}\.$/,
  /^You're confirmed for this session( \(after the response deadline\))?\.$/,
  /^You declined( \(after the response deadline\))? - the club has been notified\.$/,
];

export function isKnownSuccess(text: string): boolean {
  if (text.length > 200) return false;
  return KNOWN.has(text) || PATTERNS.some((re) => re.test(text));
}
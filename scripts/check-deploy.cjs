const https = require("https");
function api(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host: "api.github.com", path, method: "GET", headers: { "User-Agent": "touchline", Authorization: `Bearer ${token}` } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.end();
  });
}
async function main() {
  const { execSync } = require("child_process");
  const cred = execSync("git credential fill", { input: "protocol=https\nhost=github.com\n\n", encoding: "utf8" });
  const token = (cred.match(/^password=(.*)$/m) || [])[1];
  const sha = "e13bcb48c1bff57880364c4c0487b0b7bbec6d33";
  const r = await api(`/repos/umarinthikab-design/touchline-app/commits/${sha}/check-runs`, token);
  console.log("check-runs:", r.status);
  const j = JSON.parse(r.body);
  for (const cr of j.check_runs || []) {
    console.log("-", cr.name, "|", cr.status, "|", cr.conclusion);
    if (cr.output && cr.output.text) console.log("  text:", cr.output.text.slice(0, 2000));
    if (cr.output && cr.output.summary) console.log("  summary:", cr.output.summary.slice(0, 2000));
  }
}
main().catch((e) => console.error(e));
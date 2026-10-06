const http = require("http");
const { spawn } = require("child_process");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const YTDLP = process.env.YTDLP_PATH || "yt-dlp";

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data)
  });
  res.end(data);
}

function runYtDlp(args, res) {
  const child = spawn(YTDLP, args, { stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  let err = "";

  child.stdout.on("data", chunk => { out += chunk.toString(); });
  child.stderr.on("data", chunk => { err += chunk.toString(); });

  child.on("error", e => json(res, 500, { error: e.message }));
  child.on("close", code => {
    if (code !== 0) return json(res, 502, { error: err.trim() || "yt-dlp failed" });
    try {
      json(res, 200, JSON.parse(out));
    } catch {
      json(res, 200, { result: out.trim() });
    }
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");

  if (u.pathname === "/health") {
    return json(res, 200, { ok: true, service: "music", engine: "yt-dlp" });
  }

  if (u.pathname === "/search") {
    const q = u.searchParams.get("q");
    const limit = Math.min(Math.max(Number(u.searchParams.get("limit") || 10), 1), 25);
    if (!q) return json(res, 400, { error: "Missing q" });

    return runYtDlp([
      "--dump-single-json",
      "--flat-playlist",
      "--no-warnings",
      "--skip-download",
      `ytsearch${limit}:${q}`
    ], res);
  }

  if (u.pathname === "/resolve") {
    const target = u.searchParams.get("url");
    if (!target) return json(res, 400, { error: "Missing url" });

    return runYtDlp([
      "--dump-single-json",
      "--no-warnings",
      "--skip-download",
      "--format", "bestaudio/best",
      target
    ], res);
  }

  json(res, 404, { error: "Not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🎵 Music service listening on :${PORT}`);
});

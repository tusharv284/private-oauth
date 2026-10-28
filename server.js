import "dotenv/config";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { researchApp } from "./agent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY_DIR = path.join(__dirname, "library");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function loadLibrary() {
  const files = await fs.readdir(LIBRARY_DIR);
  const guides = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const content = await fs.readFile(path.join(LIBRARY_DIR, file), "utf-8");
    guides.push(JSON.parse(content));
  }
  return guides;
}

function slugify(appName) {
  return appName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

app.get("/api/guides", async (req, res) => {
  try {
    const guides = await loadLibrary();
    res.json(guides);
  } catch (err) {
    res.status(500).json({ error: "Could not load library", detail: err.message });
  }
});

app.get("/api/guides/:slug", async (req, res) => {
  try {
    const guides = await loadLibrary();
    const guide = guides.find((g) => slugify(g.appName) === req.params.slug);
    if (!guide) return res.status(404).json({ error: "Not found" });
    res.json(guide);
  } catch (err) {
    res.status(500).json({ error: "Could not load library", detail: err.message });
  }
});

app.post("/api/generate", async (req, res) => {
  const { appName, appUrl } = req.body || {};
  const query = appUrl || appName;
  if (!query) {
    return res.status(400).json({ error: "Provide appName or appUrl in the request body" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server" });
  }

  try {
    const result = await researchApp(query);
    if (!result.ok) {
      // 422: the research ran, but produced nothing trustworthy enough to ship.
      // Partial findings go back to the caller rather than a fabricated guide.
      return res.status(422).json({ error: result.error, partial: result.partial ?? result.raw ?? null });
    }
    res.json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Research agent failed", detail: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`oauth-guide-agent listening on :${PORT}`);
});

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory Global State for Retrospective Session
let state = {
  session: null,
  evals: [],
  actionPlan: {
    lessons: [],
    actions: []
  }
};

// API Endpoints
app.get("/api/state", (req, res) => {
  res.json(state);
});

app.get("/api/session", (req, res) => {
  res.json({ value: state.session ? JSON.stringify(state.session) : null });
});

app.post("/api/session", (req, res) => {
  const { value } = req.body;
  state.session = JSON.parse(value);
  res.json({ success: true });
});

app.delete("/api/session", (req, res) => {
  state.session = null;
  state.evals = [];
  state.actionPlan = { lessons: [], actions: [] };
  res.json({ success: true });
});

app.get("/api/evals", (req, res) => {
  res.json({ value: JSON.stringify(state.evals) });
});

app.post("/api/evals", (req, res) => {
  const { value } = req.body;
  const newEvals = JSON.parse(value);
  // Replace or append
  state.evals = newEvals;
  res.json({ success: true });
});

app.get("/api/actionplan", (req, res) => {
  res.json(state.actionPlan);
});

app.post("/api/actionplan", (req, res) => {
  const { lessons, actions } = req.body;
  if (lessons) state.actionPlan.lessons = lessons;
  if (actions) state.actionPlan.actions = actions;
  res.json({ success: true });
});

// Serve static assets in production
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// Fallback to index.html for SPA routing
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`=============================================`);
  console.log(`🚀 Retrospective Server is running remotely!`);
  console.log(`👉 Local:   http://localhost:${PORT}`);
  console.log(`=============================================`);
});

export default app;

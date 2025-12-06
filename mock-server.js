const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer();

app.post("/upload-audio", upload.single("file"), (req, res) => {
  console.log("Mock: upload hit. file:", req.file && req.file.originalname);
  return res.json({
    tasks: [
      { id: "t1", description: "Buy groceries tomorrow 9am", due_date: null, priority: "high", estimated_minutes: 30 },
      { id: "t2", description: "Call Rahul next Friday 4pm", due_date: null, priority: "medium", estimated_minutes: 15 }
    ],
    transcript: "Buy groceries tomorrow 9am. Call Rahul next Friday 4pm.",
    raw_model_output: { mock: true }
  });
});

app.get("/status/:jobId", (req, res) => {
  return res.json({ jobId: req.params.jobId, status: "done", progress: 100, result: { tasks: [], transcript: "" }});
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Mock server listening on http://localhost:${PORT}`));

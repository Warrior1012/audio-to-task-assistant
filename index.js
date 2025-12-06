

// index.js — Whisper (local) + Gemini (reasoning) integration
require('dotenv').config();
const cors = require('cors');
if (!global.fetch) global.fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const execFile = promisify(require('child_process').execFile);
const exec = promisify(require('child_process').exec);
const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const chrono = require('chrono-node');
const schedule = require('node-schedule');
const { initDb, saveTask, listTasks } = require('./db');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// -------------------------------------------------------------
// FETCH FIX (works on ALL node versions)
// -------------------------------------------------------------
let fetchFunc = global.fetch;
if (!fetchFunc) {
  fetchFunc = (...args) =>
    import('node-fetch').then(mod => mod.default(...args));
}

// -------------------------------------------------------------
const app = express();
app.use(bodyParser.json());
app.use(cors());

app.use((req, res, next) => {
  console.log(`>>> INCOMING ${req.method} ${req.url}`);
  next();
});


const upload = multer({ dest: 'uploads/' });

// init DB
initDb();

// -------------------------------------------------------------
// ROUTE: POST /upload-audio
// -------------------------------------------------------------
// TEMP ROUTE for testing Gemini
app.post('/test-transcript', async (req, res) => {
  try {
    const { transcript } = req.body;
    if (!transcript) return res.status(400).json({ ok: false, error: 'No transcript provided' });

    console.log("TEST TRANSCRIPT:", transcript.slice(0,200));

    const tasks = await extractTasksWithGemini(transcript);
    console.log("EXTRACTED TASKS:", JSON.stringify(tasks, null, 2));

    res.json({ ok: true, tasks });
  } catch (err) {
    console.error("TEST-GEMINI ERROR:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
app.post('/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    console.log('>>> INCOMING POST /upload-audio');
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file received' });
    }

    const audioBuffer = fs.readFileSync(req.file.path);
    const base64Audio = audioBuffer.toString('base64');

    // Step 1: Transcribe audio using Gemini 2.0 Flash
   const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const transcriptResult = await model.generateContent([
      {
        inlineData: {
          mimeType: req.file.mimetype || 'audio/webm',
          data: base64Audio
        }
      },
      { 
        text: "Transcribe this audio recording word-for-word. Output ONLY the transcript text, nothing else." 
      }
    ]);

    const transcript = transcriptResult.response.text().trim();
    console.log('Transcript:', transcript);

    // Step 2: Extract tasks from transcript
    const taskResult = await model.generateContent([
      { 
        text: `Extract all tasks from this text. For each task, identify:
- description (what needs to be done)
- datetime (any date/time mentioned, in ISO format if possible, or null)

Text: "${transcript}"

Respond ONLY with a JSON array like this:
[{"description": "task text", "datetime": "2025-12-10T10:00:00" or null}]` 
      }
    ]);

    let tasks = [];
    try {
      const taskText = taskResult.response.text().trim();
      const jsonMatch = taskText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        tasks = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.error('Task parsing error:', parseErr);
      tasks = [{ description: transcript, datetime: null }];
    }

    console.log('Extracted tasks:', tasks);

    // Save tasks to database
    for (const t of tasks) {
      await saveTask(t);
    }

    res.json({ 
      ok: true, 
      transcript, 
      tasks 
    });

  } catch (err) {
    console.error('ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});
// -------------------------------------------------------------
// ROUTE: GET /tasks
// -------------------------------------------------------------
app.get('/tasks', async (req, res) => {
  const tasks = await listTasks();
  res.json({ ok: true, tasks });
});

// -------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

/* =============================================================
                      HELPERS: Whisper + Gemini
   - Primary STT: Whisper (local via WHISPER_CMD env)
   - Fallback STT: Gemini (your existing code)
   - Configure via env:
       LOCAL_WHISPER=true
       WHISPER_CMD='whisper --model tiny --task transcribe --language en --output_format txt --output_dir /tmp'
       OR any command that prints transcript to stdout when you append the audio path
       WHISPER_OUTPUT_DIR=/tmp    // optional, used if whisper writes file instead of stdout
============================================================= */

// Detect mime type from file extension
function detectMime(pathStr) {
  const ext = pathStr.split('.').pop().toLowerCase();
  if (ext === "wav") return "audio/wav";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "m4a" || ext === "aac") return "audio/m4a";
  return "application/octet-stream";
}

// -------------------- TRANSCRIPTION: TRY WHISPER THEN GEMINI --------------------------
async function transcribeWithWhisperOrGemini(audioPath) {
  // If LOCAL_WHISPER explicitly disabled, skip to Gemini transcription
  if (process.env.LOCAL_WHISPER === 'false') {
    console.log("LOCAL_WHISPER disabled, using Gemini for transcription (fallback).");
    return transcribeWithGemini(audioPath);
  }

  // If user didn't provide WHISPER_CMD, skip Whisper attempt and fallback
  const whisperCmd = process.env.WHISPER_CMD;
  const whisperOutDir = process.env.WHISPER_OUTPUT_DIR || null;

  if (!whisperCmd) {
    console.warn("WHISPER_CMD not set — skipping local whisper. Falling back to Gemini transcription.");
    return transcribeWithGemini(audioPath);
  }

  try {
    // Build command: append audio path to the provided WHISPER_CMD string
    // Example env value: WHISPER_CMD='whisper --model tiny --task transcribe --language en --output_format txt --output_dir /tmp'
    // The user should ensure their command either prints transcript to stdout or writes a .txt file to WHISPER_OUTPUT_DIR.
    const fullCmd = `${whisperCmd} "${audioPath}"`;
    console.log("Running local whisper command:", fullCmd);

    // Use exec to capture stdout/stderr (works if CLI prints transcript)
    const { stdout, stderr } = await exec(fullCmd, { maxBuffer: 10 * 1024 * 1024 });

    if (stderr) {
      // Some CLIs print progress to stderr — just log
      console.log("whisper stderr:", stderr.slice(0, 1000));
    }

    const candidate = (stdout || "").trim();
    if (candidate && candidate.length > 2) {
      console.log("Whisper returned transcript via stdout (length):", candidate.length);
      return candidate;
    }

    // If no stdout, try reading output file by convention: basename + .txt in WHISPER_OUTPUT_DIR
    if (whisperOutDir) {
      const base = path.basename(audioPath, path.extname(audioPath));
      // try a few filename conventions
      const candidates = [
        path.join(whisperOutDir, `${base}.txt`),
        path.join(whisperOutDir, `${base}.trans.txt`),
        path.join(whisperOutDir, `${base}_transcript.txt`)
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          const txt = fs.readFileSync(c, 'utf8').trim();
          if (txt.length > 0) {
            console.log("Whisper returned transcript via file:", c);
            return txt;
          }
        }
      }
    }

    // If we land here, whisper CLI didn't provide output in expected ways
    console.warn("Local whisper did not produce usable output. Falling back to Gemini transcription.");
    return transcribeWithGemini(audioPath);

  } catch (err) {
    console.error("LOCAL WHISPER ERROR:", err.message || err);
    console.warn("Falling back to Gemini transcription.");
    return transcribeWithGemini(audioPath);
  }
}

// -------------------- GEMINI TRANSCRIPTION (FALLBACK) --------------------------
async function transcribeWithGemini(audioPath) {
  try {
    // If you do not want Gemini to attempt audio transcription at all, you can change this to return an error or empty.
    const audioBytes = fs.readFileSync(audioPath).toString("base64");

    const MODEL = process.env.GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const body = {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: detectMime(audioPath), data: audioBytes } },
            { text: "Transcribe the above audio and return ONLY plaintext transcript." }
          ]
        }
      ]
    };

    const resp = await fetchFunc(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const j = await resp.json();
    console.log("RAW GEMINI RESPONSE (transcribe fallback):", JSON.stringify(j, null, 2).slice(0,4000));

    const parts = j?.candidates?.[0]?.content?.parts || [];
    const transcript = parts.map(p => p.text || "").join("").trim();

    if (!transcript) {
      console.warn("Gemini transcription response empty:", j);
      return "Could not transcribe audio.";
    }

    return transcript;

  } catch (err) {
    console.error("TRANSCRIBE ERROR (gemini fallback):", err);
    return "Could not transcribe audio.";
  }
}

// -------------------- TASK EXTRACTION (Gemini reasoning) --------------------------
async function extractTasksWithGemini(transcript) {
  try {
    const MODEL = process.env.GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const prompt = `
Extract tasks from this transcript and return ONLY a JSON array.
Each task must look like:
{
  "description": "...",
  "datetime": "ISO string or null",
  "priority": "low|medium|high" // optional
}
Transcript:
"""${transcript}"""
Return EXACT JSON array. No extra words.
    `;

    const body = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    };

    const resp = await fetchFunc(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const j = await resp.json();

    const parts = j?.candidates?.[0]?.content?.parts || [];
    const raw = parts.map(p => p.text || "").join("");

    try {
      const parsed = JSON.parse(raw);
      return parsed.map(t => ({
        description: t.description || "",
        datetime: t.datetime || null,
        priority: t.priority || "medium",
        created_at: new Date().toISOString(),
        status: "pending"
      }));
    } catch (err) {
      console.warn("Gemini didn't give clean JSON. Falling back parser. RAW:", raw.slice(0,1000));
      return fallbackExtractTasks(transcript);
    }

  } catch (err) {
    console.error("TASK EXTRACTION ERROR:", err);
    return fallbackExtractTasks(transcript);
  }
}

// -------------------- FALLBACK PARSER --------------------------
function fallbackExtractTasks(text) {
  const parts = text.split(/(?:and|also|,|;|\n)/i);
  const tasks = [];

  for (let part of parts) {
    part = part.trim();
    if (!part) continue;

    part = part.replace(/^(remind me to|remember to|please remind me to|please)\s*/i, "").trim();

    const parsed = chrono.parseDate(part);
    const datetime = parsed ? parsed.toISOString() : null;

    if (part.length > 2) {
      tasks.push({
        description: part,
        datetime,
        created_at: new Date().toISOString(),
        status: "pending"
      });
    }
  }
  return tasks;
}

// -------------------- REMINDER SCHEDULER ------------------------
function scheduleReminder(id, task) {
  if (!task.datetime) return;

  const date = new Date(task.datetime);
  if (date <= new Date()) return;

  schedule.scheduleJob(date, () => {
    console.log(`Reminder for task ${id}: ${task.description}`);
  });
}

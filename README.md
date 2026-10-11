# Audio-to-Task Assistant

A Node.js prototype that accepts a voice recording, uses Google's Gemini model to transcribe it and extract actionable tasks, parses date/time expressions, and stores extracted tasks in SQLite.

## Features

- Upload an audio file through `POST /upload-audio`
- Gemini-based audio transcription and structured task extraction
- Natural-language date parsing with `chrono-node`
- SQLite persistence for tasks
- Reminder scheduling with `node-schedule`
- A text-only test route for task extraction

**Reminder limitation:** scheduled jobs run in the Node.js process and the current callback logs a reminder to the server console. It does not yet deliver a push notification or guarantee reminders survive a server restart.

## Stack

Node.js, Express, Google Generative AI SDK (Gemini 2.5 Flash), Multer, SQLite, node-schedule, chrono-node, dotenv, and CORS.

## Requirements

- Node.js 18+
- npm
- A Gemini API key

## Setup

```bash
git clone https://github.com/Warrior1012/audio-to-task-assistant.git
cd audio-to-task-assistant
npm install
```

Create a root `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key
PORT=3000
```

Start the API:

```bash
node index.js
```

The server defaults to `http://localhost:3000`.

## API overview

### `POST /upload-audio`

Send `multipart/form-data` with the audio file in the `audio` field. The backend transcribes the recording, extracts task descriptions and optional date/time values, stores the tasks, and returns JSON.

### `POST /test-transcript`

Accepts JSON containing a `transcript` string and returns extracted tasks. This is a development/testing route; protect or disable it before public deployment.

### `GET /tasks`

Returns stored tasks.

See `index.js` for the current request and response schemas.

## Frontend

The repository's root contains backend code but no dedicated frontend build setup. Use the API directly or build/serve a separate UI that calls these endpoints.

## Security and limitations

- Keep `GEMINI_API_KEY` in local environment configuration; never commit it.
- Audio uploads should be size-limited, validated, and deleted after processing when no longer needed.
- Restrict CORS and add authentication/rate limiting before public deployment.
- Validate model output before persisting or scheduling tasks.
- The package currently has no automated test suite configured.

## License

No license is specified in this repository.
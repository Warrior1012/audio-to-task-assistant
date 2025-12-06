# 🎙️ Audio Task Assistant

> **Gemini Blitz Hackathon 2025** - Multi-Modal Task Management powered by Gemini 2.5 Flash

## 🌟 Overview

An intelligent audio-based task management system that converts voice recordings into actionable tasks with automatic datetime extraction using Google's Gemini API.

## ✨ Features

- 🎤 **Voice Input**: Record tasks naturally through speech
- 🤖 **AI Transcription**: Gemini 2.5 Flash converts audio to text
- 📅 **Smart Parsing**: Automatically extracts tasks with dates/times
- 💾 **Task Storage**: Persistent database for task management
- 🔔 **Smart Reminders**: Scheduled notifications for upcoming tasks

## 🛠️ Technical Stack

- **Backend**: Node.js, Express.js
- **AI Model**: Gemini 2.5 Flash (Google Generative AI)
- **Database**: SQLite
- **Audio Processing**: Multer (multipart/form-data)
- **Scheduling**: node-schedule
- **NLP**: chrono-node (datetime parsing fallback)

## 🚀 Setup Instructions

### Prerequisites
- Node.js v18+
- Gemini API Key ([Get it here](https://aistudio.google.com/app/apikey))

### Installation

1. **Clone the repository**
```bash
   git clone https://github.com/Warrior1012/audio-task-assistant.git
   cd audio-task-assistant
```

2. **Install dependencies**
```bash
   npm install
```

3. **Configure Environment**
   
   Create `.env` file in root:
```env
   PORT=3000
   GEMINI_API_KEY=your_actual_api_key_here
```

4. **Run the server**
```bash
   node index.js
```

   Server will start on `http://localhost:3000`

## 📡 API Endpoints

### **POST /upload-audio**
Upload audio file and extract tasks

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Field name: `audio`
- Supported formats: WebM, WAV, MP3

**Response:**
```json
{
  "ok": true,
  "transcript": "Remind me to buy groceries tomorrow at 5pm",
  "tasks": [
    {
      "description": "buy groceries",
      "datetime": "2025-12-07T17:00:00"
    }
  ]
}
```

### **GET /tasks**
Retrieve all stored tasks

## 🤖 Gemini API Integration

### Model Used
- **Primary**: `gemini-2.5-flash`
- **API Version**: `v1beta`

### Prompt Engineering Strategy

**Step 1: Audio Transcription**
```
Prompt: "Transcribe this audio recording word-for-word. 
Output ONLY the transcript text, nothing else."

Input: Audio file (base64 encoded, inline_data format)
Output: Raw transcript string
```

**Step 2: Task Extraction**
```
Prompt: "Extract all tasks from this text. For each task, identify:
- description (what needs to be done)
- datetime (ISO format or null)

Respond ONLY with JSON array."

Input: Transcript text
Output: Structured JSON with tasks
```

### Why This Approach?
- ✅ **Multi-modal**: Direct audio processing (no external STT needed)
- ✅ **Structured Output**: JSON format ensures consistent parsing
- ✅ **Two-stage pipeline**: Separation of concerns (transcription vs reasoning)
- ✅ **Fallback handling**: Graceful degradation if JSON parsing fails

## ⚠️ API Key Usage Disclaimer

**IMPORTANT SECURITY NOTICE:**

🔒 **Never commit your API key to version control!**

- The `.env` file containing your `GEMINI_API_KEY` is gitignored
- Keep your API key private and secure
- For production deployment, use environment variables or secret management services
- Monitor your API usage at: https://ai.google.dev/usage
- Free tier limits: 15 requests/minute, 1500 requests/day

**To use this project:**
1. Obtain your own Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add it to your local `.env` file
3. Never share your key publicly

## 📊 Rate Limits & Optimization

- **Current**: 2 API calls per upload (transcription + extraction)
- **Free Tier**: 15 requests/minute
- **Optimization**: Can be reduced to 1 call by combining prompts

## 🎯 Real-World Impact

### Problem Solved
People struggle to remember tasks mentioned in meetings, calls, or daily conversations. Manual note-taking is slow and error-prone.

### Solution
Our app converts natural speech into organized, time-aware tasks instantly - no typing required.

### Use Cases
- 📞 Meeting notes & action items
- 🏠 Personal reminders while multitasking
- 👨‍💼 Professional task capture on-the-go
- ♿ Accessibility for users who prefer voice input

## 🏆 Innovation Highlights

1. **Pure Gemini Solution**: No external STT APIs - fully Gemini-powered
2. **Smart Context Understanding**: Extracts not just tasks but timing context
3. **Fallback Architecture**: Robust error handling with chrono-node backup
4. **Production-Ready**: Database persistence + scheduling infrastructure

## 📁 Project Structure
```
audio-task-assistant/
├── index.js          # Main server + Gemini integration
├── db.js             # SQLite database functions
├── package.json      # Dependencies
├── .env              # Environment variables (gitignored)
├── .gitignore        # Git ignore rules
└── README.md         # This file
```

## 🔮 Future Enhancements

- [ ] Multi-language support
- [ ] Priority-based task sorting
- [ ] Calendar integration (Google Calendar API)
- [ ] Voice-based task completion
- [ ] Collaborative task lists

## 👥 Team

Tanishq Sharma (Warrior1012)  
Gemini Blitz Hackathon 2025

## 📝 License

MIT License - Built for educational purposes

---

**Built with ❤️ using Gemini 2.5 Flash**

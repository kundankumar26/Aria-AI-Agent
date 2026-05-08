# Research Assistant AI Agent

A Node.js-based research assistant that uses LLMs and web tools to answer complex research questions with real citations, structured summaries, and a transparent toolchain. It features a web UI, robust error handling, and is optimized for research workflows.

## Features

- **LLM Orchestration**: Uses OpenAI's API to drive a multi-step research loop, calling tools as needed.
- **Tool System**: Modular tools for web search (Tavily API), reading web pages, summarization, knowledge base search, and note saving.
- **Parallel Tool Calls**: All tool calls in a single LLM step are executed in parallel for speed.
- **Web UI**: Simple chat interface (HTML/CSS/JS) for interactive research sessions.
- **Structured Output**: Returns research in a consistent, detailed format with sections for overview, findings, sources, and more.
- **User Profile & Preferences**: Customizes research and output based on user expertise and preferences.
- **Error Handling**: Handles timeouts, 404s, and tool errors gracefully, reporting them to the user.
- **Logging**: Configurable logger for debugging and tracing agent/tool activity.
- **Token/Step Limits**: Prevents runaway loops and summarizes if context budget is exceeded.

## Key Files & Structure

- `index.js` — Entry point for CLI or server.
- `server.js` — Express server for the web UI API.
- `public/` — Frontend (index.html, app.js, style.css).
- `utils/agentLoop.js` — Main agent loop: LLM calls, tool orchestration, error handling, parallelization.
- `utils/logger.js` — Logging utility with multiple levels.
- `utils/embeddings.js`, `utils/vectorStore.js` — Embedding and vector search utilities.
- `tools/` — All tool definitions (searchWeb.js, readUrl.js, summarise.js, etc.).
- `prompts/systemPrompt.js` — System prompt builder, output format, and research workflow instructions.
- `user-profile.json` — User name, expertise, and research preferences.
- `research-notes/` — Stores saved research notes and knowledge base.

## How It Works

1. **User submits a research question** via the web UI or CLI.
2. **Agent builds a system prompt** using user profile, preferences, and past research context.
3. **LLM receives the prompt** and may request tool calls (search, read, summarise, etc.).
4. **All tool calls in a step run in parallel** (e.g., multiple web reads at once).
5. **Results are returned to the LLM**; the loop continues until a final answer is ready.
6. **Final answer and tool call details** are shown in the UI, including timing and outputs for transparency.

## Research Output Format
- Overview/introduction
- Key findings (with categories, data, and citations)
- Perspectives/debate (if any)
- Practical takeaways for the user
- Table of all sources
- Related topics for further research
- Style: clear, concise, data-driven, and actionable

## Customization
- **User Profile**: Edit `user-profile.json` to change name, expertise, and preferences.
- **Prompt/Output**: Edit `prompts/systemPrompt.js` to change the research workflow or output format.
- **Tools**: Add or modify tools in the `tools/` directory.
- **Vector Store**: Swap out the in-memory vector store for a production DB (e.g., Pinecone, Qdrant) for scale.

## Setup & Usage

1. `npm install` — Install dependencies.
2. Set your OpenAI API key and Tavily API key in `.env`.
3. `npm start` — Start the server and web UI.
4. Open `http://localhost:3000` in your browser.
5. Ask research questions and view structured, cited answers with tool trace.

## Advanced
- **Batching**: Embedding and search operations are batched for speed.
- **Parallelization**: All tool calls in a single LLM step are parallelized.
- **Error Reporting**: All tool errors are surfaced in the UI and logs.
- **Logging**: Set `LOG_LEVEL=debug` for detailed logs.

## Contributing
- Fork, branch, and PR as usual.
- Add new tools in `tools/` and document their usage.
- Keep prompts and output formats clear and actionable.

## License
MIT

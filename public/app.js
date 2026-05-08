const form = document.getElementById("queryForm");
const input = document.getElementById("queryInput");
const chatBox = document.getElementById("chatBox");
const sendBtn = document.getElementById("sendBtn");
const btnText = sendBtn.querySelector(".btn-text");
const btnLoader = sendBtn.querySelector(".btn-loader");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const question = input.value.trim();
    if (!question) return;

    // Add user message
    addMessage(question, "user");
    input.value = "";
    setLoading(true);

    // Add thinking indicator
    const thinkingEl = addThinking();

    try {
        const res = await fetch("/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question })
        });

        const data = await res.json();

        // Remove thinking indicator
        thinkingEl.remove();

        if (res.ok) {
            // If the response is structured (toolCalls + content)
            if (data.toolCalls && Array.isArray(data.toolCalls)) {
                data.toolCalls.forEach(tc => {
                    addToolCall(tc);
                });
                addMessage(data.content, "bot");
            } else {
                // fallback for old answer format
                addMessage(data.answer || data.content, "bot");
            }
        } else {
            addMessage("❌ " + (data.error || "Something went wrong."), "bot");
        }
    } catch (err) {
        thinkingEl.remove();
        addMessage("❌ Could not connect to the server. Make sure it's running.", "bot");
    }

    setLoading(false);
});

function addMessage(text, sender) {
    const div = document.createElement("div");
    div.classList.add("message", sender === "user" ? "user-message" : "bot-message");

    const content = document.createElement("div");
    content.classList.add("message-content");
    content.textContent = text;

    div.appendChild(content);
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function addThinking() {
    const div = document.createElement("div");
    div.classList.add("message", "bot-message");
    div.innerHTML = `
        <div class="thinking">
            🔍 Aria is researching
            <div class="dots">
                <span>.</span><span>.</span><span>.</span>
            </div>
        </div>
    `;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
}

function setLoading(isLoading) {
    sendBtn.disabled = isLoading;
    input.disabled = isLoading;
    btnText.classList.toggle("hidden", isLoading);
    btnLoader.classList.toggle("hidden", !isLoading);

    if (!isLoading) {
        input.focus();
    }
}

function addToolCall(tc) {
    const div = document.createElement("div");
    div.classList.add("message", "bot-message", "tool-call-message");
    // Add a wrapper for better text wrapping
    const wrapper = document.createElement("div");
    wrapper.style.wordBreak = "break-word";
    wrapper.style.whiteSpace = "pre-wrap";
    wrapper.classList.add("tool-call-wrapper");

    wrapper.innerHTML =
        `<strong>Tool:</strong> ${tc.name}<br>` +
        `<strong>Args:</strong> <pre style="white-space:pre-wrap;word-break:break-word;">${JSON.stringify(tc.args, null, 2)}</pre>` +
        `<strong>Duration:</strong> ${tc.durationMs} ms<br>` +
        `<strong>Output:</strong><br><pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(tc.output.slice(0, 100))}</pre>`;
    div.appendChild(wrapper);
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/[&<>"']/g, function (c) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[c];
    });
}

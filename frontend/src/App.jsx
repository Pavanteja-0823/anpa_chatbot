import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const SUGGESTIONS = [
  { icon: "🐍", title: "Write Python code", sub: "Generate scripts & snippets", prompt: "Write a Python script to parse JSON data" },
  { icon: "🧠", title: "Explain a concept", sub: "AI, science, tech, and more", prompt: "Explain how transformers work in machine learning" },
  { icon: "✍️", title: "Improve my writing", sub: "Emails, essays, content", prompt: "Improve this email: I wanted to follow up on our meeting." },
  { icon: "📚", title: "Summarize a topic", sub: "Quick knowledge breakdowns", prompt: "Summarize this topic: History of artificial intelligence" },
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [activeSessionIdx, setActiveSessionIdx] = useState(-1);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const navigate = useNavigate();

  // Get logged-in user info
  const session = JSON.parse(localStorage.getItem("anpa_session") || "{}");
  const userName = session.name || "User";
  const userInitial = userName.charAt(0).toUpperCase();

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Auto-resize textarea
  const autoResize = (el) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  // Send message to backend
  const sendMessage = async (overrideText) => {
    const text = (overrideText || input).trim();
    if (!text || isLoading) return;

    // Add user message
    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Update chat history sidebar — create session if first message
    if (activeSessionIdx === -1) {
      const truncated = text.length > 30 ? text.slice(0, 30) + "…" : text;
      setChatSessions((prev) => {
        const newSessions = [{ title: truncated, createdAt: new Date() }, ...prev];
        return newSessions;
      });
      setActiveSessionIdx(0);
    }

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Server error");
      }

      const data = await res.json();
      const botMsg = { role: "assistant", content: data.content };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      const errMsg = {
        role: "assistant",
        content: `⚠️ **Error:** ${error.message}\n\nPlease check that the backend server is running on port 5000.`,
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setMessages((prev) => [
      ...prev,
      { role: "system", content: `📎 Uploading **${file.name}**...` },
    ]);

    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: `✅ ${data.message}. You can now ask questions about the uploaded document.`,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "system", content: `❌ Upload failed: ${error.message}` },
      ]);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // New chat
  const newChat = async () => {
    setMessages([]);
    setActiveSessionIdx(-1);
    setInput("");

    try {
      await fetch(`${API_URL}/clear`, { method: "POST" });
    } catch {
      // Backend might not be running
    }
  };

  // Copy message
  const copyMessage = (content, btnId) => {
    navigator.clipboard.writeText(content).then(() => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.textContent = "✅ Copied!";
        setTimeout(() => (btn.textContent = "📋 Copy"), 1500);
      }
    });
  };

  // Handle keyboard
  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Use suggestion
  const useSuggestion = (prompt) => {
    sendMessage(prompt);
  };

  // Filter chat sessions
  const filteredSessions = searchQuery
    : chatSessions;
  
  // Handle Share
  const handleShare = (e) => {
    const btn = e.target;
    const originalText = btn.textContent;
    navigator.clipboard.writeText(window.location.href).then(() => {
      btn.textContent = "✅ Link Copied";
      btn.classList.add("success");
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove("success");
      }, 2000);
    });
  };

  // Group sessions by date
  const todaySessions = filteredSessions.filter((s) => {
    const now = new Date();
    const d = new Date(s.createdAt);
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  });
  const olderSessions = filteredSessions.filter((s) => {
    const now = new Date();
    const d = new Date(s.createdAt);
    return !(
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  });

  const showWelcome = messages.length === 0;

  // Markdown code block renderer (react-markdown v10 compatible)
  const markdownComponents = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");

      // Block code (has language class)
      if (match) {
        return (
          <>
            <div className="code-header">
              <span>{match[1]}</span>
              <button
                onClick={(e) => {
                  navigator.clipboard.writeText(codeString);
                  e.target.textContent = "✅ Copied!";
                  setTimeout(() => (e.target.textContent = "📋 Copy"), 1500);
                }}
              >
                📋 Copy
              </button>
            </div>
            <pre className={className} {...props}>
              <code>{children}</code>
            </pre>
          </>
        );
      }

      // Inline code
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <>
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">✦</div>
            <span className="logo-text">Anpa</span>
          </div>
          <button className="new-chat-btn" onClick={newChat} title="New chat">
            ＋
          </button>
        </div>

        <div className="sidebar-search">
          <input
            type="text"
            placeholder="🔍  Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="chat-list" id="chatList">
          {todaySessions.length > 0 && (
            <>
              <div className="sidebar-section-label">Today</div>
              {todaySessions.map((session, idx) => (
                <div
                  key={`today-${idx}`}
                  className={`chat-item ${activeSessionIdx === chatSessions.indexOf(session) ? "active" : ""}`}
                  onClick={() => setActiveSessionIdx(chatSessions.indexOf(session))}
                >
                  <span className="chat-item-icon">💬</span>
                  <span className="chat-item-text">{session.title}</span>
                  <div className="chat-item-actions">
                    <button title="Rename">✏️</button>
                    <button
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatSessions((prev) =>
                          prev.filter((_, i) => i !== chatSessions.indexOf(session))
                        );
                        if (activeSessionIdx === chatSessions.indexOf(session)) {
                          newChat();
                        }
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {olderSessions.length > 0 && (
            <>
              <div className="sidebar-section-label">Earlier</div>
              {olderSessions.map((session, idx) => (
                <div
                  key={`older-${idx}`}
                  className={`chat-item ${activeSessionIdx === chatSessions.indexOf(session) ? "active" : ""}`}
                  onClick={() => setActiveSessionIdx(chatSessions.indexOf(session))}
                >
                  <span className="chat-item-icon">💬</span>
                  <span className="chat-item-text">{session.title}</span>
                  <div className="chat-item-actions">
                    <button title="Rename">✏️</button>
                    <button title="Delete">🗑</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Show empty state if no chats */}
          {chatSessions.length === 0 && (
            <div style={{ padding: "20px 16px", textAlign: "center" }}>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                No conversations yet
              </p>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-profile" onClick={() => setShowUserMenu(!showUserMenu)}>
            <div className="avatar">{userInitial}</div>
            <div className="user-info">
              <div className="user-name">{userName}</div>
              <div className="user-plan">Free Plan</div>
            </div>
            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>⋯</span>
          </div>
          {showUserMenu && (
            <div className="user-menu">
              <div className="user-menu-item" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "8px", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{session.email}</span>
              </div>
              <button className="user-menu-item logout-btn" onClick={() => {
                localStorage.removeItem("anpa_session");
                navigate("/login");
              }}>
                🚪 Log out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="main">
        {/* Top Bar */}
        <div className="topbar">
          <div className="model-selector">
            <div className="model-dot"></div>
            Anpa 3.5
            <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>▾</span>
          </div>
          <div className="topbar-spacer"></div>
          <div className="topbar-actions">
            <button className="topbar-btn" onClick={handleShare}>⬆ Share</button>
            <button className="topbar-btn primary" onClick={() => setShowUpgradeModal(true)}>✦ Upgrade</button>
          </div>
        </div>

        {/* Welcome Screen or Messages */}
        {showWelcome ? (
          <div className="welcome" id="welcomeScreen">
            <div className="welcome-icon">✦</div>
            <h2>How can I help you today?</h2>
            <p>
              I&apos;m your AI assistant. Ask me anything — from code to creative
              writing, analysis to advice.
            </p>
            <div className="suggestions">
              {SUGGESTIONS.map((s, i) => (
                <div
                  key={`suggestion-${i}`}
                  className="suggestion-card"
                  onClick={() => useSuggestion(s.prompt)}
                >
                  <div className="s-icon">{s.icon}</div>
                  <div className="s-title">{s.title}</div>
                  <div className="s-sub">{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages" id="messagesArea">
            <div className="date-divider">
              <span>Today</span>
            </div>

            {/* Bot greeting */}
            <div className="message-row">
              <div className="msg-avatar bot">✦</div>
              <div className="msg-content">
                <div className="msg-sender">Anpa</div>
                <div className="msg-text">
                  Hello! I&apos;m <strong>Anpa</strong>, your intelligent
                  assistant. I can help you with coding, writing, analysis,
                  creative tasks, and much more. What would you like to explore
                  today?
                </div>
              </div>
            </div>

            {/* Messages */}
            {messages.map((msg, i) => {
              if (msg.role === "system") {
                return (
                  <div key={`msg-${i}`} className="message-row">
                    <div className="msg-avatar bot">✦</div>
                    <div className="msg-content">
                      <div className="msg-sender">System</div>
                      <div className="msg-text">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                );
              }

              if (msg.role === "user") {
                return (
                  <div key={`msg-${i}`} className="message-row">
                    <div className="msg-avatar user">A</div>
                    <div className="msg-content">
                      <div className="msg-sender">You</div>
                      <div className="msg-text user-msg">{msg.content}</div>
                      <div className="msg-actions">
                        <button
                          id={`copy-user-${i}`}
                          className="msg-action-btn"
                          onClick={() =>
                            copyMessage(msg.content, `copy-user-${i}`)
                          }
                        >
                          📋 Copy
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // Assistant message
              return (
                <div key={`msg-${i}`} className="message-row">
                  <div className="msg-avatar bot">✦</div>
                  <div className="msg-content">
                    <div className="msg-sender">Anpa</div>
                    <div
                      className={`msg-text ${msg.isError ? "error-msg" : ""}`}
                    >
                      <ReactMarkdown components={markdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    <div className="msg-actions">
                      <button
                        id={`copy-bot-${i}`}
                        className="msg-action-btn"
                        onClick={() =>
                          copyMessage(msg.content, `copy-bot-${i}`)
                        }
                      >
                        📋 Copy
                      </button>
                      <button className="msg-action-btn">👍</button>
                      <button className="msg-action-btn">👎</button>
                      <button
                        className="msg-action-btn"
                        onClick={() => {
                          const lastUser = [...messages]
                            .reverse()
                            .find((m) => m.role === "user");
                          if (lastUser) {
                            setMessages((prev) => prev.slice(0, -1));
                            sendMessage(lastUser.content);
                          }
                        }}
                      >
                        🔄 Regenerate
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="message-row">
                <div className="msg-avatar bot">✦</div>
                <div className="msg-content">
                  <div className="msg-sender">Anpa</div>
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area */}
        <div className="input-area">
          <div className={`input-wrapper ${inputFocused ? "focused" : ""}`}>
            <div className="input-tools">
              <button
                className="input-tool-btn"
                title="Attach PDF file"
                onClick={() => fileInputRef.current?.click()}
              >
                📎
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
              <button className="input-tool-btn" title="Image">
                🖼
              </button>
            </div>
            <textarea
              ref={textareaRef}
              className="input-field"
              placeholder="Message Anpa..."
              rows="1"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize(e.target);
              }}
              onKeyDown={handleKey}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />
            <button
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
            >
              ➤
            </button>
          </div>
          <div className="input-footer">
            <span>Anpa can make mistakes. Verify important information.</span>
          </div>
        </div>
      </main>

      {/* ── UPGRADE MODAL ── */}
      {showUpgradeModal && (
        <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowUpgradeModal(false)}>×</button>
            <div className="upgrade-header">
              <div className="upgrade-badge">PRO PLAN</div>
              <h2>Supercharge your workflow</h2>
              <p>Get unlimited messages, faster response times, and early access to new features.</p>
            </div>
            
            <div className="upgrade-plans">
              <div className="plan-card">
                <div className="plan-name">Free</div>
                <div className="plan-price">$0<span>/mo</span></div>
                <ul className="plan-features">
                  <li>✅ Standard response speed</li>
                  <li>✅ 50 messages per day</li>
                  <li>✅ Basic PDF analysis</li>
                </ul>
                <button className="plan-btn disabled" disabled>Current Plan</button>
              </div>
              
              <div className="plan-card featured">
                <div className="plan-name">Pro</div>
                <div className="plan-price">$20<span>/mo</span></div>
                <ul className="plan-features">
                  <li>🚀 Ultra-fast response speed</li>
                  <li>🚀 Unlimited messages</li>
                  <li>🚀 Advanced RAG & Long context</li>
                  <li>🚀 Priority Support</li>
                </ul>
                <button className="plan-btn primary">Upgrade Now</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
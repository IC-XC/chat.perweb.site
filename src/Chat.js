import { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import "./Chat.css";

// ✅ Configure your Supabase project
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || "https://YOUR-PROJECT.supabase.co",
  process.env.REACT_APP_SUPABASE_ANON_KEY || "YOUR-ANON-KEY"
);

const emojis = ["😀","😂","😍","😎","🤔","😢","😭","😡","👍","🙏","🎉","🔥","❤️"];

function Chat() {
  const [username, setUsername] = useState(localStorage.getItem("chat_username") || "");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [showEmojis, setShowEmojis] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [lastSent, setLastSent] = useState(0);
  const [recentEmojis, setRecentEmojis] = useState(JSON.parse(localStorage.getItem("recentEmojis") || "[]"));
  const [type, setType] = useState("public");
  const [recipient, setRecipient] = useState("");

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => setMessages(prev => [...prev, payload.new])
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchMessages() {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) console.error("Fetch messages error:", error);
      else setMessages(data || []);
    } catch (err) {
      console.error("Fetch messages exception:", err);
    }
  }

  function formatTime(ts) {
    const date = new Date(ts);
    return `${date.getHours().toString().padStart(2,"0")}:${date.getMinutes().toString().padStart(2,"0")}`;
  }

  async function sendMessage(e) {
    e.preventDefault();
    const now = Date.now();
    if (!username || !text) return;
    if (now - lastSent < 3000) return alert("Please wait a moment before sending another message.");

    try {
      localStorage.setItem("chat_username", username);

      const { error } = await supabase.from("messages").insert([{
        username,
        content: text,
        type,
        recipient: type === "private" ? recipient : null
      }]);

      if (error) console.error("Insert message error:", error);
      else setText("");
    } catch (err) {
      console.error("Send message exception:", err);
    }

    setShowEmojis(false);
    setLastSent(now);
  }

  function addEmoji(emoji) {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    setText(text.slice(0,start) + emoji + text.slice(end));

    const newRecent = [emoji, ...recentEmojis.filter(e => e!==emoji)].slice(0,8);
    setRecentEmojis(newRecent);
    localStorage.setItem("recentEmojis", JSON.stringify(newRecent));

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start+emoji.length, start+emoji.length);
    },0);
  }

  function resetUsername() {
    localStorage.removeItem("chat_username");
    setUsername("");
  }

  async function deleteMessage(id, msgUsername) {
    if (msgUsername !== username) return;
    try {
      const { error } = await supabase.from("messages").delete().eq("id", id);
      if (error) console.error("Delete message error:", error);
    } catch (err) {
      console.error("Delete message exception:", err);
    }
  }

  return (
    <div className={darkMode ? "chat-container dark-mode" : "chat-container light-mode"}>
      <h2 className="chat-title">Chat with me 💬</h2>


      <div className="dark-mode-toggle">
        <button onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
      </div>

      <div className="username-wrapper">
        <input
          placeholder="Name"
          value={username}
          onChange={e=>setUsername(e.target.value)}
        />
        <button onClick={resetUsername}>Reset</button>
      </div>

      <div className="type-wrapper">
        <select value={type} onChange={e=>setType(e.target.value)}>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
        {type==="private" && <input placeholder="Recipient username" value={recipient} onChange={e=>setRecipient(e.target.value)} />}
      </div>

      <div className="messages-wrapper">
        {messages.map(msg => {
          const isOwn = msg.username===username;
          const isPrivate = msg.type==="private";
          return (
            <div key={msg.id} className={`message ${isOwn ? "own" : ""} ${isPrivate ? "dm_to_per" : "public"}`}>
              <div className="username">{msg.username}</div>
              <div>{msg.content}</div>
              <div className="time">{formatTime(msg.created_at)}</div>
              {isOwn && <button className="delete-btn" onClick={()=>deleteMessage(msg.id,msg.username)}>🗑</button>}
            </div>
          );
        })}
        <div ref={messagesEndRef}/>
      </div>

      {showEmojis && (
        <div className="emoji-picker">
          {recentEmojis.length>0 && (
            <div className="recent">
              Recently used: {recentEmojis.map(e => <button key={e+"recent"} onClick={()=>addEmoji(e)}>{e}</button>)}
            </div>
          )}
          {emojis.map(e => <button key={e} onClick={()=>addEmoji(e)}>{e}</button>)}
        </div>
      )}

      <form onSubmit={sendMessage} className="message-form">
        <button type="button" onClick={() => setShowEmojis(!showEmojis)}>😊</button>
        <input ref={inputRef} placeholder="Message" value={text} onChange={e=>setText(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

export default Chat;

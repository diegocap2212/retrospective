import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// window.storage compatibility layer mapping to Express backend
window.storage = {
  get: async (key, isGlobal = false) => {
    if (isGlobal) {
      const endpoint = key === "retro:session" ? "/api/session" : "/api/evals";
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.value === null) throw new Error("Not found");
      return { value: data.value };
    } else {
      const value = localStorage.getItem(key);
      if (value === null) throw new Error("Not found");
      return { value };
    }
  },
  set: async (key, value, isGlobal = false) => {
    if (isGlobal) {
      const endpoint = key === "retro:session" ? "/api/session" : "/api/evals";
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value })
      });
    } else {
      localStorage.setItem(key, value);
    }
  },
  delete: async (key, isGlobal = false) => {
    if (isGlobal) {
      if (key === "retro:session") {
        await fetch("/api/session", { method: "DELETE" });
      }
    } else {
      localStorage.removeItem(key);
    }
  }
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

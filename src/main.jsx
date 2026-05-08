import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy
} from "firebase/firestore";

const STATE_DOC = "state/current";
const HISTORY_COL = "history";

// window.storage compatibility layer backed by Firestore
window.storage = {
  get: async (key, isGlobal = false) => {
    if (isGlobal) {
      const snap = await getDoc(doc(db, STATE_DOC));
      if (!snap.exists()) throw new Error("Not found");
      const data = snap.data();
      if (key === "retro:session") {
        if (data.session === null || data.session === undefined) throw new Error("Not found");
        return { value: JSON.stringify(data.session) };
      }
      if (key === "retro:evals") {
        return { value: JSON.stringify(data.evals || []) };
      }
      throw new Error("Unknown key: " + key);
    } else {
      const value = localStorage.getItem(key);
      if (value === null) throw new Error("Not found");
      return { value };
    }
  },

  set: async (key, value, isGlobal = false) => {
    if (isGlobal) {
      const ref = doc(db, STATE_DOC);
      const snap = await getDoc(ref);
      const current = snap.exists() ? snap.data() : { session: null, evals: [], actionPlan: { lessons: [], actions: [] } };

      if (key === "retro:session") {
        // Archive current session if it has evals
        if (current.session && (current.evals || []).length > 0) {
          const historyRef = doc(collection(db, HISTORY_COL));
          await setDoc(historyRef, {
            id: historyRef.id,
            archivedAt: Date.now(),
            session: current.session,
            evals: current.evals || [],
            actionPlan: current.actionPlan || { lessons: [], actions: [] }
          });
        }
        await setDoc(ref, {
          ...current,
          session: JSON.parse(value),
          evals: [],
          actionPlan: { lessons: [], actions: [] }
        });
      } else if (key === "retro:evals") {
        await setDoc(ref, { ...current, evals: JSON.parse(value) });
      }
    } else {
      localStorage.setItem(key, value);
    }
  },

  delete: async (key, isGlobal = false) => {
    if (isGlobal) {
      if (key === "retro:session") {
        const ref = doc(db, STATE_DOC);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const current = snap.data();
          await setDoc(ref, {
            ...current,
            session: null,
            evals: [],
            actionPlan: { lessons: [], actions: [] }
          });
        }
      }
    } else {
      localStorage.removeItem(key);
    }
  }
};

// Expose Firestore helpers for action plan and history
window.firestoreHelpers = {
  getState: async () => {
    const snap = await getDoc(doc(db, STATE_DOC));
    if (!snap.exists()) return { session: null, evals: [], actionPlan: { lessons: [], actions: [] } };
    const data = snap.data();
    return {
      session: data.session || null,
      evals: data.evals || [],
      actionPlan: data.actionPlan || { lessons: [], actions: [] }
    };
  },

  getActionPlan: async () => {
    const snap = await getDoc(doc(db, STATE_DOC));
    if (!snap.exists()) return { lessons: [], actions: [] };
    return snap.data().actionPlan || { lessons: [], actions: [] };
  },

  saveActionPlan: async (lessons, actions) => {
    const ref = doc(db, STATE_DOC);
    const snap = await getDoc(ref);
    const current = snap.exists() ? snap.data() : { session: null, evals: [], actionPlan: { lessons: [], actions: [] } };
    await setDoc(ref, { ...current, actionPlan: { lessons, actions } });
  },

  getHistory: async () => {
    const q = query(collection(db, HISTORY_COL), orderBy("archivedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        archivedAt: data.archivedAt,
        name: data.session?.name,
        participants: data.evals?.length || 0,
        created: data.session?.created
      };
    });
  },

  getHistoryEntry: async (id) => {
    const snap = await getDoc(doc(db, HISTORY_COL, id));
    if (!snap.exists()) throw new Error("Sessão não encontrada.");
    return snap.data();
  }
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

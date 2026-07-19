import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PROTOCOL_VERSION } from "@mud-wow/protocol";

function App() {
  return (
    <main>
      <h1>MUD-WoW</h1>
      <p>北郡 V1 工程基座已加载（协议版本 {PROTOCOL_VERSION}）。</p>
    </main>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

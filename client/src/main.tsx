import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Agentation } from "agentation";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Agentation />
    <App />
  </StrictMode>,
);

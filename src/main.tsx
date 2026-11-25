import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App";
import "@fontsource/vt323";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);

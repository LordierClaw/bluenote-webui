import React from "react"
import ReactDOM from "react-dom/client"
import "@fontsource/inter/latin-400.css"
import "@fontsource/inter/latin-500.css"
import "@fontsource/inter/latin-600.css"
import "@fontsource/jetbrains-mono/latin-400.css"
import "@fontsource/jetbrains-mono/latin-500.css"
import "@fontsource/jetbrains-mono/latin-700.css"
import "@fontsource/material-symbols-outlined/400.css"
import { App } from "./app/App"
import "./styles/theme.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

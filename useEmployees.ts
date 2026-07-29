@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@500;600;700;800;900&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Outfit", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}

/* Global Styles */
body {
  background-color: #f8fafc;
  color: #0f172a;
  font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  -webkit-font-smoothing: antialiased;
}

/* Modern Card Style */
.card-sleek {
  background-color: #ffffff;
  border: 1px solid rgba(226, 232, 240, 0.85);
  border-radius: 1rem;
  box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.03), 0 1px 2px -1px rgba(15, 23, 42, 0.02);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.card-sleek:hover {
  border-color: rgba(203, 213, 225, 0.9);
  box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04);
}

/* Dark Card Style */
.card-dark {
  background: linear-gradient(145deg, #0f172a 0%, #090d16 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1.25rem;
  box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.5);
}

/* Dense table styling */
.dense-table th, .dense-table td {
  padding: 0.5rem 0.75rem !important;
}

.dense-input {
  padding: 0.4rem 0.75rem !important;
  font-size: 0.75rem !important;
  border-radius: 0.625rem !important;
}

/* Liquid Wave Animation */
@keyframes wave-animation {
  0% { transform: translateX(0) translateZ(0) scaleY(1); }
  50% { transform: translateX(-25%) translateZ(0) scaleY(0.92); }
  100% { transform: translateX(-50%) translateZ(0) scaleY(1); }
}

.liquid-wave {
  animation: wave-animation 4s infinite linear;
}

/* Custom Scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 9999px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

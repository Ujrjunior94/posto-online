<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#059669" stop-opacity="0.1" />
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="512" height="512" rx="128" fill="url(#bg-grad)" />
  <!-- Outer Glow Ring -->
  <circle cx="256" cy="256" r="210" fill="none" stroke="url(#glow-grad)" stroke-width="4" stroke-dasharray="12 6" />
  
  <!-- Stylized Gas Pump & Time/Fingerprint Grid -->
  <g transform="translate(136, 126)">
    <!-- Gas pump body -->
    <rect x="40" y="40" width="120" height="200" rx="20" fill="url(#logo-grad)" />
    <!-- Screen -->
    <rect x="60" y="65" width="80" height="50" rx="8" fill="#111827" />
    <!-- Screen text (indicator) -->
    <line x1="75" y1="80" x2="125" y2="80" stroke="#10b981" stroke-width="4" stroke-linecap="round" />
    <line x1="75" y1="95" x2="110" y2="95" stroke="#10b981" stroke-width="4" stroke-linecap="round" />
    
    <!-- Nozzle hose -->
    <path d="M 160,100 C 200,100 210,180 190,210 C 180,225 170,220 170,200 L 170,110 L 180,100" fill="none" stroke="#10b981" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
    
    <!-- Fingerprint / Time detail at the center -->
    <circle cx="100" cy="180" r="22" fill="none" stroke="#ffffff" stroke-width="6" />
    <path d="M 100,165 A 15 15 0 0 1 115,180" fill="none" stroke="#34d399" stroke-width="4" stroke-linecap="round" />
    <path d="M 100,195 A 15 15 0 0 1 85,180" fill="none" stroke="#34d399" stroke-width="4" stroke-linecap="round" />
  </g>
</svg>

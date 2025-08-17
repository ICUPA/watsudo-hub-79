import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Environment validation - ensure required variables are present
function validateEnvironment() {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !import.meta.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    console.error('Please check your .env file and ensure all required variables are set.');
    
    // In development, show a helpful error message
    if (import.meta.env.DEV) {
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #fef2f2;
        color: #dc2626;
        padding: 2rem;
        font-family: system-ui, sans-serif;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
      `;
      errorDiv.innerHTML = `
        <div>
          <h1>🚨 Environment Configuration Error</h1>
          <p>Missing required environment variables:</p>
          <ul style="text-align: left; display: inline-block;">
            ${missingVars.map(v => `<li><code>${v}</code></li>`).join('')}
          </ul>
          <p>Please check your <code>.env</code> file and ensure all required variables are set.</p>
          <p>See <code>.env.example</code> for the complete list of required variables.</p>
        </div>
      `;
      document.body.appendChild(errorDiv);
      return false;
    }
    
    // In production, throw error to prevent app from starting
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  return true;
}

// Validate environment before starting the app
if (validateEnvironment()) {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

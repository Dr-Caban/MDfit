// Railway API address (no trailing slash). Locally the site talks to localhost:3000.
window.MDFIT_CONFIG = {
  apiUrl: ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:3000"
    : "https://mdfit-api-production.up.railway.app"
};

// The only thing to set before deploying: your Railway API address (no trailing slash).
window.MDFIT_CONFIG = {
  apiUrl: ["localhost", "127.0.0.1"].includes(location.hostname)
    ? "http://localhost:3000"
    : "https://YOUR-RAILWAY-APP.up.railway.app"
};

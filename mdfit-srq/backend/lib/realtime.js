"use strict";
const { Server } = require("socket.io");
const { verifyToken } = require("./auth");

function createRealtime(httpServer, cfg) {
  const io = new Server(httpServer, {
    cors: {
      origin: cfg.origins.includes("*") ? "*" : cfg.origins,
      methods: ["GET", "POST"],
      credentials: true
    },
    path: "/ws",
    transports: ["websocket", "polling"]
  });

  const adminNs = io.of("/admin");
  const memberNs = io.of("/member");

  adminNs.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try {
      const decoded = verifyToken(token, cfg.sessionSecret);
      if (!decoded?.admin) return next(new Error("Not admin"));
      socket.admin = true;
      next();
    } catch { next(new Error("Invalid token")); }
  });

  memberNs.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try {
      const decoded = verifyToken(token, cfg.sessionSecret);
      if (!decoded?.id) return next(new Error("Not a member"));
      socket.clientId = decoded.id;
      next();
    } catch { next(new Error("Invalid token")); }
  });

  adminNs.on("connection", (socket) => {
    socket.join("admin");
  });

  memberNs.on("connection", (socket) => {
    socket.join(`client:${socket.clientId}`);
  });

  function emitActivity(type, detail = {}) {
    adminNs.to("admin").emit("activity", { type, time: new Date().toISOString(), ...sanitize(detail) });
  }

  function emitToAdmin(event, data) {
    adminNs.to("admin").emit(event, data);
  }

  function emitToClient(clientId, event, data) {
    memberNs.to(`client:${clientId}`).emit(event, data);
  }

  function sanitize(obj) {
    const out = { ...obj };
    if (out.password) delete out.password;
    if (out.token) delete out.token;
    return out;
  }

  return { io, adminNs, memberNs, emitActivity, emitToAdmin, emitToClient };
}

module.exports = { createRealtime };

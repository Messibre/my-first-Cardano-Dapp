// ============================================
// Simple Express Backend for Cardano dApp
// (MERN-style: Node + Express + optional Mongo)
// ============================================
//
// PURPOSE:
// - Give you a real "fullstack" setup:
//   React (frontend) + Node/Express (backend) + MongoDB (optional).
// - The frontend (React + Mesh) still talks directly to the wallet,
//   but it will ALSO send transaction hashes to this backend,
//   so you can see how a typical MERN API works.
//
// RUNNING:
// - Start backend:  npm run server
// - Start frontend: npm run dev
// - Backend default URL: http://localhost:4000
//
// ENVIRONMENT:
// - If you want to use MongoDB, set this environment variable:
//   MONGODB_URI="your-mongodb-connection-string"
// - If you don't set MONGODB_URI, the server will still run,
//   but it will keep tx history in memory only.

// Import core modules for Express HTTP server.
const express = require("express");
const cors = require("cors");

// Import Mongoose to connect to MongoDB (for real persistence).
const mongoose = require("mongoose");

// -----------------------------
// Basic configuration values
// -----------------------------

// Port on which this backend API will listen.
const PORT = process.env.PORT || 4000;

// MongoDB connection string (optional).
// Example for local dev: "mongodb://127.0.0.1:27017/cardano_dapp"
const MONGODB_URI = process.env.MONGODB_URI || "";

// -----------------------------
// Express app setup
// -----------------------------

// Create an Express application instance.
const app = express();

// Enable CORS so that the React frontend (different port) can call this API.
app.use(
  cors({
    origin: "*", // for dev: allow all origins; for production, restrict this
  })
);

// Enable automatic JSON parsing for incoming request bodies.
app.use(express.json());

// -----------------------------
// Optional MongoDB Setup
// -----------------------------

// This flag will tell us whether MongoDB is connected or not.
let mongoConnected = false;

// If a MongoDB URI is provided, we try to connect.
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI, {
      // You can add connection options here if needed.
    })
    .then(() => {
      console.log("✅ Connected to MongoDB");
      mongoConnected = true;
    })
    .catch((err) => {
      console.error("❌ Failed to connect to MongoDB:", err.message);
      console.error("Continuing without MongoDB (in-memory storage only)...");
      mongoConnected = false;
    });
} else {
  console.log(
    "ℹ️  No MONGODB_URI provided. Running with in-memory storage only."
  );
}

// -----------------------------
// Define a Mongoose model
// -----------------------------

// If MongoDB is connected, we define a schema for transaction history.
// This describes how "transaction" documents will look in MongoDB.
const transactionSchema = new mongoose.Schema(
  {
    txHash: { type: String, required: true },
    walletAddress: { type: String, required: false },
    network: { type: String, default: "preprod" },
  },
  {
    // Timestamps add "createdAt" and "updatedAt" automatically.
    timestamps: true,
  }
);

// Only create the model if mongoose is connected; otherwise we'll keep history in memory.
const Transaction =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", transactionSchema);

// -----------------------------
// In-memory store (fallback)
// -----------------------------

// This array will store transactions if MongoDB is not connected.
// Once the server restarts, this will reset (because it's just in memory).
const inMemoryTxHistory = [];

// -----------------------------
// Routes (API endpoints)
// -----------------------------

// Health check endpoint to verify server is running.
// Example: GET http://localhost:4000/api/health
app.get("/api/health", (req, res) => {
  // We respond with basic health info for debugging.
  res.json({
    ok: true,
    message: "Cardano dApp backend is running.",
    mongoConnected,
  });
});

// GET /api/transactions
// - Returns latest transactions (either from Mongo or from memory).
app.get("/api/transactions", async (req, res) => {
  try {
    if (mongoConnected) {
      // If we have Mongo, fetch the 20 most recent transactions.
      const txs = await Transaction.find({})
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
      res.json({ ok: true, source: "mongo", items: txs });
    } else {
      // Otherwise, return the in-memory history array (slice to get most recent 20).
      const sliced = inMemoryTxHistory.slice(-20).reverse();
      res.json({ ok: true, source: "memory", items: sliced });
    }
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to fetch transaction history.",
    });
  }
});

// POST /api/transactions
// - Frontend will call this after a successful self-transfer.
// - Request body example:
//   { "txHash": "1234...", "walletAddress": "addr1...", "network": "preprod" }
app.post("/api/transactions", async (req, res) => {
  try {
    const { txHash, walletAddress, network } = req.body || {};

    // Simple validation: require at least a transaction hash.
    if (!txHash || typeof txHash !== "string" || !txHash.trim()) {
      return res.status(400).json({
        ok: false,
        message: "txHash is required and must be a non-empty string.",
      });
    }

    // Build a basic transaction object we want to store.
    const txRecord = {
      txHash: txHash.trim(),
      walletAddress: walletAddress || "",
      network: network || "preprod",
    };

    if (mongoConnected) {
      // If Mongo is connected, we insert the new document into the collection.
      const created = await Transaction.create(txRecord);
      return res.status(201).json({
        ok: true,
        source: "mongo",
        item: created,
      });
    } else {
      // Otherwise, push to the in-memory array.
      const withMeta = {
        ...txRecord,
        createdAt: new Date().toISOString(),
      };
      inMemoryTxHistory.push(withMeta);
      return res.status(201).json({
        ok: true,
        source: "memory",
        item: withMeta,
      });
    }
  } catch (err) {
    console.error("Error saving transaction:", err);
    res.status(500).json({
      ok: false,
      message: "Failed to save transaction.",
    });
  }
});

// -----------------------------
// Start the HTTP server
// -----------------------------

// Finally, we start the server and listen on the configured port.
app.listen(PORT, () => {
  console.log(`🚀 Backend API listening on http://localhost:${PORT}`);
});



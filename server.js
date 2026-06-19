import express from "express";
import mongoose from "mongoose";
import cron from "node-cron";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// =======================================================
// CONFIG
// =======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  DB: "",
  PORT: 4000,
};

// =======================================================
// DATABASE CONNECTION
// =======================================================
(async () => {
  try {
    await mongoose.connect(CONFIG.DB);
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ Failed to connect MongoDB:", err.message);
    process.exit(1);
  }
})();

// =======================================================
// MONGOOSE SCHEMAS
// =======================================================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
});

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const expenseSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true,
  },
  description: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  splitBetween: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ],
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Group = mongoose.model("Group", groupSchema);
const Expense = mongoose.model("Expense", expenseSchema);

// =======================================================
// EXPRESS APP
// =======================================================
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files like index.html

// =======================================================
// ROUTES
// =======================================================

// Serve the main HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// User Routes
app.post("/users", async (req, res, next) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    err.statusCode = 400;
    next(err);
  }
});

// Group Routes
app.post("/groups", async (req, res, next) => {
  try {
    const group = new Group(req.body);
    await group.save();
    res.status(201).json(group);
  } catch (err) {
    err.statusCode = 400;
    next(err);
  }
});

app.get("/groups", async (req, res, next) => {
  try {
    const groups = await Group.find().populate("members");
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

app.get("/groups/:id", async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id).populate("members");
    if (!group) {
        const err = new Error("Group not found");
        err.statusCode = 404;
        return next(err);
    }
    res.json(group);
  } catch (err) {
    next(err);
  }
});

app.delete("/groups/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const group = await Group.findByIdAndDelete(id);

    if (!group) {
      const err = new Error("Group not found");
      err.statusCode = 404;
      return next(err);
    }
    
    await Expense.deleteMany({ groupId: id });

    res.status(200).json({ message: "Group and associated expenses deleted successfully." });
  } catch (err) {
    next(err);
  }
});

// Expense Routes
app.post("/expenses", async (req, res, next) => {
  try {
    const expense = new Expense(req.body);
    await expense.save();
    res.status(201).json(expense);
  } catch (err)
  {
    err.statusCode = 400;
    next(err);
  }
});

app.get("/groups/:id/expenses", async (req, res, next) => {
  try {
    const expenses = await Expense.find({ groupId: req.params.id });
    res.json(expenses);
  } catch (err) {
    next(err);
  }
});

// =======================================================
// CENTRALIZED ERROR HANDLER
// =======================================================
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  const message = err.message || "An internal server error occurred.";
  res.status(statusCode).json({
    error: {
      message: message,
    },
  });
});

// =======================================================
// START SERVER
// =======================================================
app.listen(CONFIG.PORT, () => {
  console.log(`🚀 Server live at http://localhost:${CONFIG.PORT}`);
});

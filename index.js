import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatRoute from "./routes/chat.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: "http://localhost:5173" 
}));
app.use(express.json());

app.use("/api", chatRoute);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Chatbot Backend Running! 🚀" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
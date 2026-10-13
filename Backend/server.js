import express from "express";
import "dotenv/config";
import cors from "cors";
import mongoose from "mongoose";
import chatRoutes from "./routes/chat.js";
import authRoutes from "./routes/auth.js";
import uploadRoutes from "./routes/upload.js";
import folderRoutes from "./routes/folder.js";
import shareRoutes from "./routes/share.js";
import statsRoutes from "./routes/stats.js";

const app = express();
const PORT = 8080;

app.use(express.json({ limit: "10mb" }));
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api", shareRoutes); // shareRoutes must be before chatRoutes to avoid authMiddleware blocking public routes
app.use("/api", chatRoutes);
app.use("/api", folderRoutes);
app.use("/api/stats", statsRoutes);

app.listen(PORT, () => {
    console.log(`server running on ${PORT}`);
    connectDB();
});

const connectDB = async() => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected with Database!");
    } catch(err) {
        console.log("Failed to connect with Db", err);
    }
}


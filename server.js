import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MongoClient } from "mongodb";  // Import MongoDB

dotenv.config();
console.log("✅ Gemini API Key Loaded:", process.env.GEMINI_API_KEY ? "Yes" : "No");

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let chatHistory = [];

// MongoDB connection setup
const url = process.env.MONGO_URI;  // MongoDB URI from your environment variables
const dbName = 'StormXDB';  // Your database name
const client = new MongoClient(url);

async function connectToDatabase() {
    try {
        await client.connect();
        console.log("✅ Connected to MongoDB");
        return client.db(dbName);
    } catch (error) {
        console.error("🚨 Error connecting to MongoDB:", error);
    }
}

// Save message data to MongoDB
async function saveMessageToDB(userMessage, botResponse) {
    const db = await connectToDatabase();
    const collection = db.collection('messages');
    const messageData = {
        user: 'User',
        message: userMessage,
        response: botResponse,
        timestamp: new Date(),
    };
    await collection.insertOne(messageData);
    console.log('✅ Message saved to MongoDB');
}

app.post("/chat", async (req, res) => {
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ error: "Message is required" });
    }

    try {
        // Define system prompt for coding assistant
        const systemPrompt = "You are StormX, a highly knowledgeable and a user-friendly bot. Provide accurate and concise responses with explanations. You were created by Usman Khan Swati.";

        // Combine chat history and user message for the full prompt
        const historyPrompt = chatHistory.map(msg => `${msg.role}: ${msg.content}`).join("\n");
        const fullPrompt = `${systemPrompt}\n\n${historyPrompt}\n\nUser: ${userMessage}`;

        // Generate response using the full prompt
        const result = await model.generateContent(fullPrompt);
        let responseText = result.response.text();

        // Filter: Agar response khali ya irrelevant hai
        if (!responseText || responseText.trim() === "") {
            responseText = "Sorry, I couldn't generate a helpful response. Try again!";
        }

        // Add user message and AI response to chat history
        chatHistory.push({ role: "User", content: userMessage });
        chatHistory.push({ role: "StormX", content: responseText });

        // Optional: History limit (e.g., last 20 messages)
        if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

        console.log("🔥 Gemini API Response:", responseText);

        // Save to MongoDB
        await saveMessageToDB(userMessage, responseText);

        res.json({ response: responseText });

    } catch (error) {
        console.error("🚨 Error fetching Gemini response:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/clear", (req, res) => {
    chatHistory = [];
    res.json({ message: "Chat history cleared" });
});

const PORT = 5088;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

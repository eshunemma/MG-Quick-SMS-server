import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import dotenv from "dotenv";
import path from "path";
import cors from "cors";
import {
  sendViaTwilio,
  sendViaArkesel,
  fillTemplate,
  generateAIMessage,
  generateAIMessageGemeni
} from "./utils.js";

dotenv.config();

const app = express();
app.use(express.json())
const upload = multer({ dest: "/tmp" });

const corsOptions = {
  origin: ['http://localhost:5173', "https://mg-quick-sms-frontend-pu8u-9gpwtc15x-eshunemmas-projects.vercel.app"], // Allow requests only from this origin
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allowed HTTP methods
  credentials: true, // Allow sending cookies and authorization headers
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Upload and process Excel file
app.post("/send-sms", upload.single("contacts"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("Please upload an Excel file");
    }

    const messageTemplate = req.body.message;
    if (!messageTemplate) {
      return res.status(400).json({ message: "Please provide a message body" });
    }

    // Read Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const contacts = xlsx.utils.sheet_to_json(sheet);

    if (contacts.length === 0) {
      return res.status(400).json({ message: "No contacts found in file" });
    }

    // Loop and send SMS
    for (const contact of contacts) {
      if (!contact.phone) {
        console.log("Skipping contact (missing phone):", contact);
        continue;
      }

      // Replace placeholders dynamically
      const personalizedMessage = fillTemplate(messageTemplate, contact);

      await sendViaArkesel(contact.phone, personalizedMessage);

      console.log(`✅ SMS sent to ${contact.phone}`);
    }

    res.status(200).json({
      message: "Messages sent successfully!",
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error sending messages");
  }
});

// AI message generator endpoint
app.post("/api/generate-message", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const response = await generateAIMessageGemeni(prompt);

    res.status(200).json({ suggestions: response });
  } catch (error) {
    console.error("Error generating message:", error);
    res.status(500).json({ error: "Failed to generate message" });
  }
});


app.get("/", async (req, res) => {
  res.send("Welcome To More Gas Quick SMS")
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);

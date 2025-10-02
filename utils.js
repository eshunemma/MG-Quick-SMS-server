import twilio from "twilio";
import axios from "axios";
import dotenv from "dotenv";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import winston from "winston";
dotenv.config();

// Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const openAIclient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function sendViaTwilio(phone, message) {
  await client.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone,
  });
}

export async function sendViaArkesel(phone, message) {
  const data = {
    sender: process.env.ARKESEL_SENDER_ID,
    message: message,
    recipients: [phone],
    // When sending SMS to Nigerian recipients, specify the use_case field
    // "use_case" = "transactional"
  };

  const config = {
    method: "post",
    url: process.env.ARKESEL_SENDER_URL,
    headers: {
      "api-key": process.env.ARKESEL_API_KEY,
    },
    data: data,
  };

  await axios(config)
    .then(function (response) {
      logger.info(`⚡️SMS sent successfully to ${phone}-${response?.data?.status}`);
    })
    .catch(function (error) {
      logger.error(`❌arkesel error ${phone}`, { error });
    });
}

// Function to replace placeholders dynamically
export function fillTemplate(template, data) {
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    return data[key.trim()] || "";
  });
}

export async function generateAIMessage(prompt) {
  try {
    const response = await openAIclient.chat.completions.create({
      model: "gpt-4o-mini", // small, cheap, fast model
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that generates short SMS templates. Each must be 160 characters or less and include placeholders like {{name}}, {{date}}, {{location}}.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 200,
      n: 5, // generate 5 variations
      temperature: 0.7,
    });

    // Extract messages
    const suggestions = response.choices.map((choice) =>
      choice.message.content.trim()
    );

    return suggestions;
  } catch (error) {
    throw error?.message;
  }
}

export async function generateAIMessageGemeni(prompt) {
  try {
    const instruction = `
      Generate 3 short SMS message templates.
      Each must be 160 characters or less.
      Use placeholders like {{name}}, {{date}}, {{location}}.
      Example: "Hello {{name}}, your appointment is on {{date}} at {{location}}."
      Exclude the enumurations.
      do not add the introductions. just straight to the suggestions
      User prompt: ${prompt}
    `;

    const result = await model.generateContent(instruction);

    // Split into suggestions (Gemini usually returns one block of text)
    let text = result.response.text();
    let suggestions = text.split("\n").filter((line) => line.trim() !== "");
    return suggestions;
  } catch (error) {
    console.log("❌", error.message);
    throw new Error(error?.message);
  }
}

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" })
  ]
});

export default logger;

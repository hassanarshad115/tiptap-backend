import express from "express";
import TelegramBot from "node-telegram-bot-api";

const app = express();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Welcome to aiTapTap 🚀");
});

app.get("/", (req, res) => {
  res.send("aiTapTap backend running ✅");
});

app.listen(3000, () => console.log("Server running"));

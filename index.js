import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { createClient } from "@supabase/supabase-js";

const app = express();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Start command
bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;
  const name = msg.from.first_name;

  // user insert
  await supabase.from("users").upsert({
    user_id: userId,
    name: name,
    coins: 0
  });

  bot.sendMessage(msg.chat.id, `Welcome ${name} 🚀\n\nCoins: 0`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔥 TAP", callback_data: "tap" }]
      ]
    }
  });
});

// Tap button
bot.on("callback_query", async (query) => {
  if (query.data === "tap") {
    const userId = query.from.id;

    // get coins
    let { data } = await supabase
      .from("users")
      .select("*")
      .eq("user_id", userId)
      .single();

    let newCoins = (data?.coins || 0) + 1;

    // update
    await supabase
      .from("users")
      .update({ coins: newCoins })
      .eq("user_id", userId);

    bot.answerCallbackQuery(query.id, {
      text: `Coins: ${newCoins}`
    });
  }
});

app.get("/", (req, res) => {
  res.send("aiTapTap backend running ✅");
});

app.listen(3000, () => console.log("Server running"));

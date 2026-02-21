import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { createClient } from "@supabase/supabase-js";

const app = express();

process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Supabase (ensure these 2 are in Railway Variables)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const MENU = (coins = 0) => ({
  parse_mode: "HTML",
  reply_markup: {
    inline_keyboard: [
      [{ text: "🔥 TAP", callback_data: "tap" }],
      [
        { text: "📋 Daily Task", callback_data: "task" },
        { text: "🎥 Watch Video", callback_data: "video" },
      ],
      [
        { text: "💰 Wallet", callback_data: "wallet" },
        { text: "🧾 Withdraw", callback_data: "withdraw" },
      ],
      [{ text: "🏆 Leaderboard", callback_data: "leaderboard" }],
    ],
  },
});

function panel(name, coins) {
  return (
    `✨ <b>aiTapTap</b> 🚀\n` +
    `━━━━━━━━━━━━━━\n` +
    `👤 <b>User:</b> ${name}\n` +
    `🪙 <b>Coins:</b> ${coins}\n` +
    `━━━━━━━━━━━━━━\n` +
    `👇 <i>Tap to earn coins</i>`
  );
}

async function getOrCreateUser(userId, name) {
  // Upsert user
  await supabase.from("users").upsert({
    user_id: userId,
    name,
    coins: 0,
  });

  // Read user
  const { data, error } = await supabase
    .from("users")
    .select("coins,name")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data;
}

bot.onText(/\/start/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const name = msg.from.first_name || "User";

    const user = await getOrCreateUser(userId, name);

    await bot.sendMessage(chatId, panel(user.name || name, user.coins || 0), MENU(user.coins || 0));
  } catch (e) {
    console.error(e);
    bot.sendMessage(msg.chat.id, "⚠️ Server issue. Please try /start again in 10 seconds.");
  }
});

bot.on("callback_query", async (q) => {
  const chatId = q.message?.chat?.id;
  const messageId = q.message?.message_id;
  const userId = q.from.id;
  const name = q.from.first_name || "User";

  try {
    // Always stop loading spinner quickly
    try { await bot.answerCallbackQuery(q.id); } catch {}

    if (!chatId || !messageId) return;

    if (q.data === "tap") {
      // Read current coins
      const { data: row, error } = await supabase
        .from("users")
        .select("coins,name")
        .eq("user_id", userId)
        .single();

      if (error) throw error;

      const newCoins = (row?.coins || 0) + 1;

      // Update coins
      const { error: upErr } = await supabase
        .from("users")
        .update({ coins: newCoins })
        .eq("user_id", userId);

      if (upErr) throw upErr;

      // Edit same message (safe)
      await bot.editMessageText(panel(row?.name || name, newCoins), {
        chat_id: chatId,
        message_id: messageId,
        ...MENU(newCoins),
      });

      return;
    }

    if (q.data === "wallet") {
      const { data: row } = await supabase
        .from("users")
        .select("coins,name")
        .eq("user_id", userId)
        .single();

      const coins = row?.coins || 0;
      await bot.editMessageText(
        `💰 <b>Wallet</b>\n━━━━━━━━━━━━━━\n🪙 Coins: <b>${coins}</b>\n\n<i>Withdraw rules:\n• Min withdrawal: $100\n• First withdrawal: after 30 days\n• Then weekly</i>`,
        { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: MENU(coins).reply_markup }
      );
      return;
    }

    if (q.data === "task") {
      await bot.editMessageText(
        `📋 <b>Daily Task</b>\n━━━━━━━━━━━━━━\n✅ Tap daily up to limit\n✅ Then unlock video task\n\n<i>Daily reset: every 24 hours</i>`,
        { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: MENU(0).reply_markup }
      );
      return;
    }

    if (q.data === "video") {
      await bot.editMessageText(
        `🎥 <b>Video Task</b>\n━━━━━━━━━━━━━━\n<i>Coming next:</i>\n• Show today’s YouTube link\n• After watch → bonus coins button`,
        { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: MENU(0).reply_markup }
      );
      return;
    }

    if (q.data === "withdraw") {
      await bot.editMessageText(
        `🧾 <b>Withdraw</b>\n━━━━━━━━━━━━━━\n⚠️ Min withdraw: <b>$100</b>\n⏳ First withdraw: <b>30 days</b>\n📅 Then: weekly\n\n<i>Next: TRC20 address add + request submit</i>`,
        { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: MENU(0).reply_markup }
      );
      return;
    }

    if (q.data === "leaderboard") {
      await bot.editMessageText(
        `🏆 <b>Leaderboard</b>\n━━━━━━━━━━━━━━\n<i>Next step: top users by coins</i>`,
        { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: MENU(0).reply_markup }
      );
      return;
    }
  } catch (e) {
    console.error("callback error:", e);
    // Don’t crash; just ignore
  }
});

app.get("/", (req, res) => res.send("aiTapTap backend running ✅"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));

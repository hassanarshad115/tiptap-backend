// Simple Telegram Tap-to-Earn bot using Supabase
// Required env vars on Railway:
// BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY

const TelegramBot = require("node-telegram-bot-api");
const { createClient } = require("@supabase/supabase-js");

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!BOT_TOKEN) throw new Error("Missing env: BOT_TOKEN");
if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
if (!SUPABASE_KEY) throw new Error("Missing env: SUPABASE_KEY");

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function kbMain() {
  return {
    inline_keyboard: [
      [{ text: "🔥 TAP", callback_data: "tap" }],
      [
        { text: "📺 Today Video", callback_data: "video" },
        { text: "📊 Stats", callback_data: "stats" }
      ],
      [{ text: "💳 Withdraw", callback_data: "withdraw" }]
    ]
  };
}

function safeName(user) {
  const n = user?.first_name || user?.username || "Friend";
  return String(n).slice(0, 40);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function ensureUser(tgUser) {
  const tg_id = Number(tgUser.id);
  const name = safeName(tgUser);

  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        tg_id,
        name,
        last_active_date: new Date().toISOString().slice(0, 10)
      },
      { onConflict: "tg_id" }
    )
    .select("tg_id,name,coins,taps,streak")
    .single();

  if (error) throw error;
  return data;
}

async function getLatestVideoUrl() {
  const { data, error } = await supabase
    .from("videos")
    .select("youtube_url,title,created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function incrementTap(tg_id) {
  const { data: u, error: e1 } = await supabase
    .from("users")
    .select("coins,taps")
    .eq("tg_id", tg_id)
    .single();

  if (e1) throw e1;

  const newCoins = Number(u.coins || 0) + 1;
  const newTaps = Number(u.taps || 0) + 1;

  const { data: updated, error: e2 } = await supabase
    .from("users")
    .update({
      coins: newCoins,
      taps: newTaps,
      last_active_date: new Date().toISOString().slice(0, 10)
    })
    .eq("tg_id", tg_id)
    .select("coins,taps")
    .single();

  if (e2) throw e2;
  return updated;
}

async function replyHome(chatId, userRow) {
  const name = userRow?.name || "Friend";
  const coins = Number(userRow?.coins || 0);

  const text =
    `🚀 <b>Welcome ${escapeHtml(name)}</b>\n` +
    `🪙 <b>Coins:</b> ${coins}\n\n` +
    `Tap to earn coins 👇`;

  await bot.sendMessage(chatId, text, {
    parse_mode: "HTML",
    reply_markup: kbMain()
  });
}

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const u = await ensureUser(msg.from);
    await replyHome(chatId, u);
  } catch (err) {
    console.error("START ERROR:", err?.message || err);
    await bot.sendMessage(
      chatId,
      "⚠️ Server issue. Please try /start again in 10 seconds."
    );
  }
});

// Buttons
bot.on("callback_query", async (q) => {
  const chatId = q.message?.chat?.id;
  const tg_id = Number(q.from?.id);
  const data = q.data;

  try {
    if (!chatId) return;

    if (data === "tap") {
      await bot.answerCallbackQuery(q.id, { text: "✅ +1 coin" });

      const updated = await incrementTap(tg_id);

      const text =
        `🪙 Coins: <b>${Number(updated.coins || 0)}</b>\n` +
        `👆 Taps: ${Number(updated.taps || 0)}`;

      await bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        reply_markup: kbMain()
      });
      return;
    }

    if (data === "video") {
      await bot.answerCallbackQuery(q.id);

      const v = await getLatestVideoUrl();
      if (!v?.youtube_url) {
        await bot.sendMessage(chatId, "📺 No video added yet. Admin please add a YouTube link.");
        return;
      }

      const title = v.title ? `🎬 <b>${escapeHtml(v.title)}</b>\n` : "";
      await bot.sendMessage(
        chatId,
        `${title}📌 Today Video:\n${v.youtube_url}`,
        { parse_mode: "HTML", reply_markup: kbMain() }
      );
      return;
    }

    if (data === "stats") {
      await bot.answerCallbackQuery(q.id);

      const { data: u, error } = await supabase
        .from("users")
        .select("coins,taps,streak")
        .eq("tg_id", tg_id)
        .single();

      if (error) throw error;

      await bot.sendMessage(
        chatId,
        `📊 <b>Your Stats</b>\n🪙 Coins: ${Number(u.coins || 0)}\n👆 Taps: ${Number(u.taps || 0)}\n🔥 Streak: ${Number(u.streak || 0)}`,
        { parse_mode: "HTML", reply_markup: kbMain() }
      );
      return;
    }

    if (data === "withdraw") {
      await bot.answerCallbackQuery(q.id);
      await bot.sendMessage(
        chatId,
        "💳 Withdraw feature coming soon.\n(Next step: TRC20 address + request table)",
        { reply_markup: kbMain() }
      );
      return;
    }

    await bot.answerCallbackQuery(q.id);
  } catch (err) {
    console.error("CALLBACK ERROR:", err?.message || err);
    if (chatId) {
      await bot.sendMessage(
        chatId,
        "⚠️ Server issue. Please try /start again in 10 seconds."
      );
    }
    try { await bot.answerCallbackQuery(q.id); } catch (_) {}
  }
});

console.log("✅ Bot is running with polling...");

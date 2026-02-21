bot.on("callback_query", async (query) => {
  try {
    if (query.data !== "tap") return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const userId = query.from.id;
    const name = query.from.first_name || "User";

    // get user
    const { data: userRow } = await supabase
      .from("users")
      .select("coins")
      .eq("user_id", userId)
      .single();

    const newCoins = (userRow?.coins || 0) + 1;

    // update coins
    await supabase
      .from("users")
      .update({ coins: newCoins })
      .eq("user_id", userId);

    // edit same message (coins update)
    await bot.editMessageText(`Welcome ${name} 🚀\n\nCoins: ${newCoins}`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [[{ text: "🔥 TAP", callback_data: "tap" }]],
      },
    });

    // remove loading spinner
    await bot.answerCallbackQuery(query.id);
  } catch (e) {
    // fallback
    try { await bot.answerCallbackQuery(query.id, { text: "Try again" }); } catch {}
  }
});

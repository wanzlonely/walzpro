const { bot, initBot } = require("../bot");

let ready = false;

async function ensureReady() {
  if (!ready) {
    await initBot();
    ready = true;
  }
}

module.exports = async (req, res) => {
  try {
    await ensureReady();

    if (req.method === "POST") {
      await bot.handleUpdate(req.body);
      return res.status(200).send("ok");
    }

    return res.status(200).json({
      status: "ok",
      bot: "walzpro",
      mode: "webhook"
    });
  } catch (err) {
    console.error("webhook error:", err);
    return res.status(500).send("error");
  }
};

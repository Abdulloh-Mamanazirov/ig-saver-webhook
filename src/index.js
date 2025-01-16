require("dotenv").config();
const express = require("express");
const { default: axios } = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const app = express();

const PORT = process.env.PORT;
const HOST = process.env.HOST;
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_ADMIN_ID = process.env.TG_ADMIN_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.MY_TOKEN;

// Set up Telegram Bot
const bot = new TelegramBot(TG_BOT_TOKEN, { polling: true });

// Parse JSON bodies for webhook notifications
app.use(express.json());

app.get("/", async (req, res) => {
  const { data } = await axios.get(
    `https://graph.instagram.com/v21.0/me?fields=user_id,name,followers_count,profile_picture_url,username&access_token=${IG_ACCESS_TOKEN}`
  );
  res.send("Hello World!\n" + JSON.stringify(data));
});

// GET endpoint for webhook verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Send text messages on telegram bot
async function sendMessageOnTgBot(chat_id, messageText) {
  try {
    await bot.sendMessage(chat_id, messageText);
  } catch (error) {
    throw error;
  }
}

// Send videos on telegram bot
async function sendVideoOnTgBot(chat_id, video_url, caption) {
  try {
    await bot.sendVideo(chat_id, video_url, {
      caption: caption,
    });
  } catch (error) {
    throw error;
  }
}

// POST endpoint for receiving webhook notifications
app.post("/webhook", async (req, res) => {
  console.log("Request was made to /webhook");

  const body = req.body;
  console.log("messaging", body?.entry?.[0]?.messaging);
  console.log(
    "messaging -> message",
    body?.entry?.[0]?.messaging?.[0]?.message
  );
  console.log(
    "message -> attachments -> 0:",
    body?.entry?.[0]?.messaging?.[0]?.message?.attachments?.[0]
  );

  if (body.object === "instagram") {
    if (body.entry && body.entry.length > 0) {
      for (const entry of body.entry) {
        if (entry.messaging && entry.messaging.length > 0) {
          for (const event of entry.messaging) {
            // Check if this is a message event
            if (event.message) {
              const senderId = event.sender.id;
              const messageText = event?.message?.text ?? "";
              const isEcho = event.message.is_echo;

              if (!isEcho) {
                try {
                  if (
                    body?.entry?.[0]?.messaging?.[0]?.message?.attachments?.[0]
                      ?.type === "ig_reel"
                  ) {
                    await sendVideoOnTgBot(
                      TG_ADMIN_ID,
                      body.entry?.[0].messaging?.[0].message.attachments?.[0]
                        .payload?.url,
                      body.entry?.[0].messaging?.[0].message.attachments?.[0]
                        .payload?.title
                    );
                  } else {
                    await sendMessageOnTgBot(
                      TG_ADMIN_ID,
                      `The message on Instagram was not a reel! ${
                        messageText ?? "Message text: " + messageText
                      }`
                    );
                  }
                } catch (error) {
                  console.error("Failed to send reply:", error);
                }
              }
              // else {
              //   if (
              //     body?.entry?.[0]?.messaging?.[0]?.message?.attachments?.[0]
              //       ?.type === "ig_reel"
              //   ) {
              //     await sendVideoOnTgBot(
              //       TG_ADMIN_ID,
              //       body.entry?.[0].messaging?.[0].message.attachments?.[0].payload
              //         ?.url,
              //       body.entry?.[0].messaging?.[0].message.attachments?.[0].payload
              //         ?.title
              //     );
              //   } else {
              //     await sendMessageOnTgBot(
              //       TG_ADMIN_ID,
              //       `The message on Instagram was not a reel! ${
              //         messageText ?? "Message text: " + messageText
              //       }`
              //     );
              //     console.log("not a reel Received echo of our message:", body);
              //   }
              // }
            }
          }
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

app.listen(PORT, HOST, () => {
  console.log(`App listening on http://${HOST}:${PORT}`);
});

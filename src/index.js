require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const { v4: uuid, validate } = require("uuid");
const { default: axios } = require("axios");
const { dbClient } = require("./utils");

const app = express();

const PORT = process.env.PORT;
const HOST = process.env.HOST;
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_ADMIN_ID = process.env.TG_ADMIN_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_ACC_USERNAME = process.env.IG_ACC_USERNAME;
const VERIFY_TOKEN = process.env.MY_TOKEN;

// Set up Telegram Bot
const bot = new TelegramBot(TG_BOT_TOKEN, { polling: true });

bot.onText(/\/start/, async (msg, _) => {
  const chatId = msg.chat.id;
  const name = msg.chat.first_name;

  const foundUser = await dbClient.query(
    "SELECT id, is_verified, token from users WHERE tg_id = $1",
    [chatId]
  );

  if (foundUser.rows.length === 0) {
    const uuidToken = uuid();
    await dbClient.query("INSERT INTO users (tg_id, token) VALUES ($1, $2)", [
      chatId,
      uuidToken,
    ]);

    return bot.sendMessage(
      chatId,
      `<p>Hello ${name}, to use this bot, connect your Instagram profile with it. To connect, copy the unique token below and send it to this <a href="https://www.instagram.com/${IG_ACC_USERNAME}/">Instagram profile</a>. \n<pre>${uuidToken}</pre></p>`,
      {
        parse_mode: "HTML",
      }
    );
  } else if (foundUser.rows.length > 0 && !foundUser.rows[0].is_verified) {
    return bot.sendMessage(
      chatId,
      `<p>Hello ${name}, to use this bot, connect your Instagram profile with it. To connect, copy the unique token below and send it to this <a href="https://www.instagram.com/${IG_ACC_USERNAME}/">Instagram profile</a>. \n<pre>${foundUser.rows[0].token}</pre></p>`,
      {
        parse_mode: "HTML",
      }
    );
  } else {
    return bot.sendMessage(
      chatId,
      `Hello ${name}, to know more about how to use this bot, send the /manual command.`
    );
  }
});

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

  if (body.object === "instagram") {
    const senderId = body?.entry?.[0]?.messaging?.[0]?.sender?.id;
    const msgText =
      body?.entry?.[0]?.messaging?.[0]?.message?.text?.trim() ?? "";

    if (validate(msgText)) {
      try {
        const response = await dbClient.query(
          "SELECT tg_id, is_verified FROM users WHERE token = $1",
          [msgText]
        );

        if (response.rows.length === 0) {
          await sendMessageOnTgBot(
            response.rows[0].tg_id,
            "There is no such valid token! Check for any mistakes and send only the token without any other words included."
          );
        } else if (response.rows.length > 0 && !response.rows[0].is_verified) {
          await dbClient.query(
            "UPDATE users SET is_verified = true, ig_id = $1 WHERE token = $2",
            [senderId, msgText]
          );
          await sendMessageOnTgBot(
            response.rows[0].tg_id,
            "Successfully connected to your Instagram profile!"
          );
        }
      } catch (error) {
        console.log("Error in validation: ", error);
        res.sendStatus(404);
      }
    }

    if (body.entry && body.entry.length > 0) {
      for (const entry of body.entry) {
        if (entry.messaging && entry.messaging.length > 0) {
          for (const event of entry.messaging) {
            // Check if this is a message event
            if (event.message) {
              const messageText = event?.message?.text?.trim() ?? "";
              const isEcho = event.message.is_echo;

              if (!isEcho) {
                const user = await dbClient.query(
                  "SELECT tg_id, is_verified FROM users WHERE ig_id = $1",
                  [senderId]
                );
                const user_is_verified = user.rows[0].is_verified;
                const user_tg_id = user.rows[0].tg_id;

                if (user_is_verified) {
                  try {
                    if (
                      body?.entry?.[0]?.messaging?.[0]?.message
                        ?.attachments?.[0]?.type === "ig_reel"
                    ) {
                      await sendVideoOnTgBot(
                        user_tg_id,
                        body.entry?.[0].messaging?.[0].message.attachments?.[0]
                          .payload?.url,
                        body.entry?.[0].messaging?.[0].message.attachments?.[0]
                          .payload?.title
                      );
                    } else {
                      await sendMessageOnTgBot(
                        user_tg_id,
                        `The message on Instagram was not a reel! ${
                          messageText ?? "Message text: " + messageText
                        }`
                      );
                    }
                  } catch (error) {
                    console.error("Failed to send reply:", error);
                  }
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

require("dotenv").config();
const express = require("express");
const { default: axios } = require("axios");
const app = express();

// Parse JSON bodies for webhook notifications
app.use(express.json());

const PORT = process.env.PORT;
const HOST = process.env.HOST;
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_ADMIN_ID = process.env.TG_ADMIN_ID;
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.MY_TOKEN;

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

async function sendMessageOnTgBot(chat_id, messageText) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage?chat_id=${chat_id}&text=${messageText}`
    );
  } catch (error) {
    throw error;
  }
}

// POST endpoint for receiving webhook notifications
app.post("/webhook", async (req, res) => {
  console.log("Request was made to /webhook");

  const body = req.body;

  if (body.object === "instagram") {
    if (body.entry && body.entry.length > 0) {
      for (const entry of body.entry) {
        if (entry.messaging && entry.messaging.length > 0) {
          for (const event of entry.messaging) {
            // Check if this is a message event
            if (event.message) {
              const senderId = event.sender.id;
              const messageText = event.message.text;
              const isEcho = event.message.is_echo;

              if (!isEcho) {
                if (
                  body.entry[0].messaging[0].message.attachments[0].type ===
                  "ig_reel"
                ) {
                  console.log(
                    "reel details:",
                    body.entry[0].messaging[0].message
                  );
                }

                try {
                  await sendMessageOnTgBot(
                    TG_ADMIN_ID,
                    `senderId:${senderId}, messageText:"${messageText}"\n\n ${JSON.stringify(
                      body
                    )}`
                  );
                } catch (error) {
                  console.error("Failed to send reply:", error);
                }
              } else {
                if (
                  body.entry[0].messaging[0].message.attachments[0].type ===
                  "ig_reel"
                ) {
                  console.log(
                    "my reel details:",
                    body.entry[0].messaging[0].message
                  );
                  console.log(
                    "my reel details:",
                    body.entry[0].messaging[0].message.payload
                  );
                } else {
                  console.log("Received echo of our message:", body);
                }
              }
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

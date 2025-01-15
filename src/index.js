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

// app.post("/*", async (req, res) => {
//   console.log("Request was made to /*");

//   const body = req.body;
//   await axios.post(
//     `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage?chat_id=${TG_ADMIN_ID}&text=${JSON.stringify(
//       body
//     )}`
//   );

//   res.send("/* OK");
// });

// Send message back to the user
async function sendInstagramMessage(recipientId, messageText) {
  try {
    const response = await axios({
      method: "POST",
      url: `https://graph.facebook.com/v18.0/me/messages`,
      params: {
        access_token: IG_ACCESS_TOKEN,
      },
      data: {
        recipient: {
          id: recipientId,
        },
        message: {
          text: messageText,
        },
      },
    });
    console.log("Message sent successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error sending message:", error.response?.data || error);
    throw error;
  }
}

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
                console.log("Received message from user:", {
                  senderId,
                  messageText,
                });

                try {
                  await sendMessageOnTgBot(
                    TG_ADMIN_ID,
                    `senderId:${senderId}, messageText:${messageText}`
                  );
                  // Example auto-reply
                  await sendInstagramMessage(
                    senderId,
                    `Your message was received: "${messageText}". This is an automated response.`
                  );
                } catch (error) {
                  console.error("Failed to send reply:", error);
                }
              } else {
                console.log("Received echo of our message:", {
                  senderId,
                  messageText,
                });
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

  // if (body.object === "instagram") {
  //   console.log("Received webhook notification:", body);

  //   if (body.entry && body.entry.length > 0) {
  //     body.entry.forEach((entry) => {
  //       if (entry.messaging && entry.messaging.length > 0) {
  //         entry.messaging.forEach((messagingEvent) => {
  //           console.log("Messaging event:", messagingEvent);
  //         });
  //       }
  //     });
  //   }

  //   res.status(200).send("EVENT_RECEIVED");
  // } else {
  //   res.sendStatus(404);
  // }
});

// Send message to others on instagram
app.get("/sendMessageOnIg", async (req, res) => {
  const igUserID = req.query["userIgId"];
  const recipientID = "47187471584"; //process.env.IG_ACC_ID
  const textMessage = req.query["textMessage"];

  const config = {
    headers: {
      Authorization: `Bearer ${IG_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  };

  const data = {
    recipient: {
      id: recipientID,
    },
    message: {
      text: textMessage,
    },
  };

  axios
    .post(
      `https://graph.instagram.com/v21.0/${igUserID}/messages`,
      data,
      config
    )
    .then((response) => {
      console.log("Message sent successfully:", response.data);
    })
    .catch((error) => {
      console.error("Error sending message:", error.response);
    });
});

app.listen(PORT, HOST, () => {
  console.log(`App listening on http://${HOST}:${PORT}`);
});

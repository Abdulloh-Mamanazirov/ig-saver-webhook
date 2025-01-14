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
  // Parse verification params from the request
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
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

// POST endpoint for receiving webhook notifications
app.post("/webhook", async (req, res) => {
  console.log("Request was made to /webhook");

  const body = req.body;
  await axios.post(
    `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage?chat_id=${TG_ADMIN_ID}&text=${JSON.stringify(
      body
    )}`
  );

  if (body.object === "instagram") {
    console.log("Received webhook notification:", body);

    if (body.entry && body.entry.length > 0) {
      body.entry.forEach((entry) => {
        if (entry.messaging && entry.messaging.length > 0) {
          entry.messaging.forEach((messagingEvent) => {
            console.log("Messaging event:", messagingEvent);
          });
        }
      });
    }

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

app.listen(PORT, HOST, () => {
  console.log(`App listening on http://${HOST}:${PORT}`);
});

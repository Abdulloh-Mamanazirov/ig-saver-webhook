require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();

// Parse JSON bodies for webhook notifications
app.use(express.json());

const PORT = process.env.PORT;
const HOST = process.env.HOST;
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

// POST endpoint for receiving webhook notifications
app.post("/*", (req, res) => {
  console.log(req.body);
  res.send("OK");
});

app.post("/webhook", (req, res) => {
  const body = req.body;
  console.log(body);

  if (body.object === "instagram") {
    // Handle the Instagram webhook notification
    console.log("Received webhook notification:", body);

    // Process the message data
    if (body.entry && body.entry.length > 0) {
      body.entry.forEach((entry) => {
        if (entry.messaging && entry.messaging.length > 0) {
          entry.messaging.forEach((messagingEvent) => {
            // Handle different types of messaging events
            console.log("Messaging event:", messagingEvent);
            // Add your message handling logic here
          });
        }
      });
    }

    // Return a '200 OK' response to acknowledge receipt of the event
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Return a '404 Not Found' if event is not from Instagram
    res.sendStatus(404);
  }
});

app.listen(PORT, HOST, () => {
  console.log(`App listening on http://${HOST}:${PORT}`);
});

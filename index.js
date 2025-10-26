const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const express = require("express");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// === CONFIG ===
const YT_API_KEY = process.env.YT_API_KEY;
const CHANNEL_ID = process.env.YT_CHANNEL_ID; // YouTube channel ID (UC...)
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID; // Discord channel to send in
const PING_ROLE_ID = process.env.PING_ROLE_ID; // Role ID to ping
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

let lastVideoId = null;

// === FETCH LATEST VIDEO ===
async function fetchLatestVideo() {
  const url = `https://www.googleapis.com/youtube/v3/search?key=${YT_API_KEY}&channelId=${CHANNEL_ID}&type=video&order=date&maxResults=1`;

  try {
    const res = await axios.get(url);
    const video = res.data.items?.[0];
    if (!video) return null;

    const videoId = video.id.videoId;
    return `https://youtu.be/${videoId}`;
  } catch (err) {
    console.error("❌ Failed to fetch video:", err.message);
    return null;
  }
}

// === CHECK AND POST NEW VIDEO ===
async function checkForNewVideo() {
  const latest = await fetchLatestVideo();
  if (!latest) return;

  if (latest !== lastVideoId) {
    lastVideoId = latest;

    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (!channel) return console.error("❌ Channel not found!");

    await channel.send({
      content: `<@&${PING_ROLE_ID}> GoShiggy just dropped a new video! ${latest}`,
    });

    console.log(`🎥 Posted new video: ${latest}`);
  }
}

// === STARTUP ===
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  checkForNewVideo();
  setInterval(checkForNewVideo, CHECK_INTERVAL);
});

client.login(process.env.TOKEN);

// === KEEPALIVE (Render) ===
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("YouTube alert bot is running!"));
app.listen(PORT, () => console.log(`🌐 Web server listening on port ${PORT}`));

const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const express = require("express");
const fs = require("fs-extra");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const YT_API_KEY = process.env.YT_API_KEY;
const YT_CHANNEL_ID = process.env.YT_CHANNEL_ID;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const PING_ROLE_ID = process.env.PING_ROLE_ID;
const CHECK_INTERVAL = 60 * 1000; // 1 minute
const DATA_FILE = "./lastVideo.json";

async function getLatestVideo() {
  try {
    const res = await axios.get(
      "https://www.googleapis.com/youtube/v3/search",
      {
        params: {
          key: YT_API_KEY,
          channelId: YT_CHANNEL_ID,
          part: "snippet",
          order: "date",
          maxResults: 1,
        },
      }
    );

    const item = res.data.items?.[0];
    if (!item || item.id.kind !== "youtube#video") return null;

    return {
      id: item.id.videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    };
  } catch (err) {
    console.error("❌ Failed to fetch YouTube data:", err.message);
    return null;
  }
}

async function checkForNewVideo() {
  const latest = await getLatestVideo();
  if (!latest) return;

  let saved = { lastVideoId: "" };
  try {
    saved = await fs.readJson(DATA_FILE);
  } catch (e) {
    await fs.writeJson(DATA_FILE, saved);
  }

  if (saved.lastVideoId !== latest.id) {
    console.log(`🎥 New video found: ${latest.url}`);
    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (channel) {
      await channel.send(
        `<@&${PING_ROLE_ID}> GoShiggy just dropped a new video! 🎬\n${latest.url}`
      );
    }

    saved.lastVideoId = latest.id;
    await fs.writeJson(DATA_FILE, saved, { spaces: 2 });
  }
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  setInterval(checkForNewVideo, CHECK_INTERVAL);
  checkForNewVideo(); // Run once at startup
});

// Keepalive for Render
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (_, res) => res.send("YouTube alert bot is running."));
app.listen(PORT, () =>
  console.log(`🌐 Web server listening on port ${PORT} (pid=${process.pid})`)
);

client.login(process.env.TOKEN).catch(console.error);

const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const express = require("express");
const fs = require("fs-extra");
require("dotenv").config();

// --- Discord Client Setup ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// --- Config ---
const YT_API_KEY = process.env.YT_API_KEY;
const YT_CHANNEL_ID = process.env.YT_CHANNEL_ID;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const PING_ROLE_ID = process.env.PING_ROLE_ID;
const CHECK_INTERVAL = 15 * 60 * 1000; // every 30 minutes
const DATA_FILE = "./lastVideo.json";

// --- Fetch latest video ---
async function getLatestVideo() {
  try {
    const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        key: YT_API_KEY,
        channelId: YT_CHANNEL_ID,
        part: "snippet",
        order: "date",
        maxResults: 1,
        type: "video", // ensures only videos (not shorts/playlists)
      },
    });

    const item = res.data.items?.[0];
    if (!item) {
      console.log("⚠️ No videos found in API response.");
      return null;
    }

    return {
      id: item.id.videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    };
  } catch (err) {
    console.error("❌ Failed to fetch YouTube data:", err.response?.data || err.message);
    return null;
  }
}

// --- Check for new upload ---
async function checkForNewVideo() {
  const latest = await getLatestVideo();
  if (!latest) return;

  let saved = { lastVideoId: "" };
  try {
    if (await fs.pathExists(DATA_FILE)) {
      saved = await fs.readJson(DATA_FILE);
    } else {
      await fs.writeJson(DATA_FILE, saved, { spaces: 2 });
    }
  } catch (e) {
    console.error("⚠️ Could not read or create lastVideo.json:", e.message);
  }

  if (saved.lastVideoId !== latest.id) {
    console.log(`🎥 New video detected: ${latest.title} (${latest.url})`);

    try {
      const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
      if (channel) {
        await channel.send(
          `<@&${PING_ROLE_ID}> GoShiggy just dropped a new video! 🎬\n${latest.url}`
        );
        console.log("✅ Message sent to Discord!");
      } else {
        console.warn("⚠️ Discord channel not found!");
      }
    } catch (err) {
      console.error("❌ Failed to send message to Discord:", err.message);
    }

    saved.lastVideoId = latest.id;
    await fs.writeJson(DATA_FILE, saved, { spaces: 2 });
  } else {
    console.log("⏳ No new videos found.");
  }
}

// --- Bot Ready Event ---
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Set bot presence
  client.user.setPresence({
    activities: [{ name: `Goshiggy sleep`, type: 3 }],
    status: "online",
  });

  // Run once at startup
  checkForNewVideo();

  // Then every 1 min
  setInterval(checkForNewVideo, CHECK_INTERVAL);
});


// --- Keepalive for Render ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (_, res) => res.send("YouTube alert bot is running."));
app.listen(PORT, () =>
  console.log(`🌐 Web server listening on port ${PORT} (pid=${process.pid})`)
);

// --- Login ---
client.login(process.env.TOKEN).catch(console.error);

// --- Imports ---
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
const CHECK_INTERVAL = 15 * 60 * 1000; // minute
const DATA_FILE = "./lastVideo.json";

// --- Safety Check for Env Vars ---
if (!YT_API_KEY || !YT_CHANNEL_ID || !DISCORD_CHANNEL_ID || !PING_ROLE_ID || !process.env.TOKEN) {
  console.error("❌ Missing one or more required environment variables.");
  process.exit(1);
}

// --- Helper: Fetch latest video ---
async function getLatestVideo() {
  try {
    const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        key: YT_API_KEY,
        channelId: YT_CHANNEL_ID,
        part: "snippet",
        order: "date",
        maxResults: 1,
        type: "video",
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
      publishedAt: item.snippet.publishedAt,
    };
  } catch (err) {
    console.error("❌ Failed to fetch YouTube data:", err.response?.data || err.message);
    return null;
  }
}

// --- Check for new uploads ---
async function checkForNewVideo() {
  const latest = await getLatestVideo();
  if (!latest) return;

  // --- Ignore videos older than 24h ---
  const publishedTime = new Date(latest.publishedAt).getTime();
  const now = Date.now();
  const ageHours = (now - publishedTime) / (1000 * 60 * 60);

  if (ageHours > 2) {
    console.log(`🕒 Latest video (${latest.title}) is ${ageHours.toFixed(1)}h old. Ignored.`);
    return;
  }

  // --- Load or create cache file ---
  let saved = { lastVideoId: "", lastTimestamp: 0 };
  try {
    if (await fs.pathExists(DATA_FILE)) {
      saved = await fs.readJson(DATA_FILE);
    } else {
      await fs.writeJson(DATA_FILE, saved, { spaces: 2 });
    }
  } catch (e) {
    console.error("⚠️ Could not read or create lastVideo.json:", e.message);
  }

  // --- Detect new video ---
  if (saved.lastVideoId !== latest.id) {
    console.log(`🎥 New video detected: ${latest.title} (${latest.url})`);

    try {
      const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
      if (channel) {
        await channel.send(
          `<@&${PING_ROLE_ID}> GoShiggy just dropped a new video! \n**${latest.title}**\n${latest.url}`
        );
        console.log("✅ Message sent to Discord!");
      } else {
        console.warn("⚠️ Discord channel not found!");
      }
    } catch (err) {
      console.error("❌ Failed to send message to Discord:", err.message);
    }

    saved.lastVideoId = latest.id;
    saved.lastTimestamp = now;
    await fs.writeJson(DATA_FILE, saved, { spaces: 2 });
  } else {
    console.log("⏳ No new videos found.");
  }
}

// --- On Ready ---
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // Presence
  client.user.setPresence({
    activities: [{ name: "Sub to GoShiggy", type: 3 }],
    status: "online",
  });

  // Run immediately, then on interval
  checkForNewVideo();
  setInterval(checkForNewVideo, CHECK_INTERVAL);
});

// --- Keepalive for Render / Ping ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (_, res) => res.send("✅ YouTube Alert Bot is running."));
app.listen(PORT, () =>
  console.log(`🌐 Web server listening on port ${PORT} (pid=${process.pid})`)
);

// --- Login ---
client.login(process.env.TOKEN).catch((err) => {
  console.error("❌ Discord login failed:", err.message);
});

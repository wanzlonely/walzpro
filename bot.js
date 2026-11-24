require("dotenv").config();
const dns = require("dns");
if (typeof dns.setDefaultResultOrder === "function") dns.setDefaultResultOrder("ipv4first");
const fs = require("fs");
const crypto = require("crypto");
const { Telegraf } = require("telegraf");
const { Redis } = require("@upstash/redis");
const { checkPhone, triggerEmailVerification } = require("./checker");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(",").filter(Boolean).map(Number);
const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_LIMIT || "3", 10);
const PREMIUM_BATCH_LIMIT = parseInt(process.env.PREMIUM_BATCH_LIMIT || "30", 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "8", 10);
const CHECK_TIMEOUT_MS = parseInt(process.env.CHECK_TIMEOUT_MS || "14000", 10);
const CHECK_RETRIES = parseInt(process.env.CHECK_RETRIES || "1", 10);
const RESULT_CACHE_TTL = parseInt(process.env.RESULT_CACHE_TTL || "75", 10);

if (!BOT_TOKEN) { console.error("BOT_TOKEN missing in .env"); process.exit(1); }
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing in .env");
  process.exit(1);
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  automaticDeserialization: false
});

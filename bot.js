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
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "5", 10);
const CHECK_TIMEOUT_MS = parseInt(process.env.CHECK_TIMEOUT_MS || "18000", 10);
const CHECK_RETRIES = parseInt(process.env.CHECK_RETRIES || "2", 10);
const RESULT_CACHE_TTL = parseInt(process.env.RESULT_CACHE_TTL || "90", 10);

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

const PLANS = [
  { id: "p1", days: 1, price: 3000, badge: "ʙʀᴏɴᴢᴇ", icon: "✦", style: "primary" },
  { id: "p3", days: 3, price: 5000, badge: "ʜᴇᴍᴀᴛ", icon: "◈", style: "primary" },
  { id: "p7", days: 7, price: 10000, badge: "ᴘᴏᴘᴜʟᴀʀ", icon: "✧", style: "success" },
  { id: "p15", days: 15, price: 13000, badge: "ᴘʀᴏ ᴠᴀʟᴜᴇ", icon: "◆", style: "primary" },
  { id: "p20", days: 20, price: 25000, badge: "ʟᴏɴɢ ᴘᴀꜱꜱ", icon: "♛", style: "success" }
];

const REWARDS = [
  { pts: 5, days: 1 },
  { pts: 10, days: 3 },
  { pts: 20, days: 7 },
  { pts: 30, days: 15 },
  { pts: 50, days: 20 }
];

const MENU_LABELS = {
  DETECT: "◈ ᴅᴇᴛᴇᴋꜱɪ ɴᴏᴍᴏʀ",
  EMAIL_FIX: "✦ ᴍᴜɴᴄᴜʟᴋᴀɴ ᴇᴍᴀɪʟ",
  STATUS: "◈ ꜱᴛᴀᴛᴜꜱ ꜱᴀʏᴀ",
  REFERRAL: "❖ ʀᴇꜰᴇʀᴀʟ",
  PREMIUM: "♛ ʙᴇʟɪ ᴘʀᴇᴍɪᴜᴍ",
  LEADERBOARD: "♛ ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ",
  ADMIN: "⚙ ᴀᴅᴍɪɴ ᴘᴀɴᴇʟ"
};

const ALL_MENU_TEXTS = new Set(Object.values(MENU_LABELS));

const VALID_CC_PREFIXES = new Set([
  "1","7","20","27","30","31","32","33","34","36","39","40","41","43","44","45","46","47","48","49",
  "51","52","53","54","55","56","57","58","60","61","62","63","64","65","66","81","82","84","86","90",
  "91","92","93","94","95","98","211","212","213","216","218","220","221","222","223","224","225","226",
  "227","228","229","230","231","232","233","234","235","236","237","238","239","240","241","242","243",
  "244","245","248","249","250","251","252","253","254","255","256","257","258","260","261","262","263",
  "264","265","266","267","268","269","290","291","297","298","299","350","351","352","353","354","355",
  "356","357","358","359","370","371","372","373","374","375","376","377","378","379","380","381","382",
  "383","385","386","387","389","420","421","423","500","501","502","503","504","505","506","507","508",
  "509","590","591","592","593","595","596","597","598","599","670","673","674","675","676","677","678",
  "679","680","681","682","683","685","686","688","689","690","691","692","850","852","853","855","856",
  "880","886","960","961","962","963","964","965","966","967","968","970","971","972","973","974","975",
  "976","977","992","993","994","995","996","998"
]);

let BOT_USERNAME = "";
const awaitingInput = new Set();
const awaitingEmailInput = new Set();
const adminState = new Map();
const keyboardMsgIds = new Map();
const activeInlineMsg = new Map();
const today = () => new Date().toISOString().slice(0, 10);

function btn(text, callback_data, style = null) {
  const b = { text, callback_data };
  if (style) b.style = style;
  return b;
}

function urlBtn(text, url, style = null) {
  const b = { text, url };
  if (style) b.style = style;
  return b;
}

function inlineKb(rows) {
  return { reply_markup: { inline_keyboard: rows } };
}

function mainKeyboard(userId) {
  const rows = [
    [{ text: MENU_LABELS.DETECT }],
    [{ text: MENU_LABELS.EMAIL_FIX }],
    [{ text: MENU_LABELS.STATUS }, { text: MENU_LABELS.REFERRAL }],
    [{ text: MENU_LABELS.PREMIUM }, { text: MENU_LABELS.LEADERBOARD }]
  ];
  if (ADMIN_IDS.includes(Number(userId))) {
    rows.push([{ text: MENU_LABELS.ADMIN }]);
  }
  return {
    reply_markup: {
      keyboard: rows,
      resize_keyboard: true,
      is_persistent: true
    }
  };
}

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cleanUsername(u) {
  if (!u) return null;
  const s = String(u).trim().replace(/^@+/, "");
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined" || s.toLowerCase() === "none") return null;
  return s;
}

function parseRedisHash(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    if (raw.length === 0) return null;
    const obj = {};
    for (let i = 0; i < raw.length; i += 2) {
      const k = String(raw[i]);
      const v = raw[i + 1];
      obj[k] = v === null || v === undefined ? "" : String(v);
    }
    return Object.keys(obj).length > 0 ? obj : null;
  }
  if (typeof raw === "object") {
    const keys = Object.keys(raw);
    if (keys.length === 0) return null;
    const obj = {};
    for (const k of keys) {
      const v = raw[k];
      obj[k] = v === null || v === undefined ? "" : String(v);
    }
    return obj;
  }
  return null;
}

function hasValidCountryPrefix(digits) {
  for (let len = 3; len >= 1; len--) {
    const p = digits.slice(0, len);
    if (VALID_CC_PREFIXES.has(p) && digits.length - len >= 4) return true;
  }
  return false;
}

function extractSmartPhoneNumbers(rawInput) {
  const segments = String(rawInput || "").split(/[\r\n,;]+/);
  const extracted = [];
  const seen = new Set();

  const pushNumber = (rawToken) => {
    const hasPlus = rawToken.startsWith("+");
    let digits = rawToken.replace(/\D/g, "");
    if (!hasPlus && digits.startsWith("00") && digits.length >= 9) {
      digits = digits.slice(2);
    }
    if (!hasPlus && digits.startsWith("0") && digits.length >= 9 && digits.length <= 14) {
      digits = "62" + digits.slice(1);
    }
    if (digits.length < 7 || digits.length > 15) return;
    if (!hasValidCountryPrefix(digits)) return;

    const normalized = "+" + digits;
    if (!seen.has(digits)) {
      seen.add(digits);
      extracted.push(normalized);
    }
  };

  for (const seg of segments) {
    let line = seg.trim();
    if (!line) continue;

    const waMatches = [...line.matchAll(/(?:wa\.me\/|whatsapp\.com\/send\?phone=)(\+?[\d\-]{7,18})/gi)];
    if (waMatches.length > 0) {
      for (const m of waMatches) pushNumber(m[1]);
      continue;
    }

    line = line.replace(/[\(\[\{]([^)\]\}]+)[\)\]\}]/g, (full, inner) => {
      const t = inner.trim();
      if (/[a-zA-Z]/.test(t) || /^(199\d|20[0-3]\d)$/.test(t)) return " | ";
      return full;
    });

    line = line.replace(/^\s*(?:no\.?\s*|#\s*)?\d{1,4}\s*[\.\)\:\-]\s*(?=[\+\d])/i, "");

    const candidateRegex = /(?:^|[^\d+])((?:\+|00)?\d(?:[\d\-\.\(\)]|\s(?=[\d\(])){5,}\d)(?=$|[^\d])/g;
    let match;
    while ((match = candidateRegex.exec(line)) !== null) {
      const rawCandidate = match[1].trim();
      let hasPlus = rawCandidate.startsWith("+");
      const spaceParts = rawCandidate.split(/\s+/);
      let accDigits = "";
      for (const part of spaceParts) {
        const partDigits = part.replace(/\D/g, "");
        if (!partDigits) continue;
        if (accDigits.length >= 9) {
          if (/^(199\d|20[0-3]\d)$/.test(partDigits)) {
            break;
          }
          if (partDigits.length >= 8 && accDigits.length + partDigits.length > 15) {
            if (accDigits.length >= 7 && accDigits.length <= 15) {
              pushNumber((hasPlus ? "+" : "") + accDigits);
            }
            accDigits = partDigits;
            hasPlus = false;
            continue;
          }
          if (accDigits.length + partDigits.length > 15) {
            break;
          }
        }
        if (accDigits.length + partDigits.length > 15) break;
        accDigits += partDigits;
      }
      if (accDigits.length >= 7 && accDigits.length <= 15) {
        pushNumber((hasPlus ? "+" : "") + accDigits);
      }
    }
  }

  return extracted;
}

async function getSetting(key, def) {
  const v = await redis.get(`settings:${key}`);
  return v !== null && v !== undefined ? String(v) : def;
}

async function setSetting(key, value) {
  await redis.set(`settings:${key}`, String(value));
}

function normalizeUser(raw, fallbackId = null) {
  const obj = parseRedisHash(raw);
  if (!obj) return null;
  const uid = Number(obj.user_id || fallbackId || 0);
  if (!uid) return null;
  const premFlag = obj.is_premium === "1" || obj.is_premium.toLowerCase() === "true";
  return {
    user_id: uid,
    username: cleanUsername(obj.username),
    first_name: obj.first_name || null,
    is_premium: premFlag ? 1 : 0,
    premium_until: obj.premium_until && obj.premium_until.trim() ? obj.premium_until.trim() : null,
    total_detections: Number(obj.total_detections || 0),
    ready_detections: Number(obj.ready_detections || 0),
    email_triggers: Number(obj.email_triggers || 0),
    referral_points: Number(obj.referral_points || 0),
    referral_redeemed_days: Number(obj.referral_redeemed_days || 0),
    referred_by: obj.referred_by ? Number(obj.referred_by) : null,
    referred_at: obj.referred_at || null,
    created_at: obj.created_at || null
  };
}

async function getUser(id) {
  const uid = Number(id);
  const raw = await redis.hgetall(`user:${uid}`);
  const u = normalizeUser(raw, uid);
  const backupExp = await redis.get(`user:premium_until:${uid}`);
  if (u && backupExp && String(backupExp).trim()) {
    u.premium_until = String(backupExp).trim();
  }
  return u;
}

async function ensureUser(id, from = null) {
  const uid = Number(id);
  await redis.sadd("users:all", String(uid));
  const existing = await getUser(uid);
  if (existing) {
    if (from) {
      const name = [from.first_name, from.last_name].filter(Boolean).join(" ").trim();
      const uname = cleanUsername(from.username);
      if (uname !== existing.username || (name || null) !== existing.first_name) {
        await redis.hset(`user:${uid}`, {
          user_id: String(uid),
          username: uname || "",
          first_name: name || ""
        });
        existing.username = uname;
        existing.first_name = name || null;
      }
    }
    return existing;
  }
  const name = from ? [from.first_name, from.last_name].filter(Boolean).join(" ").trim() : "";
  const uname = from ? cleanUsername(from.username) : null;
  await redis.hset(`user:${uid}`, {
    user_id: String(uid),
    username: uname || "",
    first_name: name || "",
    is_premium: "0",
    premium_until: "",
    total_detections: "0",
    ready_detections: "0",
    email_triggers: "0",
    referral_points: "0",
    referral_redeemed_days: "0",
    created_at: new Date().toISOString()
  });
  return getUser(uid);
}

async function getAllUserIds() {
  const idSet = new Set(await redis.smembers("users:all"));
  let cursor = "0";
  do {
    const res = await redis.scan(cursor, { match: "user:*", count: 200 });
    cursor = String(res[0]);
    for (const k of (res[1] || [])) {
      const uid = k.slice(5);
      if (/^\d+$/.test(uid)) idSet.add(uid);
    }
  } while (cursor !== "0");
  return Array.from(idSet);
}

async function incrUserField(id, field, amount) {
  await redis.hincrby(`user:${id}`, field, amount);
}

async function getUsed(id) {
  const v = await redis.get(`usage:${id}:${today()}`);
  return v ? Number(v) : 0;
}

async function addUsed(id, n) {
  const key = `usage:${id}:${today()}`;
  await redis.incrby(key, n);
  await redis.expire(key, 172800);
}

async function isPremiumUser(id) {
  const uid = Number(id);
  if (ADMIN_IDS.includes(uid)) return true;
  const u = await getUser(uid);
  const untilStr = (u && u.premium_until) || (await redis.get(`user:premium_until:${uid}`));
  if (!untilStr) return false;
  const exp = new Date(String(untilStr)).getTime();
  if (isNaN(exp)) return false;
  if (exp > Date.now()) {
    if (!u || !u.is_premium) {
      await redis.hset(`user:${uid}`, { user_id: String(uid), is_premium: "1", premium_until: String(untilStr) });
    }
    return true;
  }
  if (u && u.is_premium) {
    await redis.hset(`user:${uid}`, { is_premium: "0" });
  }
  await redis.del(`user:premium_until:${uid}`);
  return false;
}

async function addPremiumDays(userId, days) {
  const uid = Number(userId);
  const u = await ensureUser(uid);
  const now = Date.now();
  const curExp = u && u.premium_until ? new Date(u.premium_until).getTime() : 0;
  const base = !isNaN(curExp) && curExp > now ? curExp : now;
  const end = new Date(base + days * 86400000);
  const iso = end.toISOString();
  await redis.hset(`user:${uid}`, {
    user_id: String(uid),
    is_premium: "1",
    premium_until: iso
  });
  await redis.set(`user:premium_until:${uid}`, iso);
  return end;
}

async function removePremiumUser(userId) {
  const uid = Number(userId);
  await ensureUser(uid);
  await redis.hset(`user:${uid}`, {
    user_id: String(uid),
    is_premium: "0",
    premium_until: ""
  });
  await redis.del(`user:premium_until:${uid}`);
}

function formatRp(n) {
  return "ʀᴘ " + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatWIB(iso) {
  if (!iso) return "-";
  let s = String(iso);
  if (!s.includes("T")) s = s.replace(" ", "T") + "Z";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  const wib = new Date(d.getTime() + 7 * 3600000);
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const dd = String(wib.getUTCDate()).padStart(2, "0");
  const mm = months[wib.getUTCMonth()];
  const yy = wib.getUTCFullYear();
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const mi = String(wib.getUTCMinutes()).padStart(2, "0");
  return `${dd} ${mm} ${yy}, ${hh}.${mi} WIB`;
}

function formatCooldown(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  if (s === 0) return "0dtk";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const remS = s % 60;
  if (h > 0) {
    return m > 0 ? `${h}jam ${m}mnt` : `${h}jam`;
  }
  if (m > 0) {
    return remS > 0 ? `${m}mnt ${remS}dtk` : `${m}mnt`;
  }
  return `${remS}dtk`;
}

function displayCD(r) {
  if (r.cooldownSeconds > 0) return formatCooldown(r.cooldownSeconds);
  return "ᴄᴏᴏʟᴅᴏᴡɴ";
}

function cloneStatusLabel(r) {
  if (r.cooldownSeconds > 0) {
    return formatCooldown(r.cooldownSeconds);
  }
  if (r.isCooldown) {
    return "ᴄᴏᴏʟᴅᴏᴡɴ";
  }
  return "ꜱɪᴀᴘ";
}

function isDeviceOn(r) {
  if (!r || typeof r !== "object") return false;
  if (typeof r.isDeviceOn === "boolean") return r.isDeviceOn;
  if (typeof r.hasDevice === "boolean") return r.hasDevice;
  if (typeof r.waOld === "boolean") return r.waOld;
  if (typeof r.wa_old === "boolean") return r.wa_old;
  const rawVal = r.deviceStatus ?? r.device ?? r.wa_old ?? (r.raw && (r.raw.wa_old ?? r.raw.has_device));
  if (typeof rawVal === "boolean") return rawVal;
  const s = String(rawVal || "").trim().toUpperCase();
  return s === "ON" || s === "1" || s === "TRUE" || s === "ACTIVE" || s === "REGISTERED" || s === "YES";
}

function deviceBadge(r) {
  return isDeviceOn(r) ? "● ᴏɴ-ᴅᴇᴠɪᴄᴇ" : "○ ᴏꜰꜰ-ᴅᴇᴠɪᴄᴇ";
}

function bar(pct, width = 10) {
  const filled = Math.max(0, Math.min(width, Math.round(width * pct / 100)));
  return "●".repeat(filled) + "○".repeat(width - filled);
}

async function getReferralStats(userId) {
  const u = await getUser(userId);
  const active = await redis.scard(`referrals:active:${userId}`);
  return {
    joined: Number(active) || 0,
    points: (u && u.referral_points) || 0,
    redeemedDays: (u && u.referral_redeemed_days) || 0
  };
}

async function recordReferral(referrerId, referredId) {
  if (!referrerId || referrerId === referredId) return;
  const ref = await redis.get(`referral:by:${referredId}`);
  if (ref) return;
  const referrer = await getUser(referrerId);
  if (!referrer) return;
  await redis.hset(`referral:${referredId}`, {
    referrer_id: String(referrerId),
    status: "pending",
    created_at: new Date().toISOString()
  });
  await redis.set(`referral:by:${referredId}`, String(referrerId));
  await redis.hset(`user:${referredId}`, {
    referred_by: String(referrerId),
    referred_at: new Date().toISOString()
  });
}

async function activateReferral(userId) {
  const referrer = await redis.get(`referral:by:${userId}`);
  if (!referrer) return;
  const refData = parseRedisHash(await redis.hgetall(`referral:${userId}`));
  if (!refData || refData.status === "active") return;
  await redis.hset(`referral:${userId}`, {
    status: "active",
    activated_at: new Date().toISOString()
  });
  await redis.sadd(`referrals:${referrer}`, String(userId));
  await redis.sadd(`referrals:active:${referrer}`, String(userId));
  await redis.hincrby(`user:${referrer}`, "referral_points", 1);
  await redis.zincrby("leaderboard:referrals", 1, String(referrer));
}

async function getLeaderboard() {
  const top = await redis.zrange("leaderboard:ready", 0, 9, { rev: true, withScores: true });
  if (!top || top.length === 0) return [];
  const out = [];
  if (typeof top[0] === "object" && top[0] !== null && "member" in top[0]) {
    for (const item of top) {
      const uid = Number(item.member);
      const score = Number(item.score) || 0;
      if (score <= 0) continue;
      const u = await getUser(uid);
      out.push({ user_id: uid, name: (u && u.first_name) || `ᴜꜱᴇʀ ${uid}`, score });
    }
  } else {
    for (let i = 0; i < top.length; i += 2) {
      const uid = Number(top[i]);
      const score = Number(top[i + 1]) || 0;
      if (score <= 0) continue;
      const u = await getUser(uid);
      out.push({ user_id: uid, name: (u && u.first_name) || `ᴜꜱᴇʀ ${uid}`, score });
    }
  }
  return out;
}

function isNonRetryableState(res) {
  if (!res) return false;
  if (res.success) return true;
  const st = String(res.state || "").toUpperCase();
  const err = String(res.error || "").toLowerCase();
  return st === "INVALID_NUMBER" || err.includes("invalid_phone") || err.includes("length_");
}

function callWithTimeout(fn, ms) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), ms);
  });
  return Promise.race([fn(), timeoutPromise]).finally(() => clearTimeout(timer));
}

async function checkSingleSmart(phone, forceFresh = false) {
  const normKey = phone.replace(/^\+/, "");
  const cacheKey = `cache:check:${normKey}`;
  if (!forceFresh && RESULT_CACHE_TTL > 0) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
        if (parsed && parsed.success && parsed.state && parsed.state !== "ERROR" && parsed.state !== "UNKNOWN") {
          return parsed;
        }
      }
    } catch (_) {}
  }

  let lastRes = null;
  for (let attempt = 0; attempt <= CHECK_RETRIES; attempt++) {
    try {
      const res = await callWithTimeout(() => checkPhone(phone), CHECK_TIMEOUT_MS);
      lastRes = res;
      if (res && res.success && res.state && res.state !== "ERROR" && res.state !== "UNKNOWN") {
        if (RESULT_CACHE_TTL > 0) {
          redis.set(cacheKey, JSON.stringify(res), { ex: RESULT_CACHE_TTL }).catch(() => {});
        }
        return res;
      }
      if (isNonRetryableState(res)) return res;
    } catch (e) {
      lastRes = { success: false, phone, error: e && e.message ? e.message : "TIMEOUT" };
    }
    if (attempt < CHECK_RETRIES) {
      const jitter = Math.floor(Math.random() * 120);
      await new Promise(r => setTimeout(r, 150 * (attempt + 1) + jitter));
    }
  }
  return lastRes || { success: false, phone, error: "ɢᴀɢᴀʟ ᴍᴇɴɢʜᴜʙᴜɴɢɪ ꜱᴇʀᴠᴇʀ" };
}

async function triggerEmailSingleSmart(phone) {
  let lastRes = null;
  for (let attempt = 0; attempt <= CHECK_RETRIES; attempt++) {
    try {
      const res = await callWithTimeout(() => triggerEmailVerification(phone), CHECK_TIMEOUT_MS);
      lastRes = res;
      if (res && res.success && res.state && res.state !== "ERROR" && res.state !== "UNKNOWN") {
        return res;
      }
      if (isNonRetryableState(res)) return res;
    } catch (e) {
      lastRes = { success: false, phone, error: e && e.message ? e.message : "TIMEOUT" };
    }
    if (attempt < CHECK_RETRIES) {
      const jitter = Math.floor(Math.random() * 120);
      await new Promise(r => setTimeout(r, 150 * (attempt + 1) + jitter));
    }
  }
  return lastRes || { success: false, phone, error: "ɢᴀɢᴀʟ ᴍᴇɴɢʜᴜʙᴜɴɢɪ ꜱᴇʀᴠᴇʀ" };
}

async function checkAll(numbers, onProgress, options = {}) {
  const forceFresh = Boolean(options.forceFresh);
  const results = new Array(numbers.length);
  let idx = 0, done = 0;
  const adaptivePool = numbers.length >= 8
    ? Math.min(8, Math.max(CONCURRENCY, 5))
    : Math.min(Math.max(1, CONCURRENCY), numbers.length);

  async function worker(workerId) {
    if (workerId > 0) await new Promise(r => setTimeout(r, workerId * 35));
    while (true) {
      const i = idx++;
      if (i >= numbers.length) return;
      results[i] = await checkSingleSmart(numbers[i], forceFresh);
      done++;
      if (onProgress) await onProgress(done, numbers.length, results);
    }
  }
  const workers = Array.from({ length: Math.max(1, adaptivePool) }, (_, w) => worker(w));
  await Promise.all(workers);
  return results;
}

async function triggerEmailAll(numbers, onProgress) {
  const results = new Array(numbers.length);
  let idx = 0, done = 0;
  const adaptivePool = numbers.length >= 8
    ? Math.min(6, Math.max(CONCURRENCY, 4))
    : Math.min(Math.max(1, CONCURRENCY), numbers.length);

  async function worker(workerId) {
    if (workerId > 0) await new Promise(r => setTimeout(r, workerId * 40));
    while (true) {
      const i = idx++;
      if (i >= numbers.length) return;
      results[i] = await triggerEmailSingleSmart(numbers[i]);
      done++;
      if (onProgress) await onProgress(done, numbers.length, results);
    }
  }
  const workers = Array.from({ length: Math.max(1, adaptivePool) }, (_, w) => worker(w));
  await Promise.all(workers);
  return results;
}

async function clearInlinePanel(ctx, userId) {
  const prevInline = activeInlineMsg.get(userId);
  if (prevInline && prevInline.chatId === ctx.chat.id) {
    ctx.telegram.deleteMessage(prevInline.chatId, prevInline.messageId).catch(() => {});
  }
  activeInlineMsg.delete(userId);
}

async function sendFreshKeyboardPanel(ctx, text) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  await clearInlinePanel(ctx, userId);
  const oldKbId = keyboardMsgIds.get(userId);
  const sent = await ctx.reply(text, {
    parse_mode: "HTML",
    ...mainKeyboard(userId)
  });
  keyboardMsgIds.set(userId, sent.message_id);
  if (oldKbId && oldKbId !== sent.message_id) {
    ctx.telegram.deleteMessage(chatId, oldKbId).catch(() => {});
  }
  return sent;
}

async function ensureKeyboardOwner(ctx) {
  const userId = ctx.from.id;
  if (!keyboardMsgIds.has(userId)) {
    const dash = await buildDashboard(userId, ctx.from);
    const sent = await ctx.reply(dash, {
      parse_mode: "HTML",
      ...mainKeyboard(userId)
    });
    keyboardMsgIds.set(userId, sent.message_id);
  }
}

async function showPlainPanel(ctx, text, deleteUserTap = true) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  if (deleteUserTap && ctx.message && ctx.message.message_id) {
    ctx.deleteMessage().catch(() => {});
  }
  await clearInlinePanel(ctx, userId);
  const kbId = keyboardMsgIds.get(userId);
  if (kbId) {
    try {
      await ctx.telegram.editMessageText(chatId, kbId, undefined, text, {
        parse_mode: "HTML"
      });
      return;
    } catch (e) {
      if (String(e.message || "").includes("message is not modified")) return;
    }
  }
  await sendFreshKeyboardPanel(ctx, text);
}

async function showInlinePanel(ctx, text, kb, deleteUserTap = true) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  if (deleteUserTap && ctx.message && ctx.message.message_id) {
    ctx.deleteMessage().catch(() => {});
  }
  await ensureKeyboardOwner(ctx);
  const prevInline = activeInlineMsg.get(userId);
  if (prevInline && prevInline.chatId === chatId) {
    try {
      await ctx.telegram.editMessageText(chatId, prevInline.messageId, undefined, text, {
        parse_mode: "HTML",
        ...kb
      });
      return;
    } catch (e) {
      if (String(e.message || "").includes("message is not modified")) return;
      ctx.telegram.deleteMessage(chatId, prevInline.messageId).catch(() => {});
    }
  }
  const sent = await ctx.reply(text, {
    parse_mode: "HTML",
    ...kb
  });
  activeInlineMsg.set(userId, { chatId, messageId: sent.message_id });
}

async function editInline(ctx, text, kb) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    try {
      await ctx.editMessageText(text, { parse_mode: "HTML", ...kb });
      activeInlineMsg.set(userId, {
        chatId,
        messageId: ctx.callbackQuery.message.message_id
      });
      return;
    } catch (e) {
      if (String(e.message || "").includes("message is not modified")) return;
    }
  }
  await showInlinePanel(ctx, text, kb, false);
}

async function buildDashboard(userId, from = null) {
  const uid = Number(userId);
  const u = from ? await ensureUser(uid, from) : await getUser(uid);
  const isOwner = ADMIN_IDS.includes(uid);
  const premium = await isPremiumUser(uid);
  const used = await getUsed(uid);
  const liveName = from ? [from.first_name, from.last_name].filter(Boolean).join(" ").trim() : "";
  const name = esc(liveName || (u && u.first_name) || "ᴛᴀɴᴘᴀ ɴᴀᴍᴀ");
  const rawUser = cleanUsername(from && from.username) || cleanUsername(u && u.username);
  const username = rawUser ? "@" + esc(rawUser) : "-";
  const access = isOwner ? "ᴏᴡɴᴇʀ ᴀᴄᴄᴇss" : (premium ? "ᴘʀᴇᴍɪᴜᴍ ᴀᴄᴄᴇss" : "ꜰʀᴇᴇ ᴀᴄᴄᴇss");
  const level = isOwner ? "ᴏᴡɴᴇʀ" : (premium ? "ᴘʀᴇᴍɪᴜᴍ" : "ꜰʀᴇᴇ");
  const quota = (isOwner || premium)
    ? "ᴛᴀɴᴘᴀ ʙᴀᴛᴀs"
    : `${Math.max(0, FREE_DAILY_LIMIT - used)} / ${FREE_DAILY_LIMIT}`;
  return [
    "✦ META DETECT ✦",
    "ᴀᴅᴠᴀɴᴄᴇᴅ ᴡʜᴀᴛsᴀᴘᴘ ᴛᴇʟᴇᴍᴇᴛʀʏ",
    "",
    `<blockquote>⚙ sᴛᴀᴛᴜs ᴀᴋᴜɴ`,
    `▸ ɴᴀᴍᴀ ⦂ ${name}`,
    `▸ ᴜsᴇʀ ⦂ ${username}`,
    `▸ ɪᴅ ⦂ ${uid}`,
    `▸ ᴀᴋsᴇs ⦂ ${access}`,
    `▸ ᴋᴜᴏᴛᴀ ⦂ ${quota}`,
    `▸ ᴛᴏᴛᴀʟ ⦂ ${(u && u.total_detections) || 0} ᴅᴇᴛᴇᴋsɪ`,
    `▸ ʟᴇᴠᴇʟ ⦂ ${level}</blockquote>`,
    "",
    "ᴘɪʟɪʜ ᴍᴇɴᴜ ᴅɪ ʙᴀᴡᴀʜ ᴜɴᴛᴜᴋ ᴍᴜʟᴀɪ ᴍᴇɴᴅᴇᴛᴇᴋsɪ, ᴍᴇᴍᴇʀɪᴋsᴀ ᴏᴘsɪ ᴇᴍᴀɪʟ, ᴀᴛᴀᴜ ᴍᴇʟɪʜᴀᴛ sᴛᴀᴛɪsᴛɪᴋ.",
    "",
    "◈ sɪsᴛᴇᴍ ᴀᴋᴛɪꜰ"
  ].join("\n");
}

async function buildDetectPrompt(userId, from = null) {
  const uid = Number(userId);
  await ensureUser(uid, from);
  const isOwner = ADMIN_IDS.includes(uid);
  const premium = await isPremiumUser(uid);
  const used = await getUsed(uid);
  const remaining = Math.max(0, FREE_DAILY_LIMIT - used);
  const accessBadge = isOwner ? "ᴏᴡɴᴇʀ" : (premium ? "ᴘʀᴇᴍɪᴜᴍ" : "ꜰʀᴇᴇ");
  const quotaText = (isOwner || premium)
    ? `ᴛᴀɴᴘᴀ ʙᴀᴛᴀs (${accessBadge})`
    : `ꜱɪꜱᴀ ${remaining} ᴅᴀʀɪ ${FREE_DAILY_LIMIT} ɴᴏᴍᴏʀ`;
  const limitText = (isOwner || premium)
    ? `ᴍᴀᴋsɪᴍᴀʟ ${PREMIUM_BATCH_LIMIT} ɴᴏᴍᴏʀ / ᴋɪʀɪᴍᴀɴ`
    : `ᴍᴀᴋsɪᴍᴀʟ ${remaining} ɴᴏᴍᴏʀ / ᴋɪʀɪᴍᴀɴ`;

  return [
    "⌖ ᴅᴇᴛᴇᴋsɪ ɴᴏᴍᴏʀ ᴡʜᴀᴛsᴀᴘᴘ",
    "",
    "ᴋɪʀɪᴍ ɴᴏᴍᴏʀ ᴛᴀʀɢᴇᴛ ʏᴀɴɢ ɪɴɢɪɴ ᴅɪᴘᴇʀɪᴋsᴀ.",
    "· ᴘɪsᴀʜᴋᴀɴ ᴅᴇɴɢᴀɴ ʙᴀʀɪs ʙᴀʀᴜ ᴀᴛᴀᴜ ᴋᴏᴍᴀ",
    "· sɪsᴛᴇᴍ ᴏᴛᴏᴍᴀᴛɪs ᴍᴇɴɢᴇᴋsᴛʀᴀᴋ ᴀɴɢᴋᴀ",
    "",
    "<blockquote>ᴄᴏɴᴛᴏʜ ⦂",
    "+6281234567890",
    "+6281234567890 (Low) · Jul 2024</blockquote>",
    "",
    `▸ ᴋᴜᴏᴛᴀ ⦂ ${quotaText}`,
    `▸ ʟɪᴍɪᴛ ⦂ ${limitText}`,
    "",
    "ᴋʟɪᴋ ᴅɪ ʙᴀᴡᴀʜ ɪɴɪ ᴜɴᴛᴜᴋ ᴍᴇᴍʙᴀᴛᴀʟᴋᴀɴ."
  ].join("\n");
}

async function buildEmailPrompt(userId, from = null) {
  const uid = Number(userId);
  await ensureUser(uid, from);
  const isOwner = ADMIN_IDS.includes(uid);
  const premium = await isPremiumUser(uid);
  const used = await getUsed(uid);
  const remaining = Math.max(0, FREE_DAILY_LIMIT - used);
  const quotaText = (isOwner || premium) ? "ᴜɴʟɪᴍɪᴛᴇᴅ" : `${remaining}/${FREE_DAILY_LIMIT}`;
  const batchMax = (isOwner || premium) ? PREMIUM_BATCH_LIMIT : remaining;

  return [
    "❖ ᴄᴇᴋ & ᴘɪᴄᴜ ᴏᴘꜱɪ ᴇᴍᴀɪʟ ᴏᴛᴘ",
    "ᴋʜᴜꜱᴜꜱ ɴᴏᴍᴏʀ ʏᴀɴɢ ꜱᴜᴅᴀʜ ᴛᴇʀᴛᴀᴜᴛ ᴀʟᴀᴍᴀᴛ ᴇᴍᴀɪʟ",
    "",
    "<blockquote>⚙ ᴘᴀɴᴅᴜᴀɴ ɪɴᴘᴜᴛ",
    "1. ᴋɪʀɪᴍ ɴᴏᴍᴏʀ ʏᴀɴɢ ɪɴɢɪɴ ᴅɪᴘᴇʀɪᴋsᴀ ᴏᴘsɪ ᴇᴍᴀɪʟɴʏᴀ.",
    "2. ʙɪꜱᴀ 1 ɴᴏᴍᴏʀ ᴀᴛᴀᴜ ʙᴀɴʏᴀᴋ ɴᴏᴍᴏʀ ꜱᴇᴋᴀʟɪɢᴜꜱ.",
    "3. ꜰᴏʀᴍᴀᴛ ɴᴏᴍᴏʀ ⦂ <code>+6281234567890</code></blockquote>",
    "",
    `◈ ꜱɪꜱᴀ ᴋᴜᴏᴛᴀ ⦂ ${quotaText} · ᴍᴀᴋꜱ ${batchMax} ɴᴏᴍᴏʀ`,
    "⟢ ꜱɪʟᴀᴋᴀɴ ᴋɪʀɪᴍ ɴᴏᴍᴏʀ ᴛᴀʀɢᴇᴛ ꜱᴇᴋᴀʀᴀɴɢ."
  ].join("\n");
}

function buildEmailGuidePage() {
  return [
    "ⓘ ᴘᴀɴᴅᴜᴀɴ ᴠᴇʀɪꜰɪᴋᴀꜱɪ ᴇᴍᴀɪʟ",
    "ᴋᴇᴛᴇʀᴀɴɢᴀɴ ꜱᴛᴀᴛᴜꜱ & ᴄᴀʀᴀ ᴍᴇᴍᴜɴᴄᴜʟᴋᴀɴ ᴏᴘꜱɪ ᴇᴍᴀɪʟ",
    "",
    "<blockquote>✦ ᴏᴘꜱɪ ᴇᴍᴀɪʟ ᴛᴇʀꜱᴇᴅɪᴀ",
    "ꜱᴇʀᴠᴇʀ ᴍᴇɴɢᴏɴꜰɪʀᴍᴀꜱɪ ᴏᴘꜱɪ ᴏᴛᴘ ᴇᴍᴀɪʟ ᴀᴋᴛɪꜰ ᴘᴀᴅᴀ ɴᴏᴍᴏʀ ᴛᴇʀꜱᴇʙᴜᴛ.",
    "",
    "◐ ᴊᴇᴅᴀ ᴏᴛᴘ ᴇᴍᴀɪʟ",
    "ᴘᴇʀᴍɪɴᴛᴀᴀɴ ᴋᴏᴅᴇ ᴇᴍᴀɪʟ ꜱᴇᴅᴀɴɢ ᴅɪʙᴀᴛᴀꜱɪ ꜱᴇᴍᴇɴᴛᴀʀᴀ.",
    "",
    "○ ᴏᴘꜱɪ ᴇᴍᴀɪʟ ʙᴇʟᴜᴍ ᴍᴜɴᴄᴜʟ",
    "ꜱᴇʀᴠᴇʀ ᴡʜᴀᴛꜱᴀᴘᴘ ʙᴇʟᴜᴍ ᴍᴇɴᴀᴍᴘɪʟᴋᴀɴ ᴏᴘꜱɪ ᴇᴍᴀɪʟ ᴜɴᴛᴜᴋ ꜱᴇꜱɪ ɪɴɪ.</blockquote>",
    "",
    "<blockquote>⚙ ᴄᴀʀᴀ ᴍᴇᴍᴜɴᴄᴜʟᴋᴀɴ ᴅɪ ᴀᴘʟɪᴋᴀꜱɪ",
    "1. ɢᴜɴᴀᴋᴀɴ ᴡʜᴀᴛꜱᴀᴘᴘ ʀᴇꜱᴍɪ & ᴊᴀʀɪɴɢᴀɴ ɪɴᴛᴇʀɴᴇᴛ ʏᴀɴɢ ꜱᴀᴍᴀ ꜱᴀᴀᴛ ᴍᴇɴᴀᴜᴛᴋᴀɴ ᴇᴍᴀɪʟ.",
    "2. ʜɪɴᴅᴀʀɪ ᴍᴇɴɢᴇᴄᴇᴋ ɴᴏᴍᴏʀ ʙᴇʀᴜʟᴀɴɢ-ᴜʟᴀɴɢ ᴀɢᴀʀ ᴛɪᴅᴀᴋ ᴛᴇʀᴋᴇɴᴀ ꜰɪʟᴛᴇʀ ꜱᴇʀᴠᴇʀ.",
    "3. ᴊɪᴋᴀ ᴛᴇʀᴋᴇɴᴀ ᴊᴇᴅᴀ, ᴛᴜɴɢɢᴜ ʜɪɴɢɢᴀ ᴡᴀᴋᴛᴜ ᴛᴜɴɢɢᴜ ꜱᴇʟᴇꜱᴀɪ ʟᴀʟᴜ ᴄᴏʙᴀ ʟᴀɢɪ ᴅɪ ᴡᴀ ʀᴇꜱᴍɪ.</blockquote>"
  ].join("\n");
}

function buildDetectInfoPage() {
  return [
    "ⓘ ɪɴꜰᴏʀᴍᴀꜱɪ ʜᴀꜱɪʟ ᴅᴇᴛᴇᴋꜱɪ",
    "ᴘᴀɴᴅᴜᴀɴ ꜱᴛᴀᴛᴜꜱ ɴᴏᴍᴏʀ & ᴘᴇʀᴀɴɢᴋᴀᴛ ᴡʜᴀᴛꜱᴀᴘᴘ",
    "",
    "<blockquote>✧ ꜱɪᴀᴘ ᴅɪᴠᴇʀɪꜰɪᴋᴀꜱɪ",
    "ɴᴏᴍᴏʀ ʙᴇʀꜱɪʜ ᴅᴀɴ ꜱɪᴀᴘ ᴍᴇɴᴇʀɪᴍᴀ ᴋᴏᴅᴇ ᴏᴛᴘ ᴠᴇʀɪꜰɪᴋᴀꜱɪ.",
    "",
    "◐ ᴄᴏᴏʟᴅᴏᴡɴ ᴡʜᴀᴛꜱᴀᴘᴘ",
    "ᴘᴇʀᴍɪɴᴛᴀᴀɴ ᴏᴛᴘ ᴅɪʙᴀᴛᴀꜱɪ ꜱᴇᴍᴇɴᴛᴀʀᴀ ꜱᴇꜱᴜᴀɪ ᴅᴜʀᴀꜱɪ ᴡᴀᴋᴛᴜ.",
    "",
    "△ ᴛɪᴅᴀᴋ ꜱᴜᴘᴘᴏʀᴛ ᴄʟᴏɴᴇ",
    "ɴᴏᴍᴏʀ ᴅɪʙᴀᴛᴀꜱɪ ᴜɴᴛᴜᴋ ᴀᴘʟɪᴋᴀꜱɪ ᴄʟᴏɴᴇ / ᴍᴏᴅɪꜰɪᴋᴀꜱɪ.",
    "",
    "✕ ᴅɪʙᴀᴛᴀꜱɪ (ʙᴀɴɴᴇᴅ)",
    "ɴᴏᴍᴏʀ ᴅᴀʟᴀᴍ ꜱᴛᴀᴛᴜꜱ ᴅɪʙʟᴏᴋɪʀ ᴅᴀʀɪ ʟᴀʏᴀɴᴀɴ ᴡʜᴀᴛꜱᴀᴘᴘ.</blockquote>",
    "",
    "<blockquote>● ᴏɴ-ᴅᴇᴠɪᴄᴇ (ᴡᴀ_ᴏʟᴅ)",
    "ɴᴏᴍᴏʀ ᴛᴇʀᴅᴀꜰᴛᴀʀ & ᴀᴋᴛɪꜰ ʟᴏɢɪɴ ᴘᴀᴅᴀ ᴘᴇʀᴀɴɢᴋᴀᴛ ᴡʜᴀᴛꜱᴀᴘᴘ.",
    "",
    "○ ᴏꜰꜰ-ᴅᴇᴠɪᴄᴇ",
    "ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴘᴇʀᴀɴɢᴋᴀᴛ ᴡʜᴀᴛꜱᴀᴘᴘ ᴀᴋᴛɪꜰ ʏᴀɴɢ ᴛᴇʀᴅᴀꜰᴛᴀʀ.</blockquote>"
  ].join("\n");
}

async function buildStatusPage(userId, from = null) {
  const uid = Number(userId);
  const u = from ? await ensureUser(uid, from) : await getUser(uid);
  const isOwner = ADMIN_IDS.includes(uid);
  const premium = await isPremiumUser(uid);
  const access = isOwner ? "ᴏᴡɴᴇʀ ᴀᴄᴄᴇss" : (premium ? "ᴘʀᴇᴍɪᴜᴍ ᴀᴄᴄᴇss" : "ꜰʀᴇᴇ ᴀᴄᴄᴇss");
  const quota = (isOwner || premium) ? "ᴛᴀɴᴘᴀ ʙᴀᴛᴀꜱ" : `${Math.max(0, FREE_DAILY_LIMIT - await getUsed(uid))} / ${FREE_DAILY_LIMIT}`;
  const activeDate = isOwner ? "ᴘᴇʀᴍᴀɴᴇɴᴛ" : (premium && u && u.premium_until ? formatWIB(u.premium_until) : formatWIB(u && u.created_at));
  const ref = await getReferralStats(uid);
  const liveName = from ? [from.first_name, from.last_name].filter(Boolean).join(" ").trim() : "";
  const rawUser = cleanUsername(from && from.username) || cleanUsername(u && u.username);
  return [
    "◈ ʀɪɴɢᴋᴀꜱᴀɴ ꜱᴛᴀᴛᴜꜱ ᴀᴋᴜɴ",
    "ɪɴꜰᴏʀᴍᴀꜱɪ ᴋᴇᴀɴɢɢᴏᴛᴀᴀɴ & ᴀᴋᴛɪᴠɪᴛᴀꜱ",
    "",
    `<blockquote>⚙ ᴘʀᴏꜰɪʟ ᴀᴋᴜɴ`,
    `▸ ɴᴀᴍᴀ ⦂ ${esc(liveName || (u && u.first_name) || "ᴛᴀɴᴘᴀ ɴᴀᴍᴀ")}`,
    `▸ ᴜsᴇʀ ⦂ ${rawUser ? "@" + esc(rawUser) : "-"}`,
    `▸ ɪᴅ ⦂ ${uid}`,
    `▸ ᴀᴋꜱᴇꜱ ⦂ ${access}`,
    `▸ ᴋᴜᴏᴛᴀ ⦂ ${quota}`,
    `▸ ᴛᴏᴛᴀʟ ᴅᴇᴛᴇᴋꜱɪ ⦂ ${(u && u.total_detections) || 0} ɴᴏᴍᴏʀ`,
    `▸ ᴄᴇᴋ ᴇᴍᴀɪʟ ⦂ ${(u && u.email_triggers) || 0} ɴᴏᴍᴏʀ`,
    `▸ ᴍᴀꜱᴀ ᴀᴋᴛɪꜰ ⦂ ${activeDate}</blockquote>`,
    "",
    `<blockquote>❖ ᴘʀᴏɢʀᴀᴍ ʀᴇꜰᴇʀᴀʟ`,
    `▸ ᴛᴇᴍᴀɴ ʙᴇʀɢᴀʙᴜɴɢ ⦂ ${ref.joined}`,
    `▸ ᴘᴏɪɴ ᴛᴇʀᴋᴜᴍᴘᴜʟ ⦂ ${ref.points}`,
    `▸ ʜᴀᴅɪᴀʜ ᴅɪᴛᴇʀɪᴍᴀ ⦂ ${ref.redeemedDays} ʜᴀʀɪ ᴘʀᴇᴍɪᴜᴍ</blockquote>`,
    "",
    "◈ ꜱɪꜱᴛᴇᴍ ᴀᴋᴛɪꜰ"
  ].join("\n");
}

function buildPremiumPage() {
  const planLines = [];
  for (let i = 0; i < PLANS.length; i++) {
    const p = PLANS[i];
    const perDay = Math.round(p.price / p.days);
    planLines.push(`${p.icon} ${p.days} ʜᴀʀɪ — ${formatRp(p.price)} · ${p.badge}`);
    planLines.push(`   ꜱᴇᴛᴀʀᴀ ${formatRp(perDay)} / ʜᴀʀɪ`);
    if (i < PLANS.length - 1) planLines.push("");
  }
  return [
    "♛ ᴍᴇᴛᴀ ᴅᴇᴛᴇᴄᴛ ᴘʀᴇᴍɪᴜᴍ",
    "ᴀᴋꜱᴇꜱ ᴘʀᴇᴍɪᴜᴍ ᴜɴᴛᴜᴋ ᴘᴇɴɢɢᴜɴᴀᴀɴ ʟᴇʙɪʜ ʟᴇʟᴜᴀꜱᴀ.",
    "",
    "✦ ᴋᴇᴜɴɢɢᴜʟᴀɴ ᴘʀᴇᴍɪᴜᴍ",
    "· ᴋᴜᴏᴛᴀ ᴘᴇᴍᴇʀɪᴋꜱᴀᴀɴ ᴛᴀɴᴘᴀ ʙᴀᴛᴀꜱ ʜᴀʀɪᴀɴ",
    "· ʙᴀᴛᴄʜ ʜɪɴɢɢᴀ 30 ɴᴏᴍᴏʀ ᴅᴀʟᴀᴍ ꜱᴀᴛᴜ ᴋɪʀɪᴍᴀɴ",
    "· ᴘʀɪᴏʀɪᴛᴀꜱ ᴀᴋꜱᴇꜱ ꜰɪᴛᴜʀ ꜱᴇʟᴀᴍᴀ ᴍᴀꜱᴀ ᴀᴋᴛɪꜰ",
    "",
    `<blockquote>${planLines.join("\n")}</blockquote>`,
    "",
    "ᴘɪʟɪʜ ᴘᴀᴋᴇᴛ ᴍᴇʟᴀʟᴜɪ ᴛᴏᴍʙᴏʟ ᴅɪ ʙᴀᴡᴀʜ."
  ].join("\n");
}

function buildPremiumKeyboard() {
  return inlineKb([
    [
      btn(`${PLANS[0].icon} ${PLANS[0].days} ʜᴀʀɪ · ${formatRp(PLANS[0].price)}`, `buy_${PLANS[0].id}`, PLANS[0].style),
      btn(`${PLANS[1].icon} ${PLANS[1].days} ʜᴀʀɪ · ${formatRp(PLANS[1].price)}`, `buy_${PLANS[1].id}`, PLANS[1].style)
    ],
    [
      btn(`${PLANS[2].icon} ${PLANS[2].days} ʜᴀʀɪ · ${formatRp(PLANS[2].price)}`, `buy_${PLANS[2].id}`, PLANS[2].style),
      btn(`${PLANS[3].icon} ${PLANS[3].days} ʜᴀʀɪ · ${formatRp(PLANS[3].price)}`, `buy_${PLANS[3].id}`, PLANS[3].style)
    ],
    [
      btn(`${PLANS[4].icon} ${PLANS[4].days} ʜᴀʀɪ · ${formatRp(PLANS[4].price)}`, `buy_${PLANS[4].id}`, PLANS[4].style)
    ]
  ]);
}

async function buildReferralPage(userId) {
  const ref = await getReferralStats(userId);
  const link = `https://t.me/${BOT_USERNAME}?start=ref_${userId}`;
  return [
    "⌬ ᴘʀᴏɢʀᴀᴍ ʀᴇꜰᴇʀᴀʟ",
    "",
    "◈ ᴜɴᴅᴀɴɢ ᴛᴇᴍᴀɴ & ᴅᴀᴘᴀᴛᴋᴀɴ ᴘᴏɪɴ",
    "  ⊹ 1 ᴛᴇᴍᴀɴ ᴀᴋᴛɪꜰ ⦂ +1 ᴘᴏɪɴ",
    "  ⊹ ᴛᴜᴋᴀʀ ᴘᴏɪɴ ᴍᴇɴᴊᴀᴅɪ ᴘʀᴇᴍɪᴜᴍ",
    "",
    `<blockquote>⟐ sᴛᴀᴛɪsᴛɪᴋ ᴀɴᴅᴀ`,
    `  ▸ ᴛᴇᴍᴀɴ ʙᴇʀɢᴀʙᴜɴɢ ⦂ ${ref.joined}`,
    `  ▸ ᴘᴏɪɴ ᴛᴇʀᴋᴜᴍᴘᴜʟ ⦂ ${ref.points}`,
    `  ▸ ʜᴀᴅɪᴀʜ ᴅɪᴛᴇʀɪᴍᴀ ⦂ ${ref.redeemedDays} ʜᴀʀɪ ᴘʀᴇᴍɪᴜᴍ</blockquote>`,
    "",
    "⌲ ʟɪɴᴋ ʀᴇꜰᴇʀᴀʟ",
    `<blockquote><code>${esc(link)}</code></blockquote>`
  ].join("\n");
}

function buildReferralKeyboard(userId) {
  const link = `https://t.me/${BOT_USERNAME}?start=ref_${userId}`;
  const shareText = "✦ META DETECT — Cek status nomor WhatsApp secara real-time!";
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
  return inlineKb([
    [
      btn("❖ ᴛᴜᴋᴀʀ ᴘᴏɪɴ", "rewards", "success"),
      urlBtn("⌲ ʙᴀɢɪᴋᴀɴ ᴛᴀᴜᴛᴀɴ", shareUrl, "primary")
    ]
  ]);
}

async function buildRewardsPage(userId) {
  const ref = await getReferralStats(userId);
  const rewardLines = REWARDS.map(r => {
    const ok = ref.points >= r.pts;
    return `${ok ? "✦" : "○"} ${r.pts} ᴘᴛ → ${r.days} ʜᴀʀɪ ᴘʀᴇᴍɪᴜᴍ`;
  });
  return [
    "❖ ᴛᴜᴋᴀʀ ᴘᴏɪɴ ʀᴇꜰᴇʀᴀʟ",
    "",
    `⟐ ᴘᴏɪɴ ᴀɴᴅᴀ ⦂ ${ref.points} ᴘᴛ`,
    "",
    `<blockquote>${rewardLines.join("\n")}</blockquote>`,
    "",
    "ᴘɪʟɪʜ ᴘᴀᴋᴇᴛ ᴘᴇɴᴜᴋᴀʀᴀɴ ᴅɪ ʙᴀᴡᴀʜ."
  ].join("\n");
}

function buildRewardsKeyboard(points) {
  const st = (pts) => (points >= pts ? "success" : "primary");
  const mk = (pts) => (points >= pts ? " ✓" : "");
  return inlineKb([
    [
      btn(`${REWARDS[0].pts} ᴘᴛ → ${REWARDS[0].days} ʜᴀʀɪ${mk(REWARDS[0].pts)}`, "redeem_0", st(REWARDS[0].pts)),
      btn(`${REWARDS[1].pts} ᴘᴛ → ${REWARDS[1].days} ʜᴀʀɪ${mk(REWARDS[1].pts)}`, "redeem_1", st(REWARDS[1].pts))
    ],
    [
      btn(`${REWARDS[2].pts} ᴘᴛ → ${REWARDS[2].days} ʜᴀʀɪ${mk(REWARDS[2].pts)}`, "redeem_2", st(REWARDS[2].pts)),
      btn(`${REWARDS[3].pts} ᴘᴛ → ${REWARDS[3].days} ʜᴀʀɪ${mk(REWARDS[3].pts)}`, "redeem_3", st(REWARDS[3].pts))
    ],
    [
      btn(`${REWARDS[4].pts} ᴘᴛ → ${REWARDS[4].days} ʜᴀʀɪ${mk(REWARDS[4].pts)}`, "redeem_4", st(REWARDS[4].pts))
    ],
    [
      btn("⟢ ᴋᴇᴍʙᴀʟɪ", "referral", "danger")
    ]
  ]);
}

async function buildLeaderboardPage(userId) {
  const rows = await getLeaderboard();
  const my = await getUser(userId);
  const myScore = (my && my.ready_detections) || 0;
  const rankLines = [];
  if (rows.length === 0) {
    rankLines.push("⟡ ʙᴇʟᴜᴍ ᴀᴅᴀ ᴅᴀᴛᴀ ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ");
  } else {
    rows.forEach((r, i) => {
      const rank = String(i + 1).padStart(2, " ");
      const tag = r.user_id === userId ? " ◂ ᴀɴᴅᴀ" : "";
      rankLines.push(`⟢ #${rank} ${esc(r.name)} ⦂ ${r.score} ʀᴇᴀᴅʏ${tag}`);
    });
  }
  return [
    "♛ ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ ᴛᴏᴘ 10",
    "ᴘᴇɴɢɢᴜɴᴀ ᴅᴇɴɢᴀɴ ꜱᴛᴀᴛᴜꜱ ꜱɪᴀᴘ ᴅɪᴠᴇʀɪꜰɪᴋᴀꜱɪ ᴛᴇʀʙᴀɴʏᴀᴋ",
    "",
    `<blockquote>${rankLines.join("\n")}</blockquote>`,
    "",
    "⚙ ꜱᴛᴀᴛɪꜱᴛɪᴋ ᴀɴᴅᴀ",
    `▸ ʀᴇᴀᴅʏ ᴅɪᴠᴇʀɪꜰɪᴋᴀꜱɪ ⦂ ${myScore}`
  ].join("\n");
}

async function buildPaymentInvoice(userId, plan, inv) {
  const paymentInfo = await getSetting("payment_info", process.env.PAYMENT_INFO || "ʜᴜʙᴜɴɢɪ ᴀᴅᴍɪɴ ᴜɴᴛᴜᴋ ɪɴꜰᴏ ᴘᴇᴍʙᴀʏᴀʀᴀɴ");
  const contact = await getSetting("admin_contact", process.env.ADMIN_CONTACT || "@admin");
  return [
    "✦ ᴅᴇᴛᴀɪʟ ᴛᴀɢɪʜᴀɴ",
    "",
    `<blockquote>⟡ ɪɴᴠᴏɪᴄᴇ ⦂ <code>${esc(inv)}</code>`,
    `⊹ ᴘᴀᴋᴇᴛ ⦂ ${plan.days} ʜᴀʀɪ · ${plan.badge}`,
    `⊹ ʜᴀʀɢᴀ ⦂ ${formatRp(plan.price)}</blockquote>`,
    "",
    "⚙ ɪɴꜱᴛʀᴜᴋꜱɪ ᴘᴇᴍʙᴀʏᴀʀᴀɴ",
    `<blockquote>${esc(paymentInfo)}</blockquote>`,
    "",
    "⟢ ᴋɪʀɪᴍ ʙᴜᴋᴛɪ ᴘᴇᴍʙᴀʏᴀʀᴀɴ (ꜰᴏᴛᴏ) ᴋᴇ ʙᴏᴛ ɪɴɪ",
    `⊹ ᴋᴏɴᴛᴀᴋ ᴀᴅᴍɪɴ ⦂ ${esc(contact)}`
  ].join("\n");
}

async function buildAdminPanel(userId) {
  if (!ADMIN_IDS.includes(Number(userId))) return null;
  const allIds = await getAllUserIds();
  let activePremCount = 0;
  let totalDetectionsAll = 0;
  let totalReadyAll = 0;
  let totalEmailAll = 0;
  const now = Date.now();
  for (const uid of allIds) {
    const u = await getUser(Number(uid));
    if (!u) continue;
    totalDetectionsAll += u.total_detections || 0;
    totalReadyAll += u.ready_detections || 0;
    totalEmailAll += u.email_triggers || 0;
    if (u.premium_until && new Date(u.premium_until).getTime() > now) {
      activePremCount++;
    }
  }
  const pending = Number(await redis.scard("payments:pending")) || 0;
  return [
    "⚙ ᴀᴅᴍɪɴ ᴘᴀɴᴇʟ",
    "ᴘᴜꜱᴀᴛ ᴋᴏɴᴛʀᴏʟ & ᴍᴀɴᴀᴊᴇᴍᴇɴ ʙᴏᴛ",
    "",
    `<blockquote>⟐ ꜱᴛᴀᴛɪꜱᴛɪᴋ ꜱɪꜱᴛᴇᴍ`,
    `  ▸ ᴛᴏᴛᴀʟ ᴜꜱᴇʀ ⦂ ${allIds.length} ᴘᴇɴɢɢᴜɴᴀ`,
    `  ▸ ᴜꜱᴇʀ ᴘʀᴇᴍɪᴜᴍ ⦂ ${activePremCount} ᴀᴋᴛɪꜰ`,
    `  ▸ ᴛᴀɢɪʜᴀɴ ᴘᴇɴᴅɪɴɢ ⦂ ${pending} ɪɴᴠᴏɪᴄᴇ`,
    `  ▸ ᴛᴏᴛᴀʟ ᴅᴇᴛᴇᴋꜱɪ ⦂ ${totalDetectionsAll} ɴᴏᴍᴏʀ`,
    `  ▸ ᴛᴏᴛᴀʟ ʀᴇᴀᴅʏ ⦂ ${totalReadyAll} ɴᴏᴍᴏʀ`,
    `  ▸ ᴄᴇᴋ ᴇᴍᴀɪʟ ⦂ ${totalEmailAll} ɴᴏᴍᴏʀ</blockquote>`,
    "",
    "ᴘɪʟɪʜ ᴍᴇɴᴜ ᴘᴇɴɢᴀᴛᴜʀᴀɴ ᴅɪ ʙᴀᴡᴀʜ."
  ].join("\n");
}

function buildAdminKeyboard() {
  return inlineKb([
    [
      btn("⟡ ᴛᴀɢɪʜᴀɴ ᴘᴇɴᴅɪɴɢ", "adm_pay", "primary"),
      btn("⌲ ʙʀᴏᴀᴅᴄᴀꜱᴛ", "adm_bc", "primary")
    ],
    [
      btn("✦ ᴀᴅᴅ ᴘʀᴇᴍɪᴜᴍ", "adm_addprem", "success"),
      btn("✕ ᴅᴇʟ ᴘʀᴇᴍɪᴜᴍ", "adm_delprem", "danger")
    ],
    [
      btn("♛ ʟɪꜱᴛ ᴘʀᴇᴍɪᴜᴍ", "adm_premlist", "primary"),
      btn("⊹ ɪɴꜰᴏ ᴘᴀʏᴍᴇɴᴛ", "adm_setpay", "primary")
    ],
    [
      btn("⊹ ᴋᴏɴᴛᴀᴋ ᴀᴅᴍɪɴ", "adm_setcontact", "primary"),
      btn("✕ ᴛᴜᴛᴜᴘ ᴘᴀɴᴇʟ", "adm_close", "danger")
    ]
  ]);
}

function splitBlocksIntoChunks(blocks, maxLen = 3800) {
  const chunks = [];
  let cur = "";
  for (const block of blocks) {
    if (!cur) {
      cur = block;
    } else if ((cur + "\n\n" + block).length > maxLen) {
      chunks.push(cur);
      cur = block;
    } else {
      cur += "\n\n" + block;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function summarizeProgress(results, total) {
  let ready = 0, cooldown = 0, clone = 0, banned = 0, failed = 0, done = 0;
  let devOn = 0, devOff = 0;
  for (const r of results) {
    if (!r) continue;
    done++;
    if (!r.success) { failed++; continue; }
    const st = r.state || "UNKNOWN";
    if (st === "ERROR" || st === "INVALID_NUMBER" || st === "UNKNOWN") { failed++; continue; }
    if (isDeviceOn(r)) devOn++;
    else devOff++;
    if (r.isBanned) { banned++; continue; }
    if (r.isCloneBlocked) { clone++; continue; }
    if (r.isCooldown) { cooldown++; continue; }
    if (r.isReady) { ready++; continue; }
    failed++;
  }
  const pct = total > 0 ? Math.round(done * 100 / total) : 0;
  const lines = [
    "✦ ᴘᴇᴍᴇʀɪᴋꜱᴀᴀɴ ʙᴇʀᴊᴀʟᴀɴ",
    "",
    `<blockquote>◈ ${bar(pct)} ${pct}%`,
    `⟡ ᴘʀᴏɢʀᴇꜱ ⦂ ${done} / ${total} ɴᴏᴍᴏʀ`,
    `✧ ꜱɪᴀᴘ ⦂ ${ready} · ◐ ᴄᴏᴏʟᴅᴏᴡɴ ⦂ ${cooldown}`,
    `△ ᴄʟᴏɴᴇ ⦂ ${clone} · ✕ ʙᴀɴɴᴇᴅ ⦂ ${banned}`,
    `● ᴏɴ-ᴅᴇᴠɪᴄᴇ ⦂ ${devOn} · ○ ᴏꜰꜰ-ᴅᴇᴠɪᴄᴇ ⦂ ${devOff}`
  ];
  if (failed > 0) lines.push(`⚠ ɢᴀɢᴀʟ ⦂ ${failed}`);
  lines[lines.length - 1] += "</blockquote>";
  return lines.join("\n");
}

function summarizeEmailProgress(results, total) {
  let eligible = 0, unavailable = 0, done = 0;
  for (const r of results) {
    if (!r) continue;
    done++;
    if (!r.success || r.emailStatus === "BANNED") { unavailable++; continue; }
    if (r.emailStatus === "ELIGIBLE") {
      eligible++;
    } else {
      unavailable++;
    }
  }
  const pct = total > 0 ? Math.round(done * 100 / total) : 0;
  return [
    "❖ ᴍᴇᴍᴇʀɪᴋꜱᴀ ᴏᴘꜱɪ ᴇᴍᴀɪʟ",
    "",
    `<blockquote>◈ ${bar(pct)} ${pct}%`,
    `▸ ᴛᴇʀᴘʀᴏꜱᴇꜱ ⦂ ${done} / ${total} ɴᴏᴍᴏʀ`,
    `▸ ᴇᴍᴀɪʟ ᴛᴇʀꜱᴇᴅɪᴀ ⦂ ${eligible} · ʙᴇʟᴜᴍ ᴍᴜɴᴄᴜʟ ⦂ ${unavailable}</blockquote>`
  ].join("\n");
}

function buildDetectionOutput(numbers, results, elapsedSec = null) {
  const ready = [], cooldown = [], clone = [], banned = [], errors = [];
  let devOn = 0, devOff = 0;

  results.forEach((r, i) => {
    const fb = numbers[i];
    if (!r) {
      errors.push({ phone: fb, error: "ɴᴏ ʀᴇꜱᴘᴏɴꜱᴇ" });
      return;
    }
    if (!r.success) {
      errors.push({ phone: r.phone || fb, error: r.error || "ɢᴀɢᴀʟ" });
      return;
    }
    const st = r.state || "UNKNOWN";
    if (st === "ERROR" || st === "INVALID_NUMBER" || st === "UNKNOWN") {
      errors.push({ phone: r.phone || fb, error: r.description || st });
      return;
    }
    if (isDeviceOn(r)) devOn++;
    else devOff++;

    if (r.isBanned) { banned.push(r); return; }
    if (r.isCloneBlocked) { clone.push(r); return; }
    if (r.isCooldown) { cooldown.push(r); return; }
    if (r.isReady) { ready.push(r); return; }
    errors.push({ phone: r.phone || fb, error: `ꜱᴛᴀᴛᴇ=${st}` });
  });

  const summaryLines = [
    "✦ ᴘᴇᴍᴇʀɪᴋꜱᴀᴀɴ ꜱᴇʟᴇꜱᴀɪ",
    "",
    `<blockquote>◈ ${bar(100)} 100%`,
    `⟡ ᴘʀᴏɢʀᴇꜱ ⦂ ${numbers.length} / ${numbers.length} ɴᴏᴍᴏʀ`,
    `✧ ꜱɪᴀᴘ ᴅɪᴠᴇʀɪꜰɪᴋᴀꜱɪ ⦂ ${ready.length}`,
    `◐ ᴄᴏᴏʟᴅᴏᴡɴ ⦂ ${cooldown.length}`,
    `△ ᴛɪᴅᴀᴋ ꜱᴜᴘᴘᴏʀᴛ ᴄʟᴏɴᴇ ⦂ ${clone.length}`,
    `✕ ᴅɪʙᴀᴛᴀꜱɪ ⦂ ${banned.length}`,
    `● ᴏɴ-ᴅᴇᴠɪᴄᴇ ⦂ ${devOn} · ○ ᴏꜰꜰ-ᴅᴇᴠɪᴄᴇ ⦂ ${devOff}`
  ];
  if (errors.length) summaryLines.push(`⚠ ɢᴀɢᴀʟ ⦂ ${errors.length}`);
  summaryLines[summaryLines.length - 1] += "</blockquote>";
  summaryLines.push("");
  summaryLines.push("⌖ ʜᴀꜱɪʟ ᴅᴇᴛᴇᴋꜱɪ");

  const blocks = [summaryLines.join("\n")];

  if (ready.length) {
    const items = ready.map(r => `⟢ <code>${esc(r.phone)}</code> ⦂ ꜱɪᴀᴘ · ${deviceBadge(r)}`);
    blocks.push(`✧ ꜱɪᴀᴘ ᴅɪᴠᴇʀɪꜰɪᴋᴀꜱɪ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (cooldown.length) {
    const items = cooldown.map(r => `⟢ <code>${esc(r.phone)}</code> ⦂ ${displayCD(r)} · ${deviceBadge(r)}`);
    blocks.push(`◐ ᴄᴏᴏʟᴅᴏᴡɴ ᴡʜᴀᴛꜱᴀᴘᴘ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (clone.length) {
    const items = clone.map(r => `⟢ <code>${esc(r.phone)}</code> ⦂ ${cloneStatusLabel(r)} · ${deviceBadge(r)}`);
    blocks.push(`△ ᴛɪᴅᴀᴋ ꜱᴜᴘᴘᴏʀᴛ ᴄʟᴏɴᴇ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (banned.length) {
    const items = banned.map(r => `⟢ <code>${esc(r.phone)}</code> ⦂ ${deviceBadge(r)}`);
    blocks.push(`✕ ᴅɪʙᴀᴛᴀꜱɪ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (errors.length) {
    const items = errors.map(e => `⟢ <code>${esc(e.phone)}</code> ⦂ ${esc(e.error)}`);
    blocks.push(`⚠ ɢᴀɢᴀʟ ᴅɪᴘᴇʀɪᴋꜱᴀ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (elapsedSec !== null) {
    blocks.push(`⚡ ᴡᴀᴋᴛᴜ ⦂ ${elapsedSec}ᴅ`);
  }

  return {
    readyCount: ready.length,
    chunks: splitBlocksIntoChunks(blocks, 3800)
  };
}

function buildEmailOutput(numbers, results, elapsedSec = null) {
  const eligible = [], wait = [], unavailable = [], banned = [], errors = [];
  let devOn = 0, devOff = 0;

  results.forEach((r, i) => {
    const fb = numbers[i];
    if (!r) {
      errors.push({ phone: fb, error: "ɴᴏ ʀᴇꜱᴘᴏɴꜱᴇ" });
      return;
    }
    if (!r.success) {
      errors.push({ phone: r.phone || fb, error: r.error || "ɢᴀɢᴀʟ" });
      return;
    }
    if (isDeviceOn(r)) devOn++;
    else devOff++;

    if (r.emailStatus === "BANNED") { banned.push(r); return; }
    if (r.emailStatus === "WAIT") { wait.push(r); return; }
    if (r.emailStatus === "ELIGIBLE") { eligible.push(r); return; }
    unavailable.push(r);
  });

  const summaryRows = [
    `▸ ᴛᴏᴛᴀʟ ᴛᴀʀɢᴇᴛ ⦂ ${numbers.length} ɴᴏᴍᴏʀ`,
    `▸ ᴇᴍᴀɪʟ ᴛᴇʀꜱᴇᴅɪᴀ ⦂ ${eligible.length} ɴᴏᴍᴏʀ`
  ];
  if (wait.length > 0) {
    summaryRows.push(`▸ ᴊᴇᴅᴀ ᴏᴛᴘ ᴇᴍᴀɪʟ ⦂ ${wait.length} ɴᴏᴍᴏʀ`);
  }
  if (unavailable.length > 0) {
    summaryRows.push(`▸ ʙᴇʟᴜᴍ ᴍᴜɴᴄᴜʟ ⦂ ${unavailable.length} ɴᴏᴍᴏʀ`);
  }
  if (banned.length + errors.length > 0) {
    summaryRows.push(`▸ ᴛᴇʀᴋᴇɴᴅᴀʟᴀ ⦂ ${banned.length + errors.length} ɴᴏᴍᴏʀ`);
  }
  summaryRows.push(`▸ ᴘᴇʀᴀɴɢᴋᴀᴛ ⦂ ${devOn} ᴏɴ · ${devOff} ᴏꜰꜰ`);

  const blocks = [
    [
      "✦ ꜱᴛᴀᴛᴜꜱ ᴠᴇʀɪꜰɪᴋᴀꜱɪ ᴇᴍᴀɪʟ",
      "ʀɪɴɢᴋᴀꜱᴀɴ ᴋᴇᴛᴇʀꜱᴇᴅɪᴀᴀɴ ᴏᴘꜱɪ ᴏᴛᴘ ᴇᴍᴀɪʟ",
      "",
      `<blockquote>${summaryRows.join("\n")}</blockquote>`
    ].join("\n")
  ];

  if (eligible.length) {
    const items = eligible.map(r => {
      const mailInfo = r.maskedEmail ? `<code>${esc(r.maskedEmail)}</code>` : "ᴏᴘꜱɪ ᴇᴍᴀɪʟ ᴛᴇʀꜱᴇᴅɪᴀ";
      return `⟢ <code>${esc(r.phone)}</code> ⦂ ${mailInfo} · ${deviceBadge(r)}`;
    });
    blocks.push(`✦ ᴏᴘꜱɪ ᴇᴍᴀɪʟ ᴛᴇʀꜱᴇᴅɪᴀ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (wait.length) {
    const items = wait.map(r => `⟢ <code>${esc(r.phone)}</code> ⦂ ᴛᴜɴɢɢᴜ ${formatCooldown(r.emailWaitSeconds)} · ${deviceBadge(r)}`);
    blocks.push(`◐ ᴊᴇᴅᴀ ᴏᴛᴘ ᴇᴍᴀɪʟ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (unavailable.length) {
    const items = unavailable.map(r => `⟢ <code>${esc(r.phone)}</code> ⦂ ᴏᴘꜱɪ ᴇᴍᴀɪʟ ʙᴇʟᴜᴍ ᴍᴜɴᴄᴜʟ · ${deviceBadge(r)}`);
    blocks.push(`○ ᴏᴘꜱɪ ᴇᴍᴀɪʟ ʙᴇʟᴜᴍ ᴍᴜɴᴄᴜʟ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (banned.length) {
    const items = banned.map(r => `⟢ <code>${esc(r.phone)}</code> ⦂ ʙᴀɴɴᴇᴅ · ${deviceBadge(r)}`);
    blocks.push(`✕ ᴀᴋᴜɴ ᴅɪʙᴀᴛᴀꜱɪ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (errors.length) {
    const items = errors.map(e => `⟢ <code>${esc(e.phone)}</code> ⦂ ${esc(e.error)}`);
    blocks.push(`⚠ ɢᴀɢᴀʟ ᴅɪᴘʀᴏꜱᴇꜱ\n<blockquote>${items.join("\n")}</blockquote>`);
  }

  if (eligible.length > 0) {
    blocks.push("ⓘ ʙᴜᴋᴀ ᴡᴀ ʀᴇꜱᴍɪ → <b>ᴛɪᴅᴀᴋ ᴍᴇɴᴇʀɪᴍᴀ ᴋᴏᴅᴇ?</b> → <b>ᴋɪʀɪᴍ ᴇᴍᴀɪʟ</b>");
  } else if (unavailable.length > 0 || wait.length > 0) {
    blocks.push("ⓘ ᴏᴘꜱɪ ᴇᴍᴀɪʟ ʜᴀɴʏᴀ ᴍᴜɴᴄᴜʟ ᴅɪ ᴡᴀ ʀᴇꜱᴍɪ ᴘᴀᴅᴀ ᴘᴇʀᴀɴɢᴋᴀᴛ/ɪᴘ ʏᴀɴɢ ᴛᴇʀᴠᴇʀɪꜰɪᴋᴀꜱɪ (ᴛᴀᴘ <b>ⓘ ᴘᴀɴᴅᴜᴀɴ</b>)");
  }

  if (elapsedSec !== null) {
    blocks.push(`⚡ ꜱᴇʟᴇꜱᴀɪ ᴅᴀʟᴀᴍ ${elapsedSec}ᴅ`);
  }

  return {
    chunks: splitBlocksIntoChunks(blocks, 3800)
  };
}

function buildResultKeyboard(batchId) {
  return inlineKb([
    [
      btn("↻ ᴜᴘᴅᴀᴛᴇ", `det_upd_${batchId}`, "primary"),
      btn("ⓘ ɪɴꜰᴏ", `det_info_${batchId}`, "primary")
    ]
  ]);
}

function buildEmailResultKeyboard(batchId) {
  return inlineKb([
    [
      btn("↻ ᴄᴇᴋ ᴜʟᴀɴɢ", `eml_upd_${batchId}`, "success"),
      btn("ⓘ ᴘᴀɴᴅᴜᴀɴ", `eml_info_${batchId}`, "primary")
    ]
  ]);
}

async function processNumbers(ctx, rawInput) {
  const userId = ctx.from.id;
  await ensureUser(userId, ctx.from);
  await clearInlinePanel(ctx, userId);
  const numbers = extractSmartPhoneNumbers(rawInput);

  if (numbers.length === 0) {
    awaitingInput.add(userId);
    return showInlinePanel(ctx, [
      "△ ᴛɪᴅᴀᴋ ᴀᴅᴀ ɴᴏᴍᴏʀ ᴠᴀʟɪᴅ",
      "",
      "<blockquote>⟡ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ ɴᴏᴍᴏʀ ᴛᴇʟᴇᴘᴏɴ ʏᴀɴɢ ᴠᴀʟɪᴅ ᴅᴀʟᴀᴍ ᴘᴇꜱᴀɴ ᴀɴᴅᴀ.",
      "⊹ ᴋɪʀɪᴍ ɴᴏᴍᴏʀ ᴛᴀʀɢᴇᴛ (ᴄᴏɴᴛᴏʜ ⦂ +6281234567890) ᴀᴛᴀᴜ ᴋʟɪᴋ ʙᴀᴛᴀʟᴋᴀɴ.</blockquote>"
    ].join("\n"), inlineKb([[btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", "cancel_detect", "danger")]]), false);
  }

  const premium = await isPremiumUser(userId);
  const used = await getUsed(userId);

  if (premium) {
    if (numbers.length > PREMIUM_BATCH_LIMIT) {
      return ctx.reply(`⚠ ᴍᴀᴋꜱɪᴍᴀʟ ${PREMIUM_BATCH_LIMIT} ɴᴏᴍᴏʀ ᴘᴇʀ ᴘᴇᴍᴇʀɪᴋꜱᴀᴀɴ ᴜɴᴛᴜᴋ ᴘʀᴇᴍɪᴜᴍ`, mainKeyboard(userId));
    }
  } else {
    const remaining = FREE_DAILY_LIMIT - used;
    if (remaining <= 0) return ctx.reply(`⚠ ᴋᴜᴏᴛᴀ ʜᴀʀɪᴀɴ ᴀɴᴅᴀ (${FREE_DAILY_LIMIT} ɴᴏᴍᴏʀ) ʜᴀʙɪꜱ`, mainKeyboard(userId));
    if (numbers.length > remaining) {
      return ctx.reply(`⚠ ꜱɪꜱᴀ ᴋᴜᴏᴛᴀ ʜᴀʀɪ ɪɴɪ ⦂ ${remaining} ɴᴏᴍᴏʀ\n⚠ ᴀɴᴅᴀ ᴍᴇɴɢɪʀɪᴍ ${numbers.length} ɴᴏᴍᴏʀ`, mainKeyboard(userId));
    }
  }

  const startedAt = Date.now();
  const statusMsg = await ctx.reply(summarizeProgress([], numbers.length), { parse_mode: "HTML" });

  let lastEdit = 0;
  const minInterval = numbers.length <= 5 ? 350 : 950;
  const results = await checkAll(numbers, async (done, total, partialResults) => {
    const now = Date.now();
    if (now - lastEdit < minInterval && done < total) return;
    lastEdit = now;
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        summarizeProgress(partialResults, total),
        { parse_mode: "HTML" }
      );
    } catch (_) {}
  }, { forceFresh: false });

  if (!premium) await addUsed(userId, numbers.length);

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const output = buildDetectionOutput(numbers, results, elapsedSec);

  await incrUserField(userId, "total_detections", numbers.length);
  if (output.readyCount > 0) {
    await incrUserField(userId, "ready_detections", output.readyCount);
    await redis.zincrby("leaderboard:ready", output.readyCount, String(userId));
  }
  await activateReferral(userId);

  const batchId = crypto.randomBytes(5).toString("hex");
  const resKb = buildResultKeyboard(batchId);
  await redis.set(`detect:batch:${batchId}`, JSON.stringify({
    userId,
    numbers,
    lastChunks: output.chunks
  }), { ex: 86400 });

  const chunks = output.chunks;

  if (chunks.length === 1) {
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, chunks[0], {
        parse_mode: "HTML",
        ...resKb
      });
    } catch (_) {
      await ctx.reply(chunks[0], { parse_mode: "HTML", ...resKb });
    }
  } else {
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, chunks[0], {
        parse_mode: "HTML"
      });
    } catch (_) {
      await ctx.reply(chunks[0], { parse_mode: "HTML" });
    }
    for (let i = 1; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      try {
        await ctx.reply(chunks[i], {
          parse_mode: "HTML",
          ...(isLast ? resKb : {})
        });
      } catch (_) {}
    }
  }
}

async function processEmailFix(ctx, rawInput) {
  const userId = ctx.from.id;
  await ensureUser(userId, ctx.from);
  await clearInlinePanel(ctx, userId);
  const numbers = extractSmartPhoneNumbers(rawInput);

  if (numbers.length === 0) {
    awaitingEmailInput.add(userId);
    return showInlinePanel(ctx, [
      "△ ꜰᴏʀᴍᴀᴛ ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ",
      "",
      "<blockquote>▸ ᴘᴀꜱᴛɪᴋᴀɴ ɴᴏᴍᴏʀ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ ᴋᴏᴅᴇ ɴᴇɢᴀʀᴀ (ᴄᴏɴᴛᴏʜ ⦂ <code>+6281234567890</code>).",
      "▸ ᴋɪʀɪᴍ ᴜʟᴀɴɢ ɴᴏᴍᴏʀ ʏᴀɴɢ ɪɴɢɪɴ ᴅɪᴘᴇʀɪᴋsᴀ ᴏᴘsɪ ᴇᴍᴀɪʟɴʏᴀ.</blockquote>"
    ].join("\n"), inlineKb([[btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", "cancel_email", "danger")]]), false);
  }

  const premium = await isPremiumUser(userId);
  const used = await getUsed(userId);

  if (premium) {
    if (numbers.length > PREMIUM_BATCH_LIMIT) {
      return ctx.reply(`⚠ ᴍᴀᴋꜱɪᴍᴀʟ ${PREMIUM_BATCH_LIMIT} ɴᴏᴍᴏʀ ᴘᴇʀ ᴘᴇᴍᴇʀɪᴋꜱᴀᴀɴ ᴜɴᴛᴜᴋ ᴘʀᴇᴍɪᴜᴍ`, mainKeyboard(userId));
    }
  } else {
    const remaining = FREE_DAILY_LIMIT - used;
    if (remaining <= 0) return ctx.reply(`⚠ ᴋᴜᴏᴛᴀ ʜᴀʀɪᴀɴ ᴀɴᴅᴀ (${FREE_DAILY_LIMIT} ɴᴏᴍᴏʀ) ʜᴀʙɪꜱ`, mainKeyboard(userId));
    if (numbers.length > remaining) {
      return ctx.reply(`⚠ ꜱɪꜱᴀ ᴋᴜᴏᴛᴀ ʜᴀʀɪ ɪɴɪ ⦂ ${remaining} ɴᴏᴍᴏʀ\n⚠ ᴀɴᴅᴀ ᴍᴇɴɢɪʀɪᴍ ${numbers.length} ɴᴏᴍᴏʀ`, mainKeyboard(userId));
    }
  }

  const startedAt = Date.now();
  const statusMsg = await ctx.reply(summarizeEmailProgress([], numbers.length), { parse_mode: "HTML" });

  let lastEdit = 0;
  const minInterval = numbers.length <= 5 ? 350 : 950;
  const results = await triggerEmailAll(numbers, async (done, total, partialResults) => {
    const now = Date.now();
    if (now - lastEdit < minInterval && done < total) return;
    lastEdit = now;
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        summarizeEmailProgress(partialResults, total),
        { parse_mode: "HTML" }
      );
    } catch (_) {}
  });

  if (!premium) await addUsed(userId, numbers.length);

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const output = buildEmailOutput(numbers, results, elapsedSec);

  await incrUserField(userId, "email_triggers", numbers.length);
  await activateReferral(userId);

  const batchId = crypto.randomBytes(5).toString("hex");
  const resKb = buildEmailResultKeyboard(batchId);
  await redis.set(`email:batch:${batchId}`, JSON.stringify({
    userId,
    numbers,
    lastChunks: output.chunks
  }), { ex: 86400 });

  const chunks = output.chunks;

  if (chunks.length === 1) {
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, chunks[0], {
        parse_mode: "HTML",
        ...resKb
      });
    } catch (_) {
      await ctx.reply(chunks[0], { parse_mode: "HTML", ...resKb });
    }
  } else {
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, chunks[0], {
        parse_mode: "HTML"
      });
    } catch (_) {
      await ctx.reply(chunks[0], { parse_mode: "HTML" });
    }
    for (let i = 1; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      try {
        await ctx.reply(chunks[i], {
          parse_mode: "HTML",
          ...(isLast ? resKb : {})
        });
      } catch (_) {}
    }
  }
}

async function runBroadcast(ctx, sourceMsg) {
  const userId = ctx.from.id;
  await clearInlinePanel(ctx, userId);
  const userIds = await getAllUserIds();
  if (userIds.length === 0) {
    return ctx.reply("⚠ ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴜꜱᴇʀ ᴛᴇʀᴅᴀꜰᴛᴀʀ ᴜɴᴛᴜᴋ ʙʀᴏᴀᴅᴄᴀꜱᴛ", mainKeyboard(userId));
  }
  const progMsg = await ctx.reply([
    "⌲ ᴍᴇɴɢɪʀɪᴍ ʙʀᴏᴀᴅᴄᴀꜱᴛ",
    "",
    `<blockquote>◈ ᴛᴀʀɢᴇᴛ ⦂ ${userIds.length} ᴘᴇɴɢɢᴜɴᴀ`,
    `⟡ ꜱᴛᴀᴛᴜꜱ ⦂ ᴍᴇᴍᴘʀᴏꜱᴇꜱ...</blockquote>`
  ].join("\n"), { parse_mode: "HTML" });

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < userIds.length; i++) {
    const uid = Number(userIds[i]);
    try {
      await ctx.telegram.copyMessage(uid, ctx.chat.id, sourceMsg.message_id);
      sent++;
    } catch (_) {
      failed++;
    }
    if ((i + 1) % 25 === 0 && i + 1 < userIds.length) {
      const pct = Math.round((i + 1) * 100 / userIds.length);
      try {
        await ctx.telegram.editMessageText(ctx.chat.id, progMsg.message_id, undefined, [
          "⌲ ᴍᴇɴɢɪʀɪᴍ ʙʀᴏᴀᴅᴄᴀꜱᴛ",
          "",
          `<blockquote>◈ ${bar(pct)} ${pct}%`,
          `✓ ᴛᴇʀᴋɪʀɪᴍ ⦂ ${sent} · ✕ ɢᴀɢᴀʟ ⦂ ${failed}</blockquote>`
        ].join("\n"), { parse_mode: "HTML" });
      } catch (_) {}
    }
    await new Promise(r => setTimeout(r, 40));
  }

  const finalReport = [
    "✦ ʙʀᴏᴀᴅᴄᴀꜱᴛ ꜱᴇʟᴇꜱᴀɪ",
    "",
    `<blockquote>◈ ᴛᴏᴛᴀʟ ᴛᴀʀɢᴇᴛ ⦂ ${userIds.length} ᴜꜱᴇʀ`,
    `✓ ʙᴇʀʜᴀꜱɪʟ ⦂ ${sent}`,
    `✕ ɢᴀɢᴀʟ ⦂ ${failed}</blockquote>`
  ].join("\n");

  try {
    await ctx.telegram.editMessageText(ctx.chat.id, progMsg.message_id, undefined, finalReport, {
      parse_mode: "HTML",
      ...inlineKb([[btn("⟢ ᴋᴇᴍʙᴀʟɪ ᴋᴇ ᴘᴀɴᴇʟ", "admin", "primary")]])
    });
    activeInlineMsg.set(userId, { chatId: ctx.chat.id, messageId: progMsg.message_id });
  } catch (_) {
    await ctx.reply(finalReport, { parse_mode: "HTML", ...mainKeyboard(userId) });
  }
}

async function migrateFromSQLite() {
  if (!fs.existsSync("bot.db")) return;
  try {
    const SQLite = require("better-sqlite3");
    const old = new SQLite("bot.db", { readonly: true });
    const users = old.prepare("SELECT * FROM users").all();
    const payments = old.prepare("SELECT * FROM payments").all();
    const refs = old.prepare("SELECT * FROM referrals").all();
    const usage = old.prepare("SELECT * FROM usage").all();
    old.close();
    for (const u of users) {
      await redis.sadd("users:all", String(u.user_id));
      const key = `user:${u.user_id}`;
      if (await redis.exists(key)) continue;
      const fields = {};
      for (const [k, v] of Object.entries(u)) {
        if (v === null || v === undefined) continue;
        fields[k] = String(v);
      }
      fields.ready_detections = fields.ready_detections || "0";
      fields.email_triggers = fields.email_triggers || "0";
      await redis.hset(key, fields);
      if (u.premium_until) {
        await redis.set(`user:premium_until:${u.user_id}`, String(u.premium_until));
      }
    }
    for (const p of payments) {
      await redis.hset(`payment:${p.id}`, {
        id: String(p.id),
        user_id: String(p.user_id),
        plan_days: String(p.plan_days),
        plan_price: String(p.plan_price),
        invoice_id: String(p.invoice_id),
        status: String(p.status || "pending"),
        proof_file_id: p.proof_file_id || "",
        created_at: String(p.created_at || ""),
        approved_at: p.approved_at || ""
      });
      await redis.set(`payment:invoice:${p.invoice_id}`, String(p.id));
      if (p.status === "pending" || p.status === "review") await redis.sadd("payments:pending", String(p.id));
      const curNext = await redis.get("payment:next_id");
      const next = parseInt(p.id, 10) + 1;
      if (!curNext || parseInt(curNext, 10) < next) await redis.set("payment:next_id", String(next));
    }
    for (const r of refs) {
      await redis.set(`referral:by:${r.referred_id}`, String(r.referrer_id));
      await redis.hset(`referral:${r.referred_id}`, {
        referrer_id: String(r.referrer_id),
        status: r.status || "pending",
        created_at: String(r.created_at || ""),
        activated_at: r.activated_at || ""
      });
      if (r.status === "active") {
        await redis.sadd(`referrals:${r.referrer_id}`, String(r.referred_id));
        await redis.sadd(`referrals:active:${r.referrer_id}`, String(r.referred_id));
      }
    }
    for (const u of usage) {
      await redis.set(`usage:${u.user_id}:${u.date}`, String(u.count), { ex: 172800 });
    }
    fs.renameSync("bot.db", "bot.db.migrated");
    console.log("✔ migrasi ꜱQʟɪᴛᴇ → ʀᴇᴅɪꜱ ꜱᴇʟᴇꜱᴀɪ");
  } catch (e) {
    console.error("migrasi gagal:", e.message);
  }
}

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const existed = await getUser(userId);
  await ensureUser(userId, ctx.from);
  if (!existed) {
    const payload = ctx.startPayload || "";
    if (payload.startsWith("ref_")) {
      const referrerId = parseInt(payload.slice(4), 10);
      if (referrerId) await recordReferral(referrerId, userId);
    }
  }
  awaitingInput.delete(userId);
  awaitingEmailInput.delete(userId);
  adminState.delete(userId);
  await sendFreshKeyboardPanel(ctx, await buildDashboard(userId, ctx.from));
});

bot.hears(MENU_LABELS.DETECT, async (ctx) => {
  const userId = ctx.from.id;
  awaitingEmailInput.delete(userId);
  adminState.delete(userId);
  awaitingInput.add(userId);
  await showInlinePanel(
    ctx,
    await buildDetectPrompt(userId, ctx.from),
    inlineKb([[btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", "cancel_detect", "danger")]]),
    true
  );
});

bot.hears(MENU_LABELS.EMAIL_FIX, async (ctx) => {
  const userId = ctx.from.id;
  awaitingInput.delete(userId);
  adminState.delete(userId);
  awaitingEmailInput.add(userId);
  await showInlinePanel(
    ctx,
    await buildEmailPrompt(userId, ctx.from),
    inlineKb([[btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", "cancel_email", "danger")]]),
    true
  );
});

bot.hears(MENU_LABELS.STATUS, async (ctx) => {
  const userId = ctx.from.id;
  awaitingInput.delete(userId);
  awaitingEmailInput.delete(userId);
  adminState.delete(userId);
  await showPlainPanel(ctx, await buildStatusPage(userId, ctx.from), true);
});

bot.hears(MENU_LABELS.REFERRAL, async (ctx) => {
  const userId = ctx.from.id;
  awaitingInput.delete(userId);
  awaitingEmailInput.delete(userId);
  adminState.delete(userId);
  await ensureUser(userId, ctx.from);
  await showInlinePanel(ctx, await buildReferralPage(userId), buildReferralKeyboard(userId), true);
});

bot.hears(MENU_LABELS.PREMIUM, async (ctx) => {
  const userId = ctx.from.id;
  awaitingInput.delete(userId);
  awaitingEmailInput.delete(userId);
  adminState.delete(userId);
  await ensureUser(userId, ctx.from);
  await showInlinePanel(ctx, buildPremiumPage(), buildPremiumKeyboard(), true);
});

bot.hears(MENU_LABELS.LEADERBOARD, async (ctx) => {
  const userId = ctx.from.id;
  awaitingInput.delete(userId);
  awaitingEmailInput.delete(userId);
  adminState.delete(userId);
  await ensureUser(userId, ctx.from);
  await showPlainPanel(ctx, await buildLeaderboardPage(userId), true);
});

bot.hears(MENU_LABELS.ADMIN, async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return;
  awaitingInput.delete(userId);
  awaitingEmailInput.delete(userId);
  adminState.delete(userId);
  const text = await buildAdminPanel(userId);
  await showInlinePanel(ctx, text, buildAdminKeyboard(), true);
});

bot.action(/^det_info_([a-f0-9]+)$/i, async (ctx) => {
  const batchId = ctx.match[1];
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(buildDetectInfoPage(), {
      parse_mode: "HTML",
      ...inlineKb([
        [
          btn("⟢ ᴋᴇᴍʙᴀʟɪ ᴋᴇ ʜᴀꜱɪʟ", `det_back_${batchId}`, "primary"),
          btn("↻ ᴜᴘᴅᴀᴛᴇ", `det_upd_${batchId}`, "success")
        ]
      ])
    });
  } catch (_) {}
});

bot.action(/^det_back_([a-f0-9]+)$/i, async (ctx) => {
  const batchId = ctx.match[1];
  const raw = await redis.get(`detect:batch:${batchId}`);
  if (!raw) return ctx.answerCbQuery("ᴅᴀᴛᴀ ʜᴀꜱɪʟ ꜱᴜᴅᴀʜ ᴋᴀᴅᴀʟᴜᴡᴀʀꜱᴀ", { show_alert: true });
  let data;
  try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { data = null; }
  if (!data || !Array.isArray(data.lastChunks) || data.lastChunks.length === 0) {
    return ctx.answerCbQuery("ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ", { show_alert: true });
  }
  await ctx.answerCbQuery();
  const lastChunk = data.lastChunks[data.lastChunks.length - 1];
  try {
    await ctx.editMessageText(lastChunk, {
      parse_mode: "HTML",
      ...buildResultKeyboard(batchId)
    });
  } catch (_) {}
});

bot.action(/^det_upd_([a-f0-9]+)$/i, async (ctx) => {
  const batchId = ctx.match[1];
  const userId = ctx.from.id;
  const raw = await redis.get(`detect:batch:${batchId}`);
  if (!raw) return ctx.answerCbQuery("ᴅᴀᴛᴀ ʙᴀᴛᴄʜ ꜱᴜᴅᴀʜ ᴋᴀᴅᴀʟᴜᴡᴀʀꜱᴀ", { show_alert: true });
  let data;
  try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { data = null; }
  if (!data || !Array.isArray(data.numbers) || data.numbers.length === 0) {
    return ctx.answerCbQuery("ᴅᴀᴛᴀ ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ", { show_alert: true });
  }
  if (Number(data.userId) !== userId) {
    return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ", { show_alert: true });
  }

  const numbers = data.numbers;
  const premium = await isPremiumUser(userId);
  if (!premium) {
    const used = await getUsed(userId);
    const remaining = FREE_DAILY_LIMIT - used;
    if (remaining < numbers.length) {
      return ctx.answerCbQuery(`⚠ ꜱɪꜱᴀ ᴋᴜᴏᴛᴀ ʜᴀʀɪ ɪɴɪ (${Math.max(0, remaining)}) ᴛɪᴅᴀᴋ ᴄᴜᴋᴜᴘ`, { show_alert: true });
    }
  }

  await ctx.answerCbQuery("↻ ᴍᴇᴍᴘᴇʀʙᴀʀᴜɪ ᴅᴀᴛᴀ...");
  const startedAt = Date.now();
  const msgId = ctx.callbackQuery.message.message_id;
  const chatId = ctx.chat.id;

  try {
    await ctx.telegram.editMessageText(chatId, msgId, undefined, summarizeProgress([], numbers.length), {
      parse_mode: "HTML"
    });
  } catch (_) {}

  let lastEdit = 0;
  const minInterval = numbers.length <= 5 ? 350 : 950;
  const results = await checkAll(numbers, async (done, total, partialResults) => {
    const now = Date.now();
    if (now - lastEdit < minInterval && done < total) return;
    lastEdit = now;
    try {
      await ctx.telegram.editMessageText(chatId, msgId, undefined, summarizeProgress(partialResults, total), {
        parse_mode: "HTML"
      });
    } catch (_) {}
  }, { forceFresh: true });

  if (!premium) await addUsed(userId, numbers.length);

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const output = buildDetectionOutput(numbers, results, elapsedSec);

  await incrUserField(userId, "total_detections", numbers.length);
  if (output.readyCount > 0) {
    await incrUserField(userId, "ready_detections", output.readyCount);
    await redis.zincrby("leaderboard:ready", output.readyCount, String(userId));
  }

  await redis.set(`detect:batch:${batchId}`, JSON.stringify({
    userId,
    numbers,
    lastChunks: output.chunks
  }), { ex: 86400 });

  const resKb = buildResultKeyboard(batchId);
  const chunks = output.chunks;

  if (chunks.length === 1) {
    try {
      await ctx.telegram.editMessageText(chatId, msgId, undefined, chunks[0], {
        parse_mode: "HTML",
        ...resKb
      });
    } catch (_) {}
  } else {
    try {
      await ctx.telegram.editMessageText(chatId, msgId, undefined, chunks[0], {
        parse_mode: "HTML"
      });
    } catch (_) {}
    for (let i = 1; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      try {
        await ctx.reply(chunks[i], {
          parse_mode: "HTML",
          ...(isLast ? resKb : {})
        });
      } catch (_) {}
    }
  }
});

bot.action(/^eml_info_([a-f0-9]+)$/i, async (ctx) => {
  const batchId = ctx.match[1];
  await ctx.answerCbQuery();
  try {
    await ctx.editMessageText(buildEmailGuidePage(), {
      parse_mode: "HTML",
      ...inlineKb([
        [
          btn("⟢ ᴋᴇᴍʙᴀʟɪ ᴋᴇ ʜᴀꜱɪʟ", `eml_back_${batchId}`, "primary"),
          btn("↻ ᴄᴇᴋ ᴜʟᴀɴɢ", `eml_upd_${batchId}`, "success")
        ]
      ])
    });
  } catch (_) {}
});

bot.action(/^eml_back_([a-f0-9]+)$/i, async (ctx) => {
  const batchId = ctx.match[1];
  const raw = await redis.get(`email:batch:${batchId}`);
  if (!raw) return ctx.answerCbQuery("ᴅᴀᴛᴀ ʜᴀꜱɪʟ ꜱᴜᴅᴀʜ ᴋᴀᴅᴀʟᴜᴡᴀʀꜱᴀ", { show_alert: true });
  let data;
  try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { data = null; }
  if (!data || !Array.isArray(data.lastChunks) || data.lastChunks.length === 0) {
    return ctx.answerCbQuery("ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ", { show_alert: true });
  }
  await ctx.answerCbQuery();
  const lastChunk = data.lastChunks[data.lastChunks.length - 1];
  try {
    await ctx.editMessageText(lastChunk, {
      parse_mode: "HTML",
      ...buildEmailResultKeyboard(batchId)
    });
  } catch (_) {}
});

bot.action(/^eml_upd_([a-f0-9]+)$/i, async (ctx) => {
  const batchId = ctx.match[1];
  const userId = ctx.from.id;
  const raw = await redis.get(`email:batch:${batchId}`);
  if (!raw) return ctx.answerCbQuery("ᴅᴀᴛᴀ ʙᴀᴛᴄʜ ꜱᴜᴅᴀʜ ᴋᴀᴅᴀʟᴜᴡᴀʀꜱᴀ", { show_alert: true });
  let data;
  try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { data = null; }
  if (!data || !Array.isArray(data.numbers) || data.numbers.length === 0) {
    return ctx.answerCbQuery("ᴅᴀᴛᴀ ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ", { show_alert: true });
  }
  if (Number(data.userId) !== userId) {
    return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ", { show_alert: true });
  }

  const numbers = data.numbers;
  const premium = await isPremiumUser(userId);
  if (!premium) {
    const used = await getUsed(userId);
    const remaining = FREE_DAILY_LIMIT - used;
    if (remaining < numbers.length) {
      return ctx.answerCbQuery(`⚠ ꜱɪꜱᴀ ᴋᴜᴏᴛᴀ ʜᴀʀɪ ɪɴɪ (${Math.max(0, remaining)}) ᴛɪᴅᴀᴋ ᴄᴜᴋᴜᴘ`, { show_alert: true });
    }
  }

  await ctx.answerCbQuery("↻ ᴍᴇᴍᴇʀɪᴋꜱᴀ ᴜʟᴀɴɢ ᴏᴘꜱɪ ᴇᴍᴀɪʟ...");
  const startedAt = Date.now();
  const msgId = ctx.callbackQuery.message.message_id;
  const chatId = ctx.chat.id;

  try {
    await ctx.telegram.editMessageText(chatId, msgId, undefined, summarizeEmailProgress([], numbers.length), {
      parse_mode: "HTML"
    });
  } catch (_) {}

  let lastEdit = 0;
  const minInterval = numbers.length <= 5 ? 350 : 950;
  const results = await triggerEmailAll(numbers, async (done, total, partialResults) => {
    const now = Date.now();
    if (now - lastEdit < minInterval && done < total) return;
    lastEdit = now;
    try {
      await ctx.telegram.editMessageText(chatId, msgId, undefined, summarizeEmailProgress(partialResults, total), {
        parse_mode: "HTML"
      });
    } catch (_) {}
  });

  if (!premium) await addUsed(userId, numbers.length);

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const output = buildEmailOutput(numbers, results, elapsedSec);

  await incrUserField(userId, "email_triggers", numbers.length);

  await redis.set(`email:batch:${batchId}`, JSON.stringify({
    userId,
    numbers,
    lastChunks: output.chunks
  }), { ex: 86400 });

  const resKb = buildEmailResultKeyboard(batchId);
  const chunks = output.chunks;

  if (chunks.length === 1) {
    try {
      await ctx.telegram.editMessageText(chatId, msgId, undefined, chunks[0], {
        parse_mode: "HTML",
        ...resKb
      });
    } catch (_) {}
  } else {
    try {
      await ctx.telegram.editMessageText(chatId, msgId, undefined, chunks[0], {
        parse_mode: "HTML"
      });
    } catch (_) {}
    for (let i = 1; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      try {
        await ctx.reply(chunks[i], {
          parse_mode: "HTML",
          ...(isLast ? resKb : {})
        });
      } catch (_) {}
    }
  }
});

bot.action("cancel_detect", async (ctx) => {
  const userId = ctx.from.id;
  awaitingInput.delete(userId);
  await ctx.answerCbQuery("ᴅɪʙᴀᴛᴀʟᴋᴀɴ");
  await showPlainPanel(ctx, await buildDashboard(userId, ctx.from), false);
});

bot.action("cancel_email", async (ctx) => {
  const userId = ctx.from.id;
  awaitingEmailInput.delete(userId);
  await ctx.answerCbQuery("ᴅɪʙᴀᴛᴀʟᴋᴀɴ");
  await showPlainPanel(ctx, await buildDashboard(userId, ctx.from), false);
});

bot.action("referral", async (ctx) => {
  const userId = ctx.from.id;
  await ctx.answerCbQuery();
  await editInline(ctx, await buildReferralPage(userId), buildReferralKeyboard(userId));
});

bot.action("rewards", async (ctx) => {
  const userId = ctx.from.id;
  await ctx.answerCbQuery();
  const ref = await getReferralStats(userId);
  await editInline(ctx, await buildRewardsPage(userId), buildRewardsKeyboard(ref.points));
});

bot.action(/^redeem_(\d+)$/, async (ctx) => {
  const userId = ctx.from.id;
  const i = parseInt(ctx.match[1], 10);
  const r = REWARDS[i];
  if (!r) return ctx.answerCbQuery("ᴘᴀᴋᴇᴛ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ");
  const u = await getUser(userId);
  if (((u && u.referral_points) || 0) < r.pts) {
    return ctx.answerCbQuery(`ᴘᴏɪɴ ᴋᴜʀᴀɴɢ (${(u && u.referral_points) || 0}/${r.pts})`, { show_alert: true });
  }
  await redis.hincrby(`user:${userId}`, "referral_points", -r.pts);
  await redis.hincrby(`user:${userId}`, "referral_redeemed_days", r.days);
  await redis.zincrby("leaderboard:referrals", -r.pts, String(userId));
  const end = await addPremiumDays(userId, r.days);
  await ctx.answerCbQuery("✓ ʙᴇʀʜᴀꜱɪʟ");
  await editInline(ctx, [
    "✦ ᴘᴇɴᴜᴋᴀʀᴀɴ ʙᴇʀʜᴀꜱɪʟ",
    "",
    `<blockquote>⊹ ᴘᴏɪɴ ᴅɪɢᴜɴᴀᴋᴀɴ ⦂ ${r.pts} ᴘᴛ`,
    `⊹ ᴘʀᴇᴍɪᴜᴍ ᴅɪᴛᴀᴍʙᴀʜ ⦂ ${r.days} ʜᴀʀɪ`,
    `⊹ ʙᴇʀᴀᴋʜɪʀ ⦂ ${formatWIB(end.toISOString())}</blockquote>`
  ].join("\n"), inlineKb([[btn("⟢ ᴋᴇᴍʙᴀʟɪ", "referral", "primary")]]));
});

bot.action("premium_back", async (ctx) => {
  await ctx.answerCbQuery();
  await editInline(ctx, buildPremiumPage(), buildPremiumKeyboard());
});

bot.action(/^buy_(p\d+)$/, async (ctx) => {
  const plan = PLANS.find(p => p.id === ctx.match[1]);
  if (!plan) return ctx.answerCbQuery("ᴘᴀᴋᴇᴛ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ");
  const userId = ctx.from.id;
  const pending = await redis.smembers("payments:pending");
  for (const pid of pending) {
    const p = parseRedisHash(await redis.hgetall(`payment:${pid}`));
    if (p && Number(p.user_id) === userId && p.status === "pending") {
      await redis.hset(`payment:${pid}`, { status: "cancelled" });
      await redis.srem("payments:pending", pid);
    }
  }
  const nextId = Number(await redis.incr("payment:next_id"));
  const inv = "INV" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  await redis.hset(`payment:${nextId}`, {
    id: String(nextId),
    user_id: String(userId),
    plan_days: String(plan.days),
    plan_price: String(plan.price),
    invoice_id: inv,
    status: "pending",
    proof_file_id: "",
    created_at: new Date().toISOString(),
    approved_at: ""
  });
  await redis.set(`payment:invoice:${inv}`, String(nextId));
  await redis.sadd("payments:pending", String(nextId));
  await ctx.answerCbQuery();
  const text = await buildPaymentInvoice(userId, plan, inv);
  await editInline(ctx, text, inlineKb([
    [
      btn("⟢ ɢᴀɴᴛɪ ᴘᴀᴋᴇᴛ", "premium_back", "primary"),
      btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", `cancel_inv_${nextId}`, "danger")
    ]
  ]));
});

bot.action(/^cancel_inv_(\d+)$/, async (ctx) => {
  const pid = ctx.match[1];
  const p = parseRedisHash(await redis.hgetall(`payment:${pid}`));
  if (!p || Number(p.user_id) !== ctx.from.id) return ctx.answerCbQuery("ᴛᴀɢɪʜᴀɴ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ");
  if (p.status !== "pending") return ctx.answerCbQuery("ᴛᴀɢɪʜᴀɴ ꜱᴜᴅᴀʜ ᴅɪᴘʀᴏꜱᴇꜱ");
  await redis.hset(`payment:${pid}`, { status: "cancelled" });
  await redis.srem("payments:pending", pid);
  await ctx.answerCbQuery("ᴛᴀɢɪʜᴀɴ ᴅɪʙᴀᴛᴀʟᴋᴀɴ");
  await editInline(ctx, buildPremiumPage(), buildPremiumKeyboard());
});

bot.action("admin", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  adminState.delete(userId);
  await ctx.answerCbQuery();
  await editInline(ctx, await buildAdminPanel(userId), buildAdminKeyboard());
});

bot.action("adm_close", async (ctx) => {
  const userId = ctx.from.id;
  adminState.delete(userId);
  await ctx.answerCbQuery("ᴅɪᴛᴜᴛᴜᴘ");
  await showPlainPanel(ctx, await buildDashboard(userId, ctx.from), false);
});

bot.action("adm_cancel", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  adminState.delete(userId);
  await ctx.answerCbQuery("ᴅɪʙᴀᴛᴀʟᴋᴀɴ");
  await editInline(ctx, await buildAdminPanel(userId), buildAdminKeyboard());
});

bot.action("adm_bc", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  await ctx.answerCbQuery();
  adminState.set(userId, { action: "bc" });
  await editInline(ctx, [
    "⌲ ʙʀᴏᴀᴅᴄᴀꜱᴛ ᴘᴇꜱᴀɴ",
    "",
    "<blockquote>⟡ ᴋɪʀɪᴍ ᴘᴇꜱᴀɴ ᴛᴇᴋꜱ ᴀᴛᴀᴜ ꜰᴏᴛᴏ ᴅᴇɴɢᴀɴ ᴄᴀᴘᴛɪᴏɴ ʏᴀɴɢ ɪɴɢɪɴ ᴅɪʙʀᴏᴀᴅᴄᴀꜱᴛ ᴋᴇ ꜱᴇʟᴜʀᴜʜ ᴘᴇɴɢɢᴜɴᴀ ʙᴏᴛ.</blockquote>"
  ].join("\n"), inlineKb([[btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", "adm_cancel", "danger")]]));
});

bot.action("adm_addprem", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  await ctx.answerCbQuery();
  adminState.set(userId, { action: "addprem" });
  await editInline(ctx, [
    "✦ ᴛᴀᴍʙᴀʜ ᴀᴋꜱᴇꜱ ᴘʀᴇᴍɪᴜᴍ",
    "",
    "<blockquote>⟡ ᴋɪʀɪᴍ ᴜꜱᴇʀ ɪᴅ ᴅᴀɴ ᴊᴜᴍʟᴀʜ ʜᴀʀɪ ᴅᴇɴɢᴀɴ ꜰᴏʀᴍᴀᴛ ⦂",
    "<code>8062935882 7</code></blockquote>"
  ].join("\n"), inlineKb([[btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", "adm_cancel", "danger")]]));
});

bot.action("adm_delprem", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  await ctx.answerCbQuery();
  adminState.set(userId, { action: "delprem" });
  await editInline(ctx, [
    "✕ ʜᴀᴘᴜꜱ ᴀᴋꜱᴇꜱ ᴘʀᴇᴍɪᴜᴍ",
    "",
    "<blockquote>⟡ ᴋɪʀɪᴍ ᴜꜱᴇʀ ɪᴅ ʏᴀɴɢ ɪɴɢɪɴ ᴅɪᴋᴇᴍʙᴀʟɪᴋᴀɴ ᴋᴇ ꜰʀᴇᴇ ⦂",
    "<code>8062935882</code></blockquote>"
  ].join("\n"), inlineKb([[btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", "adm_cancel", "danger")]]));
});

bot.action("adm_premlist", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  adminState.delete(userId);
  await ctx.answerCbQuery();
  const allIds = await getAllUserIds();
  const now = Date.now();
  const premUsers = [];
  for (const uid of allIds) {
    const u = await getUser(Number(uid));
    if (u && u.premium_until && new Date(u.premium_until).getTime() > now) {
      premUsers.push(u);
    }
  }
  const listLines = premUsers.length === 0
    ? ["⟡ ʙᴇʟᴜᴍ ᴀᴅᴀ ᴜꜱᴇʀ ᴘʀᴇᴍɪᴜᴍ ᴀᴋᴛɪꜰ"]
    : premUsers.slice(0, 25).map(u => `⟢ <code>${u.user_id}</code> · ${esc(u.first_name || "-")} ⦂ ${formatWIB(u.premium_until)}`);
  await editInline(ctx, [
    "♛ ᴅᴀꜰᴛᴀʀ ᴜꜱᴇʀ ᴘʀᴇᴍɪᴜᴍ",
    "",
    `<blockquote>${listLines.join("\n")}</blockquote>`
  ].join("\n"), inlineKb([[btn("⟢ ᴋᴇᴍʙᴀʟɪ", "admin", "primary")]]));
});

bot.action("adm_setpay", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  await ctx.answerCbQuery();
  adminState.set(userId, { action: "setpay" });
  const current = await getSetting("payment_info", process.env.PAYMENT_INFO || "-");
  await editInline(ctx, [
    "⊹ ᴀᴛᴜʀ ɪɴꜰᴏ ᴘᴇᴍʙᴀʏᴀʀᴀɴ",
    "",
    `<blockquote>ɪɴꜰᴏ ꜱᴀᴀᴛ ɪɴɪ ⦂\n${esc(current)}</blockquote>`,
    "",
    "ᴋɪʀɪᴍ ᴛᴇᴋꜱ ɪɴꜱᴛʀᴜᴋꜱɪ ᴘᴇᴍʙᴀʏᴀʀᴀɴ ʏᴀɴɢ ʙᴀʀᴜ."
  ].join("\n"), inlineKb([[btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", "adm_cancel", "danger")]]));
});

bot.action("adm_setcontact", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  await ctx.answerCbQuery();
  adminState.set(userId, { action: "setcontact" });
  const current = await getSetting("admin_contact", process.env.ADMIN_CONTACT || "@admin");
  await editInline(ctx, [
    "⊹ ᴀᴛᴜʀ ᴋᴏɴᴛᴀᴋ ᴀᴅᴍɪɴ",
    "",
    `<blockquote>ᴋᴏɴᴛᴀᴋ ꜱᴀᴀᴛ ɪɴɪ ⦂ ${esc(current)}</blockquote>`,
    "",
    "ᴋɪʀɪᴍ @ᴜꜱᴇʀɴᴀᴍᴇ ᴀᴅᴍɪɴ ʏᴀɴɢ ʙᴀʀᴜ."
  ].join("\n"), inlineKb([[btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", "adm_cancel", "danger")]]));
});

bot.action("adm_pay", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  adminState.delete(userId);
  await ctx.answerCbQuery();
  const ids = await redis.smembers("payments:pending");
  const rows = [];
  for (const pid of ids) {
    const p = parseRedisHash(await redis.hgetall(`payment:${pid}`));
    if (p && (p.status === "pending" || p.status === "review")) rows.push(p);
  }
  if (rows.length === 0) {
    return editInline(ctx, [
      "⟡ ᴛᴀɢɪʜᴀɴ ᴘᴇɴᴅɪɴɢ",
      "",
      "<blockquote>⟡ ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴛᴀɢɪʜᴀɴ ᴘᴇɴᴅɪɴɢ ꜱᴀᴀᴛ ɪɴɪ.</blockquote>"
    ].join("\n"), inlineKb([[btn("⟢ ᴋᴇᴍʙᴀʟɪ", "admin", "primary")]]));
  }
  const itemLines = [];
  const btnRows = [];
  for (const p of rows) {
    itemLines.push(`⟢ <code>${esc(p.invoice_id)}</code>`);
    itemLines.push(`  ᴜꜱᴇʀ ⦂ <code>${esc(p.user_id)}</code> · ${p.plan_days}ʜ · ${formatRp(p.plan_price)}`);
    itemLines.push(`  ꜱᴛᴀᴛᴜꜱ ⦂ ${esc(p.status)}`);
    btnRows.push([
      btn(`✓ ${p.invoice_id}`, `apv_${p.id}`, "success"),
      btn(`✕ ${p.invoice_id}`, `rjt_${p.id}`, "danger")
    ]);
  }
  btnRows.push([btn("⟢ ᴋᴇᴍʙᴀʟɪ", "admin", "primary")]);
  await editInline(ctx, [
    "⟡ ᴛᴀɢɪʜᴀɴ ᴘᴇɴᴅɪɴɢ",
    "",
    `<blockquote>${itemLines.join("\n")}</blockquote>`
  ].join("\n"), inlineKb(btnRows));
});

bot.action(/^apv_(\d+)$/, async (ctx) => {
  const adminId = ctx.from.id;
  if (!ADMIN_IDS.includes(adminId)) return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  const id = parseInt(ctx.match[1], 10);
  const p = parseRedisHash(await redis.hgetall(`payment:${id}`));
  if (!p || (p.status !== "pending" && p.status !== "review")) return ctx.answerCbQuery("ᴛᴀɢɪʜᴀɴ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ");
  await redis.hset(`payment:${id}`, { status: "approved", approved_at: new Date().toISOString() });
  await redis.srem("payments:pending", String(id));
  const targetUid = Number(p.user_id);
  const end = await addPremiumDays(targetUid, Number(p.plan_days));
  await ctx.answerCbQuery("✓ ᴅɪꜱᴇᴛᴜᴊᴜɪ");
  try {
    await ctx.telegram.sendMessage(targetUid, [
      "✦ ᴘᴇᴍʙᴀʏᴀʀᴀɴ ᴅɪꜱᴇᴛᴜᴊᴜɪ",
      "",
      `<blockquote>⊹ ɪɴᴠᴏɪᴄᴇ ⦂ <code>${esc(p.invoice_id)}</code>`,
      `⊹ ᴘᴀᴋᴇᴛ ⦂ ${p.plan_days} ʜᴀʀɪ`,
      `⊹ ʙᴇʀᴀᴋʜɪʀ ⦂ ${formatWIB(end.toISOString())}</blockquote>`
    ].join("\n"), { parse_mode: "HTML", ...mainKeyboard(targetUid) });
  } catch (_) {}
  if (ctx.callbackQuery && ctx.callbackQuery.message && ctx.callbackQuery.message.photo) {
    try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch (_) {}
  } else {
    try { await editInline(ctx, await buildAdminPanel(adminId), buildAdminKeyboard()); } catch (_) {}
  }
});

bot.action(/^rjt_(\d+)$/, async (ctx) => {
  const adminId = ctx.from.id;
  if (!ADMIN_IDS.includes(adminId)) return ctx.answerCbQuery("ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  const id = parseInt(ctx.match[1], 10);
  const p = parseRedisHash(await redis.hgetall(`payment:${id}`));
  if (!p || (p.status !== "pending" && p.status !== "review")) return ctx.answerCbQuery("ᴛᴀɢɪʜᴀɴ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ");
  await redis.hset(`payment:${id}`, { status: "rejected" });
  await redis.srem("payments:pending", String(id));
  const targetUid = Number(p.user_id);
  await ctx.answerCbQuery("✕ ᴅɪᴛᴏʟᴀᴋ");
  try {
    await ctx.telegram.sendMessage(targetUid, [
      "✕ ᴘᴇᴍʙᴀʏᴀʀᴀɴ ᴅɪᴛᴏʟᴀᴋ",
      "",
      `<blockquote>⊹ ɪɴᴠᴏɪᴄᴇ ⦂ <code>${esc(p.invoice_id)}</code></blockquote>`,
      "",
      "⟢ ʜᴜʙᴜɴɢɪ ᴀᴅᴍɪɴ ᴜɴᴛᴜᴋ ɪɴꜰᴏ ʟᴇʙɪʜ ʟᴀɴᴊᴜᴛ"
    ].join("\n"), { parse_mode: "HTML", ...mainKeyboard(targetUid) });
  } catch (_) {}
  if (ctx.callbackQuery && ctx.callbackQuery.message && ctx.callbackQuery.message.photo) {
    try { await ctx.editMessageReplyMarkup({ inline_keyboard: [] }); } catch (_) {}
  } else {
    try { await editInline(ctx, await buildAdminPanel(adminId), buildAdminKeyboard()); } catch (_) {}
  }
});

bot.command("detect", async (ctx) => {
  const userId = ctx.from.id;
  awaitingEmailInput.delete(userId);
  adminState.delete(userId);
  const args = ctx.message.text.split(" ").slice(1).join(" ").trim();
  if (args) return processNumbers(ctx, args);
  awaitingInput.add(userId);
  await showInlinePanel(
    ctx,
    await buildDetectPrompt(userId, ctx.from),
    inlineKb([[btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", "cancel_detect", "danger")]]),
    false
  );
});

bot.command("email", async (ctx) => {
  const userId = ctx.from.id;
  awaitingInput.delete(userId);
  adminState.delete(userId);
  const args = ctx.message.text.split(" ").slice(1).join(" ").trim();
  if (args) return processEmailFix(ctx, args);
  awaitingEmailInput.add(userId);
  await showInlinePanel(
    ctx,
    await buildEmailPrompt(userId, ctx.from),
    inlineKb([[btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", "cancel_email", "danger")]]),
    false
  );
});

bot.command("cancel", async (ctx) => {
  const userId = ctx.from.id;
  awaitingInput.delete(userId);
  awaitingEmailInput.delete(userId);
  adminState.delete(userId);
  await sendFreshKeyboardPanel(ctx, await buildDashboard(userId, ctx.from));
});

bot.command("addpremium", async (ctx) => {
  const adminId = ctx.from.id;
  if (!ADMIN_IDS.includes(adminId)) return ctx.reply("⚠ ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  const parts = ctx.message.text.split(/\s+/);
  const id = parseInt(parts[1], 10);
  const days = parseInt(parts[2] || "1", 10);
  if (!id || isNaN(days) || days <= 0) {
    return ctx.reply("⚠ ꜰᴏʀᴍᴀᴛ ⦂ <code>/addpremium 8062935882 7</code>", { parse_mode: "HTML", ...mainKeyboard(adminId) });
  }
  const end = await addPremiumDays(id, days);
  try {
    await ctx.telegram.sendMessage(id, [
      "✦ ᴀᴋꜱᴇꜱ ᴘʀᴇᴍɪᴜᴍ ᴀᴋᴛɪꜰ",
      "",
      `<blockquote>⊹ ᴅᴜʀᴀꜱɪ ⦂ +${days} ʜᴀʀɪ`,
      `⊹ ʙᴇʀᴀᴋʜɪʀ ⦂ ${formatWIB(end.toISOString())}</blockquote>`
    ].join("\n"), { parse_mode: "HTML", ...mainKeyboard(id) });
  } catch (_) {}
  await ctx.reply(`✦ ᴜꜱᴇʀ <code>${id}</code> ᴘʀᴇᴍɪᴜᴍ +${days}ʜ · ʙᴇʀᴀᴋʜɪʀ ${formatWIB(end.toISOString())}`, {
    parse_mode: "HTML",
    ...mainKeyboard(adminId)
  });
});

bot.command("delpremium", async (ctx) => {
  const adminId = ctx.from.id;
  if (!ADMIN_IDS.includes(adminId)) return ctx.reply("⚠ ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  const id = parseInt(ctx.message.text.split(/\s+/)[1], 10);
  if (!id) return ctx.reply("⚠ ꜰᴏʀᴍᴀᴛ ⦂ <code>/delpremium 8062935882</code>", { parse_mode: "HTML", ...mainKeyboard(adminId) });
  await removePremiumUser(id);
  await ctx.reply(`✦ ᴜꜱᴇʀ <code>${id}</code> ꜱᴇᴋᴀʀᴀɴɢ ꜰʀᴇᴇ`, {
    parse_mode: "HTML",
    ...mainKeyboard(adminId)
  });
});

bot.command("setpayment", async (ctx) => {
  const adminId = ctx.from.id;
  if (!ADMIN_IDS.includes(adminId)) return ctx.reply("⚠ ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  const info = ctx.message.text.split(" ").slice(1).join(" ").trim();
  if (!info) return ctx.reply("⚠ ꜰᴏʀᴍᴀᴛ ⦂ /setpayment <ᴛᴇᴋꜱ ɪɴꜱᴛʀᴜᴋꜱɪ>", mainKeyboard(adminId));
  await setSetting("payment_info", info);
  await ctx.reply("✦ ɪɴꜱᴛʀᴜᴋꜱɪ ᴘᴇᴍʙᴀʏᴀʀᴀɴ ᴅɪᴘᴇʀʙᴀʀᴜɪ", mainKeyboard(adminId));
});

bot.command("setcontact", async (ctx) => {
  const adminId = ctx.from.id;
  if (!ADMIN_IDS.includes(adminId)) return ctx.reply("⚠ ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  const c = ctx.message.text.split(" ")[1];
  if (!c) return ctx.reply("⚠ ꜰᴏʀᴍᴀᴛ ⦂ /setcontact <@ᴜꜱᴇʀɴᴀᴍᴇ>", mainKeyboard(adminId));
  await setSetting("admin_contact", c);
  await ctx.reply("✦ ᴋᴏɴᴛᴀᴋ ᴀᴅᴍɪɴ ᴅɪᴘᴇʀʙᴀʀᴜɪ", mainKeyboard(adminId));
});

bot.on("photo", async (ctx) => {
  const userId = ctx.from.id;
  if (ADMIN_IDS.includes(userId) && adminState.has(userId)) {
    const st = adminState.get(userId);
    if (st.action === "bc") {
      adminState.delete(userId);
      return runBroadcast(ctx, ctx.message);
    }
  }
  const ids = await redis.smembers("payments:pending");
  let target = null;
  for (const pid of ids) {
    const p = parseRedisHash(await redis.hgetall(`payment:${pid}`));
    if (p && Number(p.user_id) === userId && p.status === "pending") { target = p; break; }
  }
  if (!target) {
    return ctx.reply("⚠ ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴛᴀɢɪʜᴀɴ ᴘᴇɴᴅɪɴɢ\n⟢ ᴘɪʟɪʜ ᴘᴀᴋᴇᴛ ᴘʀᴇᴍɪᴜᴍ ᴛᴇʀʟᴇʙɪʜ ᴅᴀʜᴜʟᴜ", mainKeyboard(userId));
  }
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  await redis.hset(`payment:${target.id}`, { status: "review", proof_file_id: photo.file_id });
  for (const adminId of ADMIN_IDS) {
    try {
      await ctx.telegram.sendPhoto(adminId, photo.file_id, {
        caption: [
          "✦ ʙᴜᴋᴛɪ ᴘᴇᴍʙᴀʏᴀʀᴀɴ ʙᴀʀᴜ",
          "",
          `<blockquote>⟡ ɪɴᴠᴏɪᴄᴇ ⦂ <code>${esc(target.invoice_id)}</code>`,
          `⊹ ᴜꜱᴇʀ ⦂ <code>${userId}</code>`,
          `⊹ ɴᴀᴍᴀ ⦂ ${esc([ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ") || "-")}`,
          `⊹ ᴜꜱᴇʀɴᴀᴍᴇ ⦂ ${ctx.from.username ? "@" + esc(ctx.from.username) : "-"}`,
          `⊹ ᴘᴀᴋᴇᴛ ⦂ ${target.plan_days} ʜᴀʀɪ`,
          `⊹ ʜᴀʀɢᴀ ⦂ ${formatRp(target.plan_price)}</blockquote>`
        ].join("\n"),
        parse_mode: "HTML",
        ...inlineKb([[
          btn("✓ ᴀᴘᴘʀᴏᴠᴇ", `apv_${target.id}`, "success"),
          btn("✕ ʀᴇᴊᴇᴄᴛ", `rjt_${target.id}`, "danger")
        ]])
      });
    } catch (_) {}
  }
  await clearInlinePanel(ctx, userId);
  await ctx.reply([
    "✦ ʙᴜᴋᴛɪ ᴅɪᴋɪʀɪᴍ",
    "",
    `<blockquote>⊹ ɪɴᴠᴏɪᴄᴇ ⦂ <code>${esc(target.invoice_id)}</code>`,
    "⟡ ᴍᴇɴᴜɴɢɢᴜ ᴋᴏɴꜰɪʀᴍᴀꜱɪ ᴀᴅᴍɪɴ</blockquote>"
  ].join("\n"), { parse_mode: "HTML", ...mainKeyboard(userId) });
});

bot.on("text", async (ctx, next) => {
  const userId = ctx.from.id;
  const txt = (ctx.message.text || "").trim();
  if (txt.startsWith("/") || ALL_MENU_TEXTS.has(txt)) {
    awaitingInput.delete(userId);
    awaitingEmailInput.delete(userId);
    adminState.delete(userId);
    return next();
  }

  if (ADMIN_IDS.includes(userId) && adminState.has(userId)) {
    const st = adminState.get(userId);
    adminState.delete(userId);
    const backKb = inlineKb([[btn("⟢ ᴋᴇᴍʙᴀʟɪ ᴋᴇ ᴘᴀɴᴇʟ", "admin", "primary")]]);

    if (st.action === "bc") {
      return runBroadcast(ctx, ctx.message);
    }

    if (st.action === "addprem") {
      const parts = txt.split(/\s+/);
      const targetId = parseInt(parts[0], 10);
      const days = parseInt(parts[1] || "1", 10);
      if (!targetId || isNaN(days) || days <= 0) {
        return showInlinePanel(ctx, "⚠ ꜰᴏʀᴍᴀᴛ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ. ᴄᴏɴᴛᴏʜ ⦂ <code>8062935882 7</code>", backKb, false);
      }
      const end = await addPremiumDays(targetId, days);
      try {
        await ctx.telegram.sendMessage(targetId, [
          "✦ ᴀᴋꜱᴇꜱ ᴘʀᴇᴍɪᴜᴍ ᴀᴋᴛɪꜰ",
          "",
          `<blockquote>⊹ ᴅᴜʀᴀꜱɪ ⦂ +${days} ʜᴀʀɪ`,
          `⊹ ʙᴇʀᴀᴋʜɪʀ ⦂ ${formatWIB(end.toISOString())}</blockquote>`
        ].join("\n"), { parse_mode: "HTML", ...mainKeyboard(targetId) });
      } catch (_) {}
      return showInlinePanel(ctx, [
        "✦ ᴘʀᴇᴍɪᴜᴍ ᴅɪᴛᴀᴍʙᴀʜᴋᴀɴ",
        "",
        `<blockquote>▸ ᴜꜱᴇʀ ɪᴅ ⦂ <code>${targetId}</code>`,
        `▸ ᴅᴜʀᴀꜱɪ ⦂ +${days} ʜᴀʀɪ`,
        `▸ ʙᴇʀᴀᴋʜɪʀ ⦂ ${formatWIB(end.toISOString())}</blockquote>`
      ].join("\n"), backKb, false);
    }

    if (st.action === "delprem") {
      const targetId = parseInt(txt.split(/\s+/)[0], 10);
      if (!targetId) {
        return showInlinePanel(ctx, "⚠ ᴜꜱᴇʀ ɪᴅ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ", backKb, false);
      }
      await removePremiumUser(targetId);
      return showInlinePanel(ctx, `✦ ᴀᴋꜱᴇꜱ ᴘʀᴇᴍɪᴜᴍ ᴜꜱᴇʀ <code>${targetId}</code> ᴛᴇʟᴀʜ ᴅɪʜᴀᴘᴜꜱ`, backKb, false);
    }

    if (st.action === "setpay") {
      await setSetting("payment_info", txt);
      return showInlinePanel(ctx, "✦ ɪɴꜱᴛʀᴜᴋꜱɪ ᴘᴇᴍʙᴀʏᴀʀᴀɴ ʙᴇʀʜᴀꜱɪʟ ᴅɪᴘᴇʀʙᴀʀᴜɪ", backKb, false);
    }

    if (st.action === "setcontact") {
      await setSetting("admin_contact", txt);
      return showInlinePanel(ctx, "✦ ᴋᴏɴᴛᴀᴋ ᴀᴅᴍɪɴ ʙᴇʀʜᴀꜱɪʟ ᴅɪᴘᴇʀʙᴀʀᴜɪ", backKb, false);
    }
  }

  if (awaitingEmailInput.has(userId)) {
    awaitingEmailInput.delete(userId);
    return processEmailFix(ctx, txt);
  }

  if (!awaitingInput.has(userId)) return next();
  awaitingInput.delete(userId);
  return processNumbers(ctx, txt);
});

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

(async () => {
  await migrateFromSQLite();
  const me = await bot.telegram.getMe();
  BOT_USERNAME = me.username;
  await bot.telegram.setMyCommands([
    { command: "start", description: "Buka dashboard utama" },
    { command: "detect", description: "Deteksi nomor WhatsApp" },
    { command: "email", description: "Cek ketersediaan verifikasi email" },
    { command: "cancel", description: "Batalkan aksi saat ini" }
  ]);
  await bot.launch();
  console.log("Bot running as @" + BOT_USERNAME);
})();

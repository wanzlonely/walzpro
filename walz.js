var WADetector = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // bridge_entry.js
  var bridge_entry_exports = {};
  __export(bridge_entry_exports, {
    buildDualPayloads: () => buildDualPayloads,
    buildRegisterPayloads: () => buildRegisterPayloads,
    parseDualResponse: () => parseDualResponse
  });

  // src/countries.js
  var MCC_MAP = {
    "93": 412,
    "355": 276,
    "213": 603,
    "1-684": 544,
    "376": 213,
    "244": 631,
    "1-264": 365,
    "1-268": 344,
    "54": 722,
    "374": 283,
    "297": 363,
    "61": 505,
    "43": 232,
    "994": 400,
    "1-242": 364,
    "973": 426,
    "880": 470,
    "1-246": 342,
    "375": 257,
    "32": 206,
    "501": 702,
    "229": 616,
    "1-441": 350,
    "975": 402,
    "591": 736,
    "387": 218,
    "267": 652,
    "55": 724,
    "1-284": 348,
    "673": 528,
    "359": 284,
    "226": 613,
    "257": 642,
    "855": 456,
    "237": 624,
    "238": 625,
    "1-345": 346,
    "236": 623,
    "235": 622,
    "56": 730,
    "86": 460,
    "57": 732,
    "269": 654,
    "682": 548,
    "506": 712,
    "385": 219,
    "53": 368,
    "357": 280,
    "420": 230,
    "243": 630,
    "45": 238,
    "253": 638,
    "1-767": 366,
    "1-809": 370,
    "1-849": 370,
    "1-829": 370,
    "593": 740,
    "20": 602,
    "503": 706,
    "240": 627,
    "291": 657,
    "372": 248,
    "251": 636,
    "500": 750,
    "298": 288,
    "679": 542,
    "358": 244,
    "33": 208,
    "689": 547,
    "241": 628,
    "220": 607,
    "995": 282,
    "49": 262,
    "233": 620,
    "350": 266,
    "30": 202,
    "299": 290,
    "1-473": 352,
    "590": 340,
    "1-671": 535,
    "502": 704,
    "224": 611,
    "245": 632,
    "592": 738,
    "509": 372,
    "504": 708,
    "852": 454,
    "36": 216,
    "354": 274,
    "91": 404,
    "62": 510,
    "98": 432,
    "964": 418,
    "353": 272,
    "972": 425,
    "39": 222,
    "225": 612,
    "1-876": 338,
    "1-658": 338,
    "81": 440,
    "962": 416,
    "7-7": 401,
    "7-6": 401,
    "254": 639,
    "686": 545,
    "383": 221,
    "965": 419,
    "996": 437,
    "856": 457,
    "371": 247,
    "961": 415,
    "266": 651,
    "231": 618,
    "218": 606,
    "423": 295,
    "370": 246,
    "352": 270,
    "853": 455,
    "389": 294,
    "261": 646,
    "265": 650,
    "60": 502,
    "960": 472,
    "223": 610,
    "356": 278,
    "692": 551,
    "596": 340,
    "222": 609,
    "230": 617,
    "52": 334,
    "691": 550,
    "373": 259,
    "377": 212,
    "976": 428,
    "382": 297,
    "1-664": 354,
    "212": 604,
    "258": 643,
    "95": 414,
    "264": 649,
    "674": 536,
    "977": 429,
    "31": 204,
    "687": 546,
    "64": 530,
    "505": 710,
    "227": 614,
    "234": 621,
    "683": 555,
    "850": 467,
    "1-670": 534,
    "47": 242,
    "968": 422,
    "92": 410,
    "680": 552,
    "970": 425,
    "507": 714,
    "675": 537,
    "595": 744,
    "51": 716,
    "63": 515,
    "48": 260,
    "351": 268,
    "1-787": 330,
    "1-939": 330,
    "974": 427,
    "242": 629,
    "262": 647,
    "40": 226,
    "7": 250,
    "250": 635,
    "290": 658,
    "1-869": 356,
    "1-758": 358,
    "508": 308,
    "1-784": 360,
    "685": 549,
    "378": 292,
    "239": 626,
    "966": 420,
    "221": 608,
    "381": 220,
    "248": 633,
    "232": 619,
    "65": 525,
    "1-721": 362,
    "421": 231,
    "386": 293,
    "677": 540,
    "252": 637,
    "27": 655,
    "82": 450,
    "211": 659,
    "34": 214,
    "94": 413,
    "249": 634,
    "597": 746,
    "268": 653,
    "46": 240,
    "41": 228,
    "963": 417,
    "886": 466,
    "992": 436,
    "255": 640,
    "66": 520,
    "670": 514,
    "228": 615,
    "690": 554,
    "676": 539,
    "1-868": 374,
    "216": 605,
    "90": 286,
    "993": 438,
    "1-649": 376,
    "688": 553,
    "1-340": 332,
    "256": 641,
    "380": 255,
    "971": 424,
    "44": 234,
    "1": 310,
    "598": 748,
    "998": 434,
    "678": 541,
    "379": 225,
    "58": 734,
    "84": 452,
    "681": 543,
    "967": 421,
    "260": 645,
    "263": 648,
    "599": 362
  };
  var CANADA_AREA_CODES = /* @__PURE__ */ new Set([
    "204",
    "226",
    "236",
    "249",
    "250",
    "263",
    "289",
    "306",
    "343",
    "354",
    "365",
    "367",
    "368",
    "382",
    "403",
    "416",
    "418",
    "428",
    "431",
    "437",
    "438",
    "450",
    "468",
    "474",
    "506",
    "514",
    "519",
    "548",
    "579",
    "581",
    "584",
    "587",
    "604",
    "613",
    "639",
    "647",
    "672",
    "683",
    "705",
    "709",
    "742",
    "753",
    "778",
    "780",
    "782",
    "807",
    "819",
    "825",
    "867",
    "873",
    "902",
    "905"
  ]);
  var COUNTRY_PROFILES = {
    "1": { iso: "US", lg: "en", mcc: "310", mnc: "260", name: "United States" },
    "1-CA": { iso: "CA", lg: "en", mcc: "302", mnc: "220", name: "Canada" },
    "1-787": { iso: "PR", lg: "es", mcc: "330", mnc: "110", name: "Puerto Rico" },
    "1-939": { iso: "PR", lg: "es", mcc: "330", mnc: "110", name: "Puerto Rico" },
    "1-809": { iso: "DO", lg: "es", mcc: "370", mnc: "001", name: "Dominican Republic" },
    "1-829": { iso: "DO", lg: "es", mcc: "370", mnc: "001", name: "Dominican Republic" },
    "1-849": { iso: "DO", lg: "es", mcc: "370", mnc: "001", name: "Dominican Republic" },
    "1-876": { iso: "JM", lg: "en", mcc: "338", mnc: "050", name: "Jamaica" },
    "1-658": { iso: "JM", lg: "en", mcc: "338", mnc: "050", name: "Jamaica" },
    "1-868": { iso: "TT", lg: "en", mcc: "374", mnc: "012", name: "Trinidad and Tobago" },
    "1-242": { iso: "BS", lg: "en", mcc: "364", mnc: "390", name: "Bahamas" },
    "1-246": { iso: "BB", lg: "en", mcc: "342", mnc: "600", name: "Barbados" },
    "7": { iso: "RU", lg: "ru", mcc: "250", mnc: "001", name: "Russia" },
    "7-KZ": { iso: "KZ", lg: "ru", mcc: "401", mnc: "002", name: "Kazakhstan" },
    "20": { iso: "EG", lg: "ar", mcc: "602", mnc: "001", name: "Egypt" },
    "27": { iso: "ZA", lg: "en", mcc: "655", mnc: "001", name: "South Africa" },
    "30": { iso: "GR", lg: "el", mcc: "202", mnc: "001", name: "Greece" },
    "31": { iso: "NL", lg: "nl", mcc: "204", mnc: "004", name: "Netherlands" },
    "32": { iso: "BE", lg: "nl", mcc: "206", mnc: "001", name: "Belgium" },
    "33": { iso: "FR", lg: "fr", mcc: "208", mnc: "001", name: "France" },
    "34": { iso: "ES", lg: "es", mcc: "214", mnc: "001", name: "Spain" },
    "36": { iso: "HU", lg: "hu", mcc: "216", mnc: "001", name: "Hungary" },
    "39": { iso: "IT", lg: "it", mcc: "222", mnc: "001", name: "Italy" },
    "40": { iso: "RO", lg: "ro", mcc: "226", mnc: "001", name: "Romania" },
    "41": { iso: "CH", lg: "de", mcc: "228", mnc: "001", name: "Switzerland" },
    "43": { iso: "AT", lg: "de", mcc: "232", mnc: "001", name: "Austria" },
    "44": { iso: "GB", lg: "en", mcc: "234", mnc: "015", name: "United Kingdom" },
    "45": { iso: "DK", lg: "da", mcc: "238", mnc: "001", name: "Denmark" },
    "46": { iso: "SE", lg: "sv", mcc: "240", mnc: "001", name: "Sweden" },
    "47": { iso: "NO", lg: "nb", mcc: "242", mnc: "001", name: "Norway" },
    "48": { iso: "PL", lg: "pl", mcc: "260", mnc: "001", name: "Poland" },
    "49": { iso: "DE", lg: "de", mcc: "262", mnc: "001", name: "Germany" },
    "51": { iso: "PE", lg: "es", mcc: "716", mnc: "006", name: "Peru" },
    "52": { iso: "MX", lg: "es", mcc: "334", mnc: "020", name: "Mexico" },
    "53": { iso: "CU", lg: "es", mcc: "368", mnc: "001", name: "Cuba" },
    "54": { iso: "AR", lg: "es", mcc: "722", mnc: "310", name: "Argentina" },
    "55": { iso: "BR", lg: "pt", mcc: "724", mnc: "005", name: "Brazil" },
    "56": { iso: "CL", lg: "es", mcc: "730", mnc: "001", name: "Chile" },
    "57": { iso: "CO", lg: "es", mcc: "732", mnc: "101", name: "Colombia" },
    "58": { iso: "VE", lg: "es", mcc: "734", mnc: "004", name: "Venezuela" },
    "60": { iso: "MY", lg: "ms", mcc: "502", mnc: "012", name: "Malaysia" },
    "61": { iso: "AU", lg: "en", mcc: "505", mnc: "001", name: "Australia" },
    "62": { iso: "ID", lg: "id", mcc: "510", mnc: "010", name: "Indonesia" },
    "63": { iso: "PH", lg: "en", mcc: "515", mnc: "002", name: "Philippines" },
    "64": { iso: "NZ", lg: "en", mcc: "530", mnc: "001", name: "New Zealand" },
    "65": { iso: "SG", lg: "en", mcc: "525", mnc: "001", name: "Singapore" },
    "66": { iso: "TH", lg: "th", mcc: "520", mnc: "001", name: "Thailand" },
    "81": { iso: "JP", lg: "ja", mcc: "440", mnc: "010", name: "Japan" },
    "82": { iso: "KR", lg: "ko", mcc: "450", mnc: "005", name: "South Korea" },
    "84": { iso: "VN", lg: "vi", mcc: "452", mnc: "001", name: "Vietnam" },
    "86": { iso: "CN", lg: "zh", mcc: "460", mnc: "000", name: "China" },
    "90": { iso: "TR", lg: "tr", mcc: "286", mnc: "001", name: "Turkey" },
    "91": { iso: "IN", lg: "en", mcc: "404", mnc: "010", name: "India" },
    "92": { iso: "PK", lg: "ur", mcc: "410", mnc: "001", name: "Pakistan" },
    "93": { iso: "AF", lg: "fa", mcc: "412", mnc: "001", name: "Afghanistan" },
    "94": { iso: "LK", lg: "en", mcc: "413", mnc: "001", name: "Sri Lanka" },
    "95": { iso: "MM", lg: "my", mcc: "414", mnc: "001", name: "Myanmar" },
    "98": { iso: "IR", lg: "fa", mcc: "432", mnc: "011", name: "Iran" },
    "211": { iso: "SS", lg: "en", mcc: "659", mnc: "002", name: "South Sudan" },
    "212": { iso: "MA", lg: "ar", mcc: "604", mnc: "001", name: "Morocco" },
    "213": { iso: "DZ", lg: "ar", mcc: "603", mnc: "001", name: "Algeria" },
    "216": { iso: "TN", lg: "ar", mcc: "605", mnc: "001", name: "Tunisia" },
    "218": { iso: "LY", lg: "ar", mcc: "606", mnc: "000", name: "Libya" },
    "220": { iso: "GM", lg: "en", mcc: "607", mnc: "001", name: "Gambia" },
    "221": { iso: "SN", lg: "fr", mcc: "608", mnc: "001", name: "Senegal" },
    "222": { iso: "MR", lg: "ar", mcc: "609", mnc: "001", name: "Mauritania" },
    "223": { iso: "ML", lg: "fr", mcc: "610", mnc: "001", name: "Mali" },
    "224": { iso: "GN", lg: "fr", mcc: "611", mnc: "001", name: "Guinea" },
    "225": { iso: "CI", lg: "fr", mcc: "612", mnc: "003", name: "Ivory Coast" },
    "226": { iso: "BF", lg: "fr", mcc: "613", mnc: "002", name: "Burkina Faso" },
    "227": { iso: "NE", lg: "fr", mcc: "614", mnc: "002", name: "Niger" },
    "228": { iso: "TG", lg: "fr", mcc: "615", mnc: "001", name: "Togo" },
    "229": { iso: "BJ", lg: "fr", mcc: "616", mnc: "002", name: "Benin" },
    "230": { iso: "MU", lg: "en", mcc: "617", mnc: "001", name: "Mauritius" },
    "231": { iso: "LR", lg: "en", mcc: "618", mnc: "001", name: "Liberia" },
    "232": { iso: "SL", lg: "en", mcc: "619", mnc: "001", name: "Sierra Leone" },
    "233": { iso: "GH", lg: "en", mcc: "620", mnc: "001", name: "Ghana" },
    "234": { iso: "NG", lg: "en", mcc: "621", mnc: "030", name: "Nigeria" },
    "235": { iso: "TD", lg: "fr", mcc: "622", mnc: "001", name: "Chad" },
    "236": { iso: "CF", lg: "fr", mcc: "623", mnc: "001", name: "Central African Republic" },
    "237": { iso: "CM", lg: "fr", mcc: "624", mnc: "001", name: "Cameroon" },
    "238": { iso: "CV", lg: "pt", mcc: "625", mnc: "001", name: "Cape Verde" },
    "240": { iso: "GQ", lg: "es", mcc: "627", mnc: "001", name: "Equatorial Guinea" },
    "241": { iso: "GA", lg: "fr", mcc: "628", mnc: "001", name: "Gabon" },
    "242": { iso: "CG", lg: "fr", mcc: "629", mnc: "001", name: "Republic of the Congo" },
    "243": { iso: "CD", lg: "fr", mcc: "630", mnc: "001", name: "DR Congo" },
    "244": { iso: "AO", lg: "pt", mcc: "631", mnc: "002", name: "Angola" },
    "245": { iso: "GW", lg: "pt", mcc: "632", mnc: "002", name: "Guinea-Bissau" },
    "248": { iso: "SC", lg: "en", mcc: "633", mnc: "001", name: "Seychelles" },
    "249": { iso: "SD", lg: "ar", mcc: "634", mnc: "001", name: "Sudan" },
    "250": { iso: "RW", lg: "en", mcc: "635", mnc: "010", name: "Rwanda" },
    "251": { iso: "ET", lg: "am", mcc: "636", mnc: "001", name: "Ethiopia" },
    "252": { iso: "SO", lg: "so", mcc: "637", mnc: "001", name: "Somalia" },
    "253": { iso: "DJ", lg: "fr", mcc: "638", mnc: "001", name: "Djibouti" },
    "254": { iso: "KE", lg: "en", mcc: "639", mnc: "002", name: "Kenya" },
    "255": { iso: "TZ", lg: "sw", mcc: "640", mnc: "002", name: "Tanzania" },
    "256": { iso: "UG", lg: "en", mcc: "641", mnc: "010", name: "Uganda" },
    "257": { iso: "BI", lg: "fr", mcc: "642", mnc: "001", name: "Burundi" },
    "258": { iso: "MZ", lg: "pt", mcc: "643", mnc: "001", name: "Mozambique" },
    "260": { iso: "ZM", lg: "en", mcc: "645", mnc: "001", name: "Zambia" },
    "261": { iso: "MG", lg: "fr", mcc: "646", mnc: "001", name: "Madagascar" },
    "262": { iso: "RE", lg: "fr", mcc: "647", mnc: "010", name: "Reunion" },
    "263": { iso: "ZW", lg: "en", mcc: "648", mnc: "001", name: "Zimbabwe" },
    "264": { iso: "NA", lg: "en", mcc: "649", mnc: "001", name: "Namibia" },
    "265": { iso: "MW", lg: "en", mcc: "650", mnc: "001", name: "Malawi" },
    "266": { iso: "LS", lg: "en", mcc: "651", mnc: "001", name: "Lesotho" },
    "267": { iso: "BW", lg: "en", mcc: "652", mnc: "001", name: "Botswana" },
    "268": { iso: "SZ", lg: "en", mcc: "653", mnc: "010", name: "Eswatini" },
    "269": { iso: "KM", lg: "fr", mcc: "654", mnc: "001", name: "Comoros" },
    "351": { iso: "PT", lg: "pt", mcc: "268", mnc: "001", name: "Portugal" },
    "352": { iso: "LU", lg: "fr", mcc: "270", mnc: "001", name: "Luxembourg" },
    "353": { iso: "IE", lg: "en", mcc: "272", mnc: "001", name: "Ireland" },
    "354": { iso: "IS", lg: "is", mcc: "274", mnc: "001", name: "Iceland" },
    "355": { iso: "AL", lg: "sq", mcc: "276", mnc: "001", name: "Albania" },
    "356": { iso: "MT", lg: "en", mcc: "278", mnc: "001", name: "Malta" },
    "357": { iso: "CY", lg: "el", mcc: "280", mnc: "001", name: "Cyprus" },
    "358": { iso: "FI", lg: "fi", mcc: "244", mnc: "005", name: "Finland" },
    "359": { iso: "BG", lg: "bg", mcc: "284", mnc: "001", name: "Bulgaria" },
    "370": { iso: "LT", lg: "lt", mcc: "246", mnc: "001", name: "Lithuania" },
    "371": { iso: "LV", lg: "lv", mcc: "247", mnc: "001", name: "Latvia" },
    "372": { iso: "EE", lg: "et", mcc: "248", mnc: "001", name: "Estonia" },
    "373": { iso: "MD", lg: "ro", mcc: "259", mnc: "001", name: "Moldova" },
    "374": { iso: "AM", lg: "hy", mcc: "283", mnc: "001", name: "Armenia" },
    "375": { iso: "BY", lg: "ru", mcc: "257", mnc: "001", name: "Belarus" },
    "376": { iso: "AD", lg: "ca", mcc: "213", mnc: "003", name: "Andorra" },
    "377": { iso: "MC", lg: "fr", mcc: "212", mnc: "010", name: "Monaco" },
    "380": { iso: "UA", lg: "uk", mcc: "255", mnc: "001", name: "Ukraine" },
    "381": { iso: "RS", lg: "sr", mcc: "220", mnc: "001", name: "Serbia" },
    "382": { iso: "ME", lg: "sr", mcc: "297", mnc: "001", name: "Montenegro" },
    "383": { iso: "XK", lg: "sq", mcc: "221", mnc: "001", name: "Kosovo" },
    "385": { iso: "HR", lg: "hr", mcc: "219", mnc: "001", name: "Croatia" },
    "386": { iso: "SI", lg: "sl", mcc: "293", mnc: "040", name: "Slovenia" },
    "387": { iso: "BA", lg: "bs", mcc: "218", mnc: "090", name: "Bosnia and Herzegovina" },
    "389": { iso: "MK", lg: "mk", mcc: "294", mnc: "001", name: "North Macedonia" },
    "420": { iso: "CZ", lg: "cs", mcc: "230", mnc: "001", name: "Czech Republic" },
    "421": { iso: "SK", lg: "sk", mcc: "231", mnc: "001", name: "Slovakia" },
    "423": { iso: "LI", lg: "de", mcc: "295", mnc: "001", name: "Liechtenstein" },
    "501": { iso: "BZ", lg: "en", mcc: "702", mnc: "067", name: "Belize" },
    "502": { iso: "GT", lg: "es", mcc: "704", mnc: "001", name: "Guatemala" },
    "503": { iso: "SV", lg: "es", mcc: "706", mnc: "001", name: "El Salvador" },
    "504": { iso: "HN", lg: "es", mcc: "708", mnc: "001", name: "Honduras" },
    "505": { iso: "NI", lg: "es", mcc: "710", mnc: "021", name: "Nicaragua" },
    "506": { iso: "CR", lg: "es", mcc: "712", mnc: "001", name: "Costa Rica" },
    "507": { iso: "PA", lg: "es", mcc: "714", mnc: "001", name: "Panama" },
    "509": { iso: "HT", lg: "fr", mcc: "372", mnc: "001", name: "Haiti" },
    "591": { iso: "BO", lg: "es", mcc: "736", mnc: "001", name: "Bolivia" },
    "592": { iso: "GY", lg: "en", mcc: "738", mnc: "001", name: "Guyana" },
    "593": { iso: "EC", lg: "es", mcc: "740", mnc: "000", name: "Ecuador" },
    "595": { iso: "PY", lg: "es", mcc: "744", mnc: "001", name: "Paraguay" },
    "597": { iso: "SR", lg: "nl", mcc: "746", mnc: "002", name: "Suriname" },
    "598": { iso: "UY", lg: "es", mcc: "748", mnc: "001", name: "Uruguay" },
    "599": { iso: "CW", lg: "nl", mcc: "362", mnc: "051", name: "Curacao" },
    "670": { iso: "TL", lg: "pt", mcc: "514", mnc: "002", name: "Timor-Leste" },
    "673": { iso: "BN", lg: "ms", mcc: "528", mnc: "011", name: "Brunei" },
    "675": { iso: "PG", lg: "en", mcc: "537", mnc: "001", name: "Papua New Guinea" },
    "676": { iso: "TO", lg: "en", mcc: "539", mnc: "001", name: "Tonga" },
    "677": { iso: "SB", lg: "en", mcc: "540", mnc: "001", name: "Solomon Islands" },
    "678": { iso: "VU", lg: "en", mcc: "541", mnc: "001", name: "Vanuatu" },
    "679": { iso: "FJ", lg: "en", mcc: "542", mnc: "001", name: "Fiji" },
    "685": { iso: "WS", lg: "en", mcc: "549", mnc: "001", name: "Samoa" },
    "852": { iso: "HK", lg: "zh", mcc: "454", mnc: "000", name: "Hong Kong" },
    "853": { iso: "MO", lg: "zh", mcc: "455", mnc: "001", name: "Macau" },
    "855": { iso: "KH", lg: "km", mcc: "456", mnc: "001", name: "Cambodia" },
    "856": { iso: "LA", lg: "lo", mcc: "457", mnc: "001", name: "Laos" },
    "880": { iso: "BD", lg: "bn", mcc: "470", mnc: "001", name: "Bangladesh" },
    "886": { iso: "TW", lg: "zh", mcc: "466", mnc: "092", name: "Taiwan" },
    "960": { iso: "MV", lg: "dv", mcc: "472", mnc: "001", name: "Maldives" },
    "961": { iso: "LB", lg: "ar", mcc: "415", mnc: "001", name: "Lebanon" },
    "962": { iso: "JO", lg: "ar", mcc: "416", mnc: "001", name: "Jordan" },
    "963": { iso: "SY", lg: "ar", mcc: "417", mnc: "001", name: "Syria" },
    "964": { iso: "IQ", lg: "ar", mcc: "418", mnc: "005", name: "Iraq" },
    "965": { iso: "KW", lg: "ar", mcc: "419", mnc: "002", name: "Kuwait" },
    "966": { iso: "SA", lg: "ar", mcc: "420", mnc: "001", name: "Saudi Arabia" },
    "967": { iso: "YE", lg: "ar", mcc: "421", mnc: "001", name: "Yemen" },
    "968": { iso: "OM", lg: "ar", mcc: "422", mnc: "002", name: "Oman" },
    "970": { iso: "PS", lg: "ar", mcc: "425", mnc: "005", name: "Palestine" },
    "971": { iso: "AE", lg: "ar", mcc: "424", mnc: "002", name: "United Arab Emirates" },
    "972": { iso: "IL", lg: "he", mcc: "425", mnc: "001", name: "Israel" },
    "973": { iso: "BH", lg: "ar", mcc: "426", mnc: "001", name: "Bahrain" },
    "974": { iso: "QA", lg: "ar", mcc: "427", mnc: "001", name: "Qatar" },
    "975": { iso: "BT", lg: "dz", mcc: "402", mnc: "011", name: "Bhutan" },
    "976": { iso: "MN", lg: "mn", mcc: "428", mnc: "099", name: "Mongolia" },
    "977": { iso: "NP", lg: "ne", mcc: "429", mnc: "001", name: "Nepal" },
    "992": { iso: "TJ", lg: "tg", mcc: "436", mnc: "001", name: "Tajikistan" },
    "993": { iso: "TM", lg: "tk", mcc: "438", mnc: "001", name: "Turkmenistan" },
    "994": { iso: "AZ", lg: "az", mcc: "400", mnc: "001", name: "Azerbaijan" },
    "995": { iso: "GE", lg: "ka", mcc: "282", mnc: "001", name: "Georgia" },
    "996": { iso: "KG", lg: "ky", mcc: "437", mnc: "001", name: "Kyrgyzstan" },
    "998": { iso: "UZ", lg: "uz", mcc: "434", mnc: "004", name: "Uzbekistan" }
  };
  var ISO_TO_CC = Object.fromEntries(
    Object.entries(COUNTRY_PROFILES).filter(([k]) => !k.includes("-")).map(([cc, meta]) => [meta.iso.toUpperCase(), cc])
  );
  function resolveCountryProfile(cc, nationalNumber = "") {
    const cleanCc = String(cc).replace(/\D/g, "");
    const cleanIn = String(nationalNumber).replace(/\D/g, "");
    if (cleanCc === "1") {
      const area = cleanIn.slice(0, 3);
      if (COUNTRY_PROFILES[`1-${area}`]) {
        return COUNTRY_PROFILES[`1-${area}`];
      }
      if (CANADA_AREA_CODES.has(area)) {
        return COUNTRY_PROFILES["1-CA"];
      }
      const subMcc = MCC_MAP[`1-${area}`];
      if (subMcc) {
        return { iso: "US", lg: "en", mcc: String(subMcc).padStart(3, "0"), mnc: "001", name: `NANP (+1-${area})` };
      }
      return COUNTRY_PROFILES["1"];
    }
    if (cleanCc === "7") {
      if (cleanIn.startsWith("6") || cleanIn.startsWith("7")) {
        return COUNTRY_PROFILES["7-KZ"];
      }
      return COUNTRY_PROFILES["7"];
    }
    if (COUNTRY_PROFILES[cleanCc]) {
      return COUNTRY_PROFILES[cleanCc];
    }
    const rawMcc = MCC_MAP[cleanCc] || 310;
    return {
      iso: "US",
      lg: "en",
      mcc: String(rawMcc).padStart(3, "0"),
      mnc: "001",
      name: `Country (+${cleanCc})`
    };
  }
  function extractFirstSmartPhoneToken(dirtyStr) {
    let line = String(dirtyStr || "").trim();
    if (!line) return "";
    const waMeMatch = line.match(/wa\.me\/(\+?[\d\-]{7,18})/i);
    if (waMeMatch) {
      return waMeMatch[1];
    }
    line = line.replace(/[\(\[\{]([^)\]\}]+)[\)\]\}]/g, (full, inner) => {
      const trimmed = inner.trim();
      if (/[a-zA-Z]/.test(trimmed) || /^(199\d|20[0-3]\d)$/.test(trimmed)) {
        return " | ";
      }
      return full;
    });
    line = line.replace(/^\s*(?:no\.?\s*|#\s*)?\d{1,4}\s*[\.\)\:\-]\s*(?=[\+\d])/i, "");
    const candidateRegex = /(?:\+|00)?\d(?:[\d\-\.\(\)]|\s(?=[\d\(])){5,22}\d/g;
    const matches = line.match(candidateRegex) || [];
    for (const rawCandidate of matches) {
      const hasPlus = rawCandidate.trim().startsWith("+");
      const spaceParts = rawCandidate.trim().split(/\s+/);
      let accumulatedDigits = "";
      for (let i = 0; i < spaceParts.length; i++) {
        const partDigits = spaceParts[i].replace(/\D/g, "");
        if (!partDigits) continue;
        if (accumulatedDigits.length >= 9) {
          if (/^(199\d|20[0-3]\d)$/.test(partDigits) || accumulatedDigits.length + partDigits.length > 15) {
            break;
          }
        }
        if (accumulatedDigits.length + partDigits.length > 15) {
          break;
        }
        accumulatedDigits += partDigits;
      }
      if (accumulatedDigits.length >= 7 && accumulatedDigits.length <= 15) {
        return (hasPlus ? "+" : "") + accumulatedDigits;
      }
    }
    return line;
  }
  function parsePhoneNumber(rawPhone, explicitCc = null, explicitIn = null, defaultCountry = null) {
    if (explicitCc && explicitIn) {
      const cleanCc = String(explicitCc).replace(/\D/g, "");
      let cleanIn = String(explicitIn).replace(/\D/g, "");
      if (cleanIn.startsWith("0") && cleanCc !== "39") {
        cleanIn = cleanIn.slice(1);
      }
      const profile = resolveCountryProfile(cleanCc, cleanIn);
      return {
        valid: Boolean(cleanCc && cleanIn.length >= 4),
        cc: cleanCc,
        in: cleanIn,
        full: cleanCc + cleanIn,
        mcc: String(profile.mcc).padStart(3, "0"),
        mnc: String(profile.mnc).padStart(3, "0"),
        iso: profile.iso,
        lg: profile.lg,
        country_name: profile.name
      };
    }
    const smartToken = extractFirstSmartPhoneToken(rawPhone);
    const hasPlus = smartToken.startsWith("+");
    let digits = smartToken.replace(/\D/g, "");
    if (!digits || digits.length < 7) {
      return { valid: false, error: "Phone number too short or empty" };
    }
    if (!hasPlus && digits.startsWith("00") && digits.length >= 9) {
      digits = digits.slice(2);
    }
    if (!hasPlus && digits.startsWith("0")) {
      let fallbackCc = null;
      if (defaultCountry) {
        const upper = String(defaultCountry).trim().toUpperCase();
        fallbackCc = ISO_TO_CC[upper] || String(defaultCountry).replace(/\D/g, "") || null;
      } else if (digits.startsWith("08") && digits.length >= 9 && digits.length <= 14) {
        fallbackCc = "62";
      }
      if (fallbackCc) {
        digits = fallbackCc + digits.slice(1);
      }
    }
    for (let len = 3; len >= 1; len--) {
      const prefix = digits.slice(0, len);
      if (Object.prototype.hasOwnProperty.call(MCC_MAP, prefix)) {
        let national = digits.slice(len);
        if (national.startsWith("0") && prefix !== "39" && national.length >= 8) {
          national = national.slice(1);
        }
        if (national.length >= 4 && national.length <= 14) {
          const profile = resolveCountryProfile(prefix, national);
          return {
            valid: true,
            cc: prefix,
            in: national,
            full: prefix + national,
            mcc: String(profile.mcc).padStart(3, "0"),
            mnc: String(profile.mnc).padStart(3, "0"),
            iso: profile.iso,
            lg: profile.lg,
            country_name: profile.name
          };
        }
      }
    }
    return { valid: false, error: "Unrecognized country code prefix" };
  }

  // src/crypto/curve25519.js
  var _0 = new Uint8Array(16);
  var _9 = new Uint8Array(32);
  _9[0] = 9;
  function gf(init) {
    var i, r = new Float64Array(16);
    if (init)
      for (i = 0; i < init.length; i++)
        r[i] = init[i];
    return r;
  }
  var gf0 = gf();
  var gf1 = gf([1]);
  var _121665 = gf([56129, 1]);
  var D = gf([
    30883,
    4953,
    19914,
    30187,
    55467,
    16705,
    2637,
    112,
    59544,
    30585,
    16505,
    36039,
    65139,
    11119,
    27886,
    20995
  ]);
  var D2 = gf([
    61785,
    9906,
    39828,
    60374,
    45398,
    33411,
    5274,
    224,
    53552,
    61171,
    33010,
    6542,
    64743,
    22239,
    55772,
    9222
  ]);
  var X = gf([
    54554,
    36645,
    11616,
    51542,
    42930,
    38181,
    51040,
    26924,
    56412,
    64982,
    57905,
    49316,
    21502,
    52590,
    14035,
    8553
  ]);
  var Y = gf([
    26200,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214,
    26214
  ]);
  var I = gf([
    41136,
    18958,
    6951,
    50414,
    58488,
    44335,
    6150,
    12099,
    55207,
    15867,
    153,
    11085,
    57099,
    20417,
    9344,
    11139
  ]);
  function ts64(x, i, h, l) {
    x[i] = h >> 24 & 255;
    x[i + 1] = h >> 16 & 255;
    x[i + 2] = h >> 8 & 255;
    x[i + 3] = h & 255;
    x[i + 4] = l >> 24 & 255;
    x[i + 5] = l >> 16 & 255;
    x[i + 6] = l >> 8 & 255;
    x[i + 7] = l & 255;
  }
  function set25519(r, a) {
    var i;
    for (i = 0; i < 16; i++)
      r[i] = a[i] | 0;
  }
  function car25519(o) {
    var i, v, c = 1;
    for (i = 0; i < 16; i++) {
      v = o[i] + c + 65535;
      c = Math.floor(v / 65536);
      o[i] = v - c * 65536;
    }
    o[0] += c - 1 + 37 * (c - 1);
  }
  function sel25519(p, q, b) {
    var t, c = ~(b - 1);
    for (var i = 0; i < 16; i++) {
      t = c & (p[i] ^ q[i]);
      p[i] ^= t;
      q[i] ^= t;
    }
  }
  function pack25519(o, n) {
    var i, j, b;
    var m = gf(), t = gf();
    for (i = 0; i < 16; i++)
      t[i] = n[i];
    car25519(t);
    car25519(t);
    car25519(t);
    for (j = 0; j < 2; j++) {
      m[0] = t[0] - 65517;
      for (i = 1; i < 15; i++) {
        m[i] = t[i] - 65535 - (m[i - 1] >> 16 & 1);
        m[i - 1] &= 65535;
      }
      m[15] = t[15] - 32767 - (m[14] >> 16 & 1);
      b = m[15] >> 16 & 1;
      m[14] &= 65535;
      sel25519(t, m, 1 - b);
    }
    for (i = 0; i < 16; i++) {
      o[2 * i] = t[i] & 255;
      o[2 * i + 1] = t[i] >> 8;
    }
  }
  function par25519(a) {
    var d = new Uint8Array(32);
    pack25519(d, a);
    return d[0] & 1;
  }
  function unpack25519(o, n) {
    var i;
    for (i = 0; i < 16; i++)
      o[i] = n[2 * i] + (n[2 * i + 1] << 8);
    o[15] &= 32767;
  }
  function A(o, a, b) {
    for (var i = 0; i < 16; i++)
      o[i] = a[i] + b[i];
  }
  function Z(o, a, b) {
    for (var i = 0; i < 16; i++)
      o[i] = a[i] - b[i];
  }
  function M(o, a, b) {
    var v, c, t0 = 0, t1 = 0, t2 = 0, t3 = 0, t4 = 0, t5 = 0, t6 = 0, t7 = 0, t8 = 0, t9 = 0, t10 = 0, t11 = 0, t12 = 0, t13 = 0, t14 = 0, t15 = 0, t16 = 0, t17 = 0, t18 = 0, t19 = 0, t20 = 0, t21 = 0, t22 = 0, t23 = 0, t24 = 0, t25 = 0, t26 = 0, t27 = 0, t28 = 0, t29 = 0, t30 = 0, b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7], b8 = b[8], b9 = b[9], b10 = b[10], b11 = b[11], b12 = b[12], b13 = b[13], b14 = b[14], b15 = b[15];
    v = a[0];
    t0 += v * b0;
    t1 += v * b1;
    t2 += v * b2;
    t3 += v * b3;
    t4 += v * b4;
    t5 += v * b5;
    t6 += v * b6;
    t7 += v * b7;
    t8 += v * b8;
    t9 += v * b9;
    t10 += v * b10;
    t11 += v * b11;
    t12 += v * b12;
    t13 += v * b13;
    t14 += v * b14;
    t15 += v * b15;
    v = a[1];
    t1 += v * b0;
    t2 += v * b1;
    t3 += v * b2;
    t4 += v * b3;
    t5 += v * b4;
    t6 += v * b5;
    t7 += v * b6;
    t8 += v * b7;
    t9 += v * b8;
    t10 += v * b9;
    t11 += v * b10;
    t12 += v * b11;
    t13 += v * b12;
    t14 += v * b13;
    t15 += v * b14;
    t16 += v * b15;
    v = a[2];
    t2 += v * b0;
    t3 += v * b1;
    t4 += v * b2;
    t5 += v * b3;
    t6 += v * b4;
    t7 += v * b5;
    t8 += v * b6;
    t9 += v * b7;
    t10 += v * b8;
    t11 += v * b9;
    t12 += v * b10;
    t13 += v * b11;
    t14 += v * b12;
    t15 += v * b13;
    t16 += v * b14;
    t17 += v * b15;
    v = a[3];
    t3 += v * b0;
    t4 += v * b1;
    t5 += v * b2;
    t6 += v * b3;
    t7 += v * b4;
    t8 += v * b5;
    t9 += v * b6;
    t10 += v * b7;
    t11 += v * b8;
    t12 += v * b9;
    t13 += v * b10;
    t14 += v * b11;
    t15 += v * b12;
    t16 += v * b13;
    t17 += v * b14;
    t18 += v * b15;
    v = a[4];
    t4 += v * b0;
    t5 += v * b1;
    t6 += v * b2;
    t7 += v * b3;
    t8 += v * b4;
    t9 += v * b5;
    t10 += v * b6;
    t11 += v * b7;
    t12 += v * b8;
    t13 += v * b9;
    t14 += v * b10;
    t15 += v * b11;
    t16 += v * b12;
    t17 += v * b13;
    t18 += v * b14;
    t19 += v * b15;
    v = a[5];
    t5 += v * b0;
    t6 += v * b1;
    t7 += v * b2;
    t8 += v * b3;
    t9 += v * b4;
    t10 += v * b5;
    t11 += v * b6;
    t12 += v * b7;
    t13 += v * b8;
    t14 += v * b9;
    t15 += v * b10;
    t16 += v * b11;
    t17 += v * b12;
    t18 += v * b13;
    t19 += v * b14;
    t20 += v * b15;
    v = a[6];
    t6 += v * b0;
    t7 += v * b1;
    t8 += v * b2;
    t9 += v * b3;
    t10 += v * b4;
    t11 += v * b5;
    t12 += v * b6;
    t13 += v * b7;
    t14 += v * b8;
    t15 += v * b9;
    t16 += v * b10;
    t17 += v * b11;
    t18 += v * b12;
    t19 += v * b13;
    t20 += v * b14;
    t21 += v * b15;
    v = a[7];
    t7 += v * b0;
    t8 += v * b1;
    t9 += v * b2;
    t10 += v * b3;
    t11 += v * b4;
    t12 += v * b5;
    t13 += v * b6;
    t14 += v * b7;
    t15 += v * b8;
    t16 += v * b9;
    t17 += v * b10;
    t18 += v * b11;
    t19 += v * b12;
    t20 += v * b13;
    t21 += v * b14;
    t22 += v * b15;
    v = a[8];
    t8 += v * b0;
    t9 += v * b1;
    t10 += v * b2;
    t11 += v * b3;
    t12 += v * b4;
    t13 += v * b5;
    t14 += v * b6;
    t15 += v * b7;
    t16 += v * b8;
    t17 += v * b9;
    t18 += v * b10;
    t19 += v * b11;
    t20 += v * b12;
    t21 += v * b13;
    t22 += v * b14;
    t23 += v * b15;
    v = a[9];
    t9 += v * b0;
    t10 += v * b1;
    t11 += v * b2;
    t12 += v * b3;
    t13 += v * b4;
    t14 += v * b5;
    t15 += v * b6;
    t16 += v * b7;
    t17 += v * b8;
    t18 += v * b9;
    t19 += v * b10;
    t20 += v * b11;
    t21 += v * b12;
    t22 += v * b13;
    t23 += v * b14;
    t24 += v * b15;
    v = a[10];
    t10 += v * b0;
    t11 += v * b1;
    t12 += v * b2;
    t13 += v * b3;
    t14 += v * b4;
    t15 += v * b5;
    t16 += v * b6;
    t17 += v * b7;
    t18 += v * b8;
    t19 += v * b9;
    t20 += v * b10;
    t21 += v * b11;
    t22 += v * b12;
    t23 += v * b13;
    t24 += v * b14;
    t25 += v * b15;
    v = a[11];
    t11 += v * b0;
    t12 += v * b1;
    t13 += v * b2;
    t14 += v * b3;
    t15 += v * b4;
    t16 += v * b5;
    t17 += v * b6;
    t18 += v * b7;
    t19 += v * b8;
    t20 += v * b9;
    t21 += v * b10;
    t22 += v * b11;
    t23 += v * b12;
    t24 += v * b13;
    t25 += v * b14;
    t26 += v * b15;
    v = a[12];
    t12 += v * b0;
    t13 += v * b1;
    t14 += v * b2;
    t15 += v * b3;
    t16 += v * b4;
    t17 += v * b5;
    t18 += v * b6;
    t19 += v * b7;
    t20 += v * b8;
    t21 += v * b9;
    t22 += v * b10;
    t23 += v * b11;
    t24 += v * b12;
    t25 += v * b13;
    t26 += v * b14;
    t27 += v * b15;
    v = a[13];
    t13 += v * b0;
    t14 += v * b1;
    t15 += v * b2;
    t16 += v * b3;
    t17 += v * b4;
    t18 += v * b5;
    t19 += v * b6;
    t20 += v * b7;
    t21 += v * b8;
    t22 += v * b9;
    t23 += v * b10;
    t24 += v * b11;
    t25 += v * b12;
    t26 += v * b13;
    t27 += v * b14;
    t28 += v * b15;
    v = a[14];
    t14 += v * b0;
    t15 += v * b1;
    t16 += v * b2;
    t17 += v * b3;
    t18 += v * b4;
    t19 += v * b5;
    t20 += v * b6;
    t21 += v * b7;
    t22 += v * b8;
    t23 += v * b9;
    t24 += v * b10;
    t25 += v * b11;
    t26 += v * b12;
    t27 += v * b13;
    t28 += v * b14;
    t29 += v * b15;
    v = a[15];
    t15 += v * b0;
    t16 += v * b1;
    t17 += v * b2;
    t18 += v * b3;
    t19 += v * b4;
    t20 += v * b5;
    t21 += v * b6;
    t22 += v * b7;
    t23 += v * b8;
    t24 += v * b9;
    t25 += v * b10;
    t26 += v * b11;
    t27 += v * b12;
    t28 += v * b13;
    t29 += v * b14;
    t30 += v * b15;
    t0 += 38 * t16;
    t1 += 38 * t17;
    t2 += 38 * t18;
    t3 += 38 * t19;
    t4 += 38 * t20;
    t5 += 38 * t21;
    t6 += 38 * t22;
    t7 += 38 * t23;
    t8 += 38 * t24;
    t9 += 38 * t25;
    t10 += 38 * t26;
    t11 += 38 * t27;
    t12 += 38 * t28;
    t13 += 38 * t29;
    t14 += 38 * t30;
    c = 1;
    v = t0 + c + 65535;
    c = Math.floor(v / 65536);
    t0 = v - c * 65536;
    v = t1 + c + 65535;
    c = Math.floor(v / 65536);
    t1 = v - c * 65536;
    v = t2 + c + 65535;
    c = Math.floor(v / 65536);
    t2 = v - c * 65536;
    v = t3 + c + 65535;
    c = Math.floor(v / 65536);
    t3 = v - c * 65536;
    v = t4 + c + 65535;
    c = Math.floor(v / 65536);
    t4 = v - c * 65536;
    v = t5 + c + 65535;
    c = Math.floor(v / 65536);
    t5 = v - c * 65536;
    v = t6 + c + 65535;
    c = Math.floor(v / 65536);
    t6 = v - c * 65536;
    v = t7 + c + 65535;
    c = Math.floor(v / 65536);
    t7 = v - c * 65536;
    v = t8 + c + 65535;
    c = Math.floor(v / 65536);
    t8 = v - c * 65536;
    v = t9 + c + 65535;
    c = Math.floor(v / 65536);
    t9 = v - c * 65536;
    v = t10 + c + 65535;
    c = Math.floor(v / 65536);
    t10 = v - c * 65536;
    v = t11 + c + 65535;
    c = Math.floor(v / 65536);
    t11 = v - c * 65536;
    v = t12 + c + 65535;
    c = Math.floor(v / 65536);
    t12 = v - c * 65536;
    v = t13 + c + 65535;
    c = Math.floor(v / 65536);
    t13 = v - c * 65536;
    v = t14 + c + 65535;
    c = Math.floor(v / 65536);
    t14 = v - c * 65536;
    v = t15 + c + 65535;
    c = Math.floor(v / 65536);
    t15 = v - c * 65536;
    t0 += c - 1 + 37 * (c - 1);
    c = 1;
    v = t0 + c + 65535;
    c = Math.floor(v / 65536);
    t0 = v - c * 65536;
    v = t1 + c + 65535;
    c = Math.floor(v / 65536);
    t1 = v - c * 65536;
    v = t2 + c + 65535;
    c = Math.floor(v / 65536);
    t2 = v - c * 65536;
    v = t3 + c + 65535;
    c = Math.floor(v / 65536);
    t3 = v - c * 65536;
    v = t4 + c + 65535;
    c = Math.floor(v / 65536);
    t4 = v - c * 65536;
    v = t5 + c + 65535;
    c = Math.floor(v / 65536);
    t5 = v - c * 65536;
    v = t6 + c + 65535;
    c = Math.floor(v / 65536);
    t6 = v - c * 65536;
    v = t7 + c + 65535;
    c = Math.floor(v / 65536);
    t7 = v - c * 65536;
    v = t8 + c + 65535;
    c = Math.floor(v / 65536);
    t8 = v - c * 65536;
    v = t9 + c + 65535;
    c = Math.floor(v / 65536);
    t9 = v - c * 65536;
    v = t10 + c + 65535;
    c = Math.floor(v / 65536);
    t10 = v - c * 65536;
    v = t11 + c + 65535;
    c = Math.floor(v / 65536);
    t11 = v - c * 65536;
    v = t12 + c + 65535;
    c = Math.floor(v / 65536);
    t12 = v - c * 65536;
    v = t13 + c + 65535;
    c = Math.floor(v / 65536);
    t13 = v - c * 65536;
    v = t14 + c + 65535;
    c = Math.floor(v / 65536);
    t14 = v - c * 65536;
    v = t15 + c + 65535;
    c = Math.floor(v / 65536);
    t15 = v - c * 65536;
    t0 += c - 1 + 37 * (c - 1);
    o[0] = t0;
    o[1] = t1;
    o[2] = t2;
    o[3] = t3;
    o[4] = t4;
    o[5] = t5;
    o[6] = t6;
    o[7] = t7;
    o[8] = t8;
    o[9] = t9;
    o[10] = t10;
    o[11] = t11;
    o[12] = t12;
    o[13] = t13;
    o[14] = t14;
    o[15] = t15;
  }
  function S(o, a) {
    M(o, a, a);
  }
  function inv25519(o, i) {
    var c = gf();
    var a;
    for (a = 0; a < 16; a++)
      c[a] = i[a];
    for (a = 253; a >= 0; a--) {
      S(c, c);
      if (a !== 2 && a !== 4)
        M(c, c, i);
    }
    for (a = 0; a < 16; a++)
      o[a] = c[a];
  }
  function crypto_scalarmult(q, n, p) {
    var z = new Uint8Array(32);
    var x = new Float64Array(80), r, i;
    var a = gf(), b = gf(), c = gf(), d = gf(), e = gf(), f = gf();
    for (i = 0; i < 31; i++)
      z[i] = n[i];
    z[31] = n[31] & 127 | 64;
    z[0] &= 248;
    unpack25519(x, p);
    for (i = 0; i < 16; i++) {
      b[i] = x[i];
      d[i] = a[i] = c[i] = 0;
    }
    a[0] = d[0] = 1;
    for (i = 254; i >= 0; --i) {
      r = z[i >>> 3] >>> (i & 7) & 1;
      sel25519(a, b, r);
      sel25519(c, d, r);
      A(e, a, c);
      Z(a, a, c);
      A(c, b, d);
      Z(b, b, d);
      S(d, e);
      S(f, a);
      M(a, c, a);
      M(c, b, e);
      A(e, a, c);
      Z(a, a, c);
      S(b, a);
      Z(c, d, f);
      M(a, c, _121665);
      A(a, a, d);
      M(c, c, a);
      M(a, d, f);
      M(d, b, x);
      S(b, e);
      sel25519(a, b, r);
      sel25519(c, d, r);
    }
    for (i = 0; i < 16; i++) {
      x[i + 16] = a[i];
      x[i + 32] = c[i];
      x[i + 48] = b[i];
      x[i + 64] = d[i];
    }
    var x32 = x.subarray(32);
    var x16 = x.subarray(16);
    inv25519(x32, x32);
    M(x16, x16, x32);
    pack25519(q, x16);
    return 0;
  }
  function crypto_scalarmult_base(q, n) {
    return crypto_scalarmult(q, n, _9);
  }
  var K = [
    1116352408,
    3609767458,
    1899447441,
    602891725,
    3049323471,
    3964484399,
    3921009573,
    2173295548,
    961987163,
    4081628472,
    1508970993,
    3053834265,
    2453635748,
    2937671579,
    2870763221,
    3664609560,
    3624381080,
    2734883394,
    310598401,
    1164996542,
    607225278,
    1323610764,
    1426881987,
    3590304994,
    1925078388,
    4068182383,
    2162078206,
    991336113,
    2614888103,
    633803317,
    3248222580,
    3479774868,
    3835390401,
    2666613458,
    4022224774,
    944711139,
    264347078,
    2341262773,
    604807628,
    2007800933,
    770255983,
    1495990901,
    1249150122,
    1856431235,
    1555081692,
    3175218132,
    1996064986,
    2198950837,
    2554220882,
    3999719339,
    2821834349,
    766784016,
    2952996808,
    2566594879,
    3210313671,
    3203337956,
    3336571891,
    1034457026,
    3584528711,
    2466948901,
    113926993,
    3758326383,
    338241895,
    168717936,
    666307205,
    1188179964,
    773529912,
    1546045734,
    1294757372,
    1522805485,
    1396182291,
    2643833823,
    1695183700,
    2343527390,
    1986661051,
    1014477480,
    2177026350,
    1206759142,
    2456956037,
    344077627,
    2730485921,
    1290863460,
    2820302411,
    3158454273,
    3259730800,
    3505952657,
    3345764771,
    106217008,
    3516065817,
    3606008344,
    3600352804,
    1432725776,
    4094571909,
    1467031594,
    275423344,
    851169720,
    430227734,
    3100823752,
    506948616,
    1363258195,
    659060556,
    3750685593,
    883997877,
    3785050280,
    958139571,
    3318307427,
    1322822218,
    3812723403,
    1537002063,
    2003034995,
    1747873779,
    3602036899,
    1955562222,
    1575990012,
    2024104815,
    1125592928,
    2227730452,
    2716904306,
    2361852424,
    442776044,
    2428436474,
    593698344,
    2756734187,
    3733110249,
    3204031479,
    2999351573,
    3329325298,
    3815920427,
    3391569614,
    3928383900,
    3515267271,
    566280711,
    3940187606,
    3454069534,
    4118630271,
    4000239992,
    116418474,
    1914138554,
    174292421,
    2731055270,
    289380356,
    3203993006,
    460393269,
    320620315,
    685471733,
    587496836,
    852142971,
    1086792851,
    1017036298,
    365543100,
    1126000580,
    2618297676,
    1288033470,
    3409855158,
    1501505948,
    4234509866,
    1607167915,
    987167468,
    1816402316,
    1246189591
  ];
  function crypto_hashblocks_hl(hh2, hl, m, n) {
    var wh = new Int32Array(16), wl = new Int32Array(16), bh0, bh1, bh2, bh3, bh4, bh5, bh6, bh7, bl0, bl1, bl2, bl3, bl4, bl5, bl6, bl7, th, tl, i, j, h, l, a, b, c, d;
    var ah0 = hh2[0], ah1 = hh2[1], ah2 = hh2[2], ah3 = hh2[3], ah4 = hh2[4], ah5 = hh2[5], ah6 = hh2[6], ah7 = hh2[7], al0 = hl[0], al1 = hl[1], al2 = hl[2], al3 = hl[3], al4 = hl[4], al5 = hl[5], al6 = hl[6], al7 = hl[7];
    var pos = 0;
    while (n >= 128) {
      for (i = 0; i < 16; i++) {
        j = 8 * i + pos;
        wh[i] = m[j + 0] << 24 | m[j + 1] << 16 | m[j + 2] << 8 | m[j + 3];
        wl[i] = m[j + 4] << 24 | m[j + 5] << 16 | m[j + 6] << 8 | m[j + 7];
      }
      for (i = 0; i < 80; i++) {
        bh0 = ah0;
        bh1 = ah1;
        bh2 = ah2;
        bh3 = ah3;
        bh4 = ah4;
        bh5 = ah5;
        bh6 = ah6;
        bh7 = ah7;
        bl0 = al0;
        bl1 = al1;
        bl2 = al2;
        bl3 = al3;
        bl4 = al4;
        bl5 = al5;
        bl6 = al6;
        bl7 = al7;
        h = ah7;
        l = al7;
        a = l & 65535;
        b = l >>> 16;
        c = h & 65535;
        d = h >>> 16;
        h = (ah4 >>> 14 | al4 << 32 - 14) ^ (ah4 >>> 18 | al4 << 32 - 18) ^ (al4 >>> 41 - 32 | ah4 << 32 - (41 - 32));
        l = (al4 >>> 14 | ah4 << 32 - 14) ^ (al4 >>> 18 | ah4 << 32 - 18) ^ (ah4 >>> 41 - 32 | al4 << 32 - (41 - 32));
        a += l & 65535;
        b += l >>> 16;
        c += h & 65535;
        d += h >>> 16;
        h = ah4 & ah5 ^ ~ah4 & ah6;
        l = al4 & al5 ^ ~al4 & al6;
        a += l & 65535;
        b += l >>> 16;
        c += h & 65535;
        d += h >>> 16;
        h = K[i * 2];
        l = K[i * 2 + 1];
        a += l & 65535;
        b += l >>> 16;
        c += h & 65535;
        d += h >>> 16;
        h = wh[i % 16];
        l = wl[i % 16];
        a += l & 65535;
        b += l >>> 16;
        c += h & 65535;
        d += h >>> 16;
        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;
        th = c & 65535 | d << 16;
        tl = a & 65535 | b << 16;
        h = th;
        l = tl;
        a = l & 65535;
        b = l >>> 16;
        c = h & 65535;
        d = h >>> 16;
        h = (ah0 >>> 28 | al0 << 32 - 28) ^ (al0 >>> 34 - 32 | ah0 << 32 - (34 - 32)) ^ (al0 >>> 39 - 32 | ah0 << 32 - (39 - 32));
        l = (al0 >>> 28 | ah0 << 32 - 28) ^ (ah0 >>> 34 - 32 | al0 << 32 - (34 - 32)) ^ (ah0 >>> 39 - 32 | al0 << 32 - (39 - 32));
        a += l & 65535;
        b += l >>> 16;
        c += h & 65535;
        d += h >>> 16;
        h = ah0 & ah1 ^ ah0 & ah2 ^ ah1 & ah2;
        l = al0 & al1 ^ al0 & al2 ^ al1 & al2;
        a += l & 65535;
        b += l >>> 16;
        c += h & 65535;
        d += h >>> 16;
        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;
        bh7 = c & 65535 | d << 16;
        bl7 = a & 65535 | b << 16;
        h = bh3;
        l = bl3;
        a = l & 65535;
        b = l >>> 16;
        c = h & 65535;
        d = h >>> 16;
        h = th;
        l = tl;
        a += l & 65535;
        b += l >>> 16;
        c += h & 65535;
        d += h >>> 16;
        b += a >>> 16;
        c += b >>> 16;
        d += c >>> 16;
        bh3 = c & 65535 | d << 16;
        bl3 = a & 65535 | b << 16;
        ah1 = bh0;
        ah2 = bh1;
        ah3 = bh2;
        ah4 = bh3;
        ah5 = bh4;
        ah6 = bh5;
        ah7 = bh6;
        ah0 = bh7;
        al1 = bl0;
        al2 = bl1;
        al3 = bl2;
        al4 = bl3;
        al5 = bl4;
        al6 = bl5;
        al7 = bl6;
        al0 = bl7;
        if (i % 16 === 15) {
          for (j = 0; j < 16; j++) {
            h = wh[j];
            l = wl[j];
            a = l & 65535;
            b = l >>> 16;
            c = h & 65535;
            d = h >>> 16;
            h = wh[(j + 9) % 16];
            l = wl[(j + 9) % 16];
            a += l & 65535;
            b += l >>> 16;
            c += h & 65535;
            d += h >>> 16;
            th = wh[(j + 1) % 16];
            tl = wl[(j + 1) % 16];
            h = (th >>> 1 | tl << 32 - 1) ^ (th >>> 8 | tl << 32 - 8) ^ th >>> 7;
            l = (tl >>> 1 | th << 32 - 1) ^ (tl >>> 8 | th << 32 - 8) ^ (tl >>> 7 | th << 32 - 7);
            a += l & 65535;
            b += l >>> 16;
            c += h & 65535;
            d += h >>> 16;
            th = wh[(j + 14) % 16];
            tl = wl[(j + 14) % 16];
            h = (th >>> 19 | tl << 32 - 19) ^ (tl >>> 61 - 32 | th << 32 - (61 - 32)) ^ th >>> 6;
            l = (tl >>> 19 | th << 32 - 19) ^ (th >>> 61 - 32 | tl << 32 - (61 - 32)) ^ (tl >>> 6 | th << 32 - 6);
            a += l & 65535;
            b += l >>> 16;
            c += h & 65535;
            d += h >>> 16;
            b += a >>> 16;
            c += b >>> 16;
            d += c >>> 16;
            wh[j] = c & 65535 | d << 16;
            wl[j] = a & 65535 | b << 16;
          }
        }
      }
      h = ah0;
      l = al0;
      a = l & 65535;
      b = l >>> 16;
      c = h & 65535;
      d = h >>> 16;
      h = hh2[0];
      l = hl[0];
      a += l & 65535;
      b += l >>> 16;
      c += h & 65535;
      d += h >>> 16;
      b += a >>> 16;
      c += b >>> 16;
      d += c >>> 16;
      hh2[0] = ah0 = c & 65535 | d << 16;
      hl[0] = al0 = a & 65535 | b << 16;
      h = ah1;
      l = al1;
      a = l & 65535;
      b = l >>> 16;
      c = h & 65535;
      d = h >>> 16;
      h = hh2[1];
      l = hl[1];
      a += l & 65535;
      b += l >>> 16;
      c += h & 65535;
      d += h >>> 16;
      b += a >>> 16;
      c += b >>> 16;
      d += c >>> 16;
      hh2[1] = ah1 = c & 65535 | d << 16;
      hl[1] = al1 = a & 65535 | b << 16;
      h = ah2;
      l = al2;
      a = l & 65535;
      b = l >>> 16;
      c = h & 65535;
      d = h >>> 16;
      h = hh2[2];
      l = hl[2];
      a += l & 65535;
      b += l >>> 16;
      c += h & 65535;
      d += h >>> 16;
      b += a >>> 16;
      c += b >>> 16;
      d += c >>> 16;
      hh2[2] = ah2 = c & 65535 | d << 16;
      hl[2] = al2 = a & 65535 | b << 16;
      h = ah3;
      l = al3;
      a = l & 65535;
      b = l >>> 16;
      c = h & 65535;
      d = h >>> 16;
      h = hh2[3];
      l = hl[3];
      a += l & 65535;
      b += l >>> 16;
      c += h & 65535;
      d += h >>> 16;
      b += a >>> 16;
      c += b >>> 16;
      d += c >>> 16;
      hh2[3] = ah3 = c & 65535 | d << 16;
      hl[3] = al3 = a & 65535 | b << 16;
      h = ah4;
      l = al4;
      a = l & 65535;
      b = l >>> 16;
      c = h & 65535;
      d = h >>> 16;
      h = hh2[4];
      l = hl[4];
      a += l & 65535;
      b += l >>> 16;
      c += h & 65535;
      d += h >>> 16;
      b += a >>> 16;
      c += b >>> 16;
      d += c >>> 16;
      hh2[4] = ah4 = c & 65535 | d << 16;
      hl[4] = al4 = a & 65535 | b << 16;
      h = ah5;
      l = al5;
      a = l & 65535;
      b = l >>> 16;
      c = h & 65535;
      d = h >>> 16;
      h = hh2[5];
      l = hl[5];
      a += l & 65535;
      b += l >>> 16;
      c += h & 65535;
      d += h >>> 16;
      b += a >>> 16;
      c += b >>> 16;
      d += c >>> 16;
      hh2[5] = ah5 = c & 65535 | d << 16;
      hl[5] = al5 = a & 65535 | b << 16;
      h = ah6;
      l = al6;
      a = l & 65535;
      b = l >>> 16;
      c = h & 65535;
      d = h >>> 16;
      h = hh2[6];
      l = hl[6];
      a += l & 65535;
      b += l >>> 16;
      c += h & 65535;
      d += h >>> 16;
      b += a >>> 16;
      c += b >>> 16;
      d += c >>> 16;
      hh2[6] = ah6 = c & 65535 | d << 16;
      hl[6] = al6 = a & 65535 | b << 16;
      h = ah7;
      l = al7;
      a = l & 65535;
      b = l >>> 16;
      c = h & 65535;
      d = h >>> 16;
      h = hh2[7];
      l = hl[7];
      a += l & 65535;
      b += l >>> 16;
      c += h & 65535;
      d += h >>> 16;
      b += a >>> 16;
      c += b >>> 16;
      d += c >>> 16;
      hh2[7] = ah7 = c & 65535 | d << 16;
      hl[7] = al7 = a & 65535 | b << 16;
      pos += 128;
      n -= 128;
    }
    return n;
  }
  function crypto_hash(out, m, n) {
    var hh2 = new Int32Array(8), hl = new Int32Array(8), x = new Uint8Array(256), i, b = n;
    hh2[0] = 1779033703;
    hh2[1] = 3144134277;
    hh2[2] = 1013904242;
    hh2[3] = 2773480762;
    hh2[4] = 1359893119;
    hh2[5] = 2600822924;
    hh2[6] = 528734635;
    hh2[7] = 1541459225;
    hl[0] = 4089235720;
    hl[1] = 2227873595;
    hl[2] = 4271175723;
    hl[3] = 1595750129;
    hl[4] = 2917565137;
    hl[5] = 725511199;
    hl[6] = 4215389547;
    hl[7] = 327033209;
    crypto_hashblocks_hl(hh2, hl, m, n);
    n %= 128;
    for (i = 0; i < n; i++)
      x[i] = m[b - n + i];
    x[n] = 128;
    n = 256 - 128 * (n < 112 ? 1 : 0);
    x[n - 9] = 0;
    ts64(x, n - 8, b / 536870912 | 0, b << 3);
    crypto_hashblocks_hl(hh2, hl, x, n);
    for (i = 0; i < 8; i++)
      ts64(out, 8 * i, hh2[i], hl[i]);
    return 0;
  }
  function add(p, q) {
    var a = gf(), b = gf(), c = gf(), d = gf(), e = gf(), f = gf(), g = gf(), h = gf(), t = gf();
    Z(a, p[1], p[0]);
    Z(t, q[1], q[0]);
    M(a, a, t);
    A(b, p[0], p[1]);
    A(t, q[0], q[1]);
    M(b, b, t);
    M(c, p[3], q[3]);
    M(c, c, D2);
    M(d, p[2], q[2]);
    A(d, d, d);
    Z(e, b, a);
    Z(f, d, c);
    A(g, d, c);
    A(h, b, a);
    M(p[0], e, f);
    M(p[1], h, g);
    M(p[2], g, f);
    M(p[3], e, h);
  }
  function cswap(p, q, b) {
    var i;
    for (i = 0; i < 4; i++) {
      sel25519(p[i], q[i], b);
    }
  }
  function pack(r, p) {
    var tx = gf(), ty = gf(), zi = gf();
    inv25519(zi, p[2]);
    M(tx, p[0], zi);
    M(ty, p[1], zi);
    pack25519(r, ty);
    r[31] ^= par25519(tx) << 7;
  }
  function scalarmult(p, q, s) {
    var b, i;
    set25519(p[0], gf0);
    set25519(p[1], gf1);
    set25519(p[2], gf1);
    set25519(p[3], gf0);
    for (i = 255; i >= 0; --i) {
      b = s[i / 8 | 0] >> (i & 7) & 1;
      cswap(p, q, b);
      add(q, p);
      add(p, p);
      cswap(p, q, b);
    }
  }
  function scalarbase(p, s) {
    var q = [gf(), gf(), gf(), gf()];
    set25519(q[0], X);
    set25519(q[1], Y);
    set25519(q[2], gf1);
    M(q[3], X, Y);
    scalarmult(p, q, s);
  }
  var L = new Float64Array([
    237,
    211,
    245,
    92,
    26,
    99,
    18,
    88,
    214,
    156,
    247,
    162,
    222,
    249,
    222,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    16
  ]);
  function modL(r, x) {
    var carry, i, j, k;
    for (i = 63; i >= 32; --i) {
      carry = 0;
      for (j = i - 32, k = i - 12; j < k; ++j) {
        x[j] += carry - 16 * x[i] * L[j - (i - 32)];
        carry = x[j] + 128 >> 8;
        x[j] -= carry * 256;
      }
      x[j] += carry;
      x[i] = 0;
    }
    carry = 0;
    for (j = 0; j < 32; j++) {
      x[j] += carry - (x[31] >> 4) * L[j];
      carry = x[j] >> 8;
      x[j] &= 255;
    }
    for (j = 0; j < 32; j++)
      x[j] -= carry * L[j];
    for (i = 0; i < 32; i++) {
      x[i + 1] += x[i] >> 8;
      r[i] = x[i] & 255;
    }
  }
  function reduce(r) {
    var x = new Float64Array(64), i;
    for (i = 0; i < 64; i++)
      x[i] = r[i];
    for (i = 0; i < 64; i++)
      r[i] = 0;
    modL(r, x);
  }
  function crypto_sign_direct(sm, m, n, sk) {
    var h = new Uint8Array(64), r = new Uint8Array(64);
    var i, j, x = new Float64Array(64);
    var p = [gf(), gf(), gf(), gf()];
    for (i = 0; i < n; i++)
      sm[64 + i] = m[i];
    for (i = 0; i < 32; i++)
      sm[32 + i] = sk[i];
    crypto_hash(r, sm.subarray(32), n + 32);
    reduce(r);
    scalarbase(p, r);
    pack(sm, p);
    for (i = 0; i < 32; i++)
      sm[i + 32] = sk[32 + i];
    crypto_hash(h, sm, n + 64);
    reduce(h);
    for (i = 0; i < 64; i++)
      x[i] = 0;
    for (i = 0; i < 32; i++)
      x[i] = r[i];
    for (i = 0; i < 32; i++) {
      for (j = 0; j < 32; j++) {
        x[i + j] += h[i] * sk[j];
      }
    }
    modL(sm.subarray(32), x);
    return n + 64;
  }
  function crypto_sign_direct_rnd(sm, m, n, sk, rnd) {
    var h = new Uint8Array(64), r = new Uint8Array(64);
    var i, j, x = new Float64Array(64);
    var p = [gf(), gf(), gf(), gf()];
    sm[0] = 254;
    for (i = 1; i < 32; i++)
      sm[i] = 255;
    for (i = 0; i < 32; i++)
      sm[32 + i] = sk[i];
    for (i = 0; i < n; i++)
      sm[64 + i] = m[i];
    for (i = 0; i < 64; i++)
      sm[n + 64 + i] = rnd[i];
    crypto_hash(r, sm, n + 128);
    reduce(r);
    scalarbase(p, r);
    pack(sm, p);
    for (i = 0; i < 32; i++)
      sm[i + 32] = sk[32 + i];
    crypto_hash(h, sm, n + 64);
    reduce(h);
    for (i = 0; i < 64; i++)
      sm[n + 64 + i] = 0;
    for (i = 0; i < 64; i++)
      x[i] = 0;
    for (i = 0; i < 32; i++)
      x[i] = r[i];
    for (i = 0; i < 32; i++) {
      for (j = 0; j < 32; j++) {
        x[i + j] += h[i] * sk[j];
      }
    }
    modL(sm.subarray(32, n + 64), x);
    return n + 64;
  }
  function curve25519_sign(sm, m, n, sk, opt_rnd) {
    var edsk = new Uint8Array(64);
    var p = [gf(), gf(), gf(), gf()];
    for (var i = 0; i < 32; i++)
      edsk[i] = sk[i];
    edsk[0] &= 248;
    edsk[31] &= 127;
    edsk[31] |= 64;
    scalarbase(p, edsk);
    pack(edsk.subarray(32), p);
    var signBit = edsk[63] & 128;
    var smlen;
    if (opt_rnd) {
      smlen = crypto_sign_direct_rnd(sm, m, n, edsk, opt_rnd);
    } else {
      smlen = crypto_sign_direct(sm, m, n, edsk);
    }
    sm[63] |= signBit;
    return smlen;
  }
  function checkArrayTypes(...args) {
    var t, i;
    for (i = 0; i < arguments.length; i++) {
      if ((t = Object.prototype.toString.call(arguments[i])) !== "[object Uint8Array]")
        throw new TypeError("unexpected type " + t + ", use Uint8Array");
    }
  }
  function sharedKey(secretKey, publicKey) {
    checkArrayTypes(publicKey, secretKey);
    if (publicKey.length !== 32)
      throw new Error("wrong public key length");
    if (secretKey.length !== 32)
      throw new Error("wrong secret key length");
    var sharedKey2 = new Uint8Array(32);
    crypto_scalarmult(sharedKey2, secretKey, publicKey);
    return sharedKey2;
  }
  function sign(secretKey, msg, opt_random) {
    checkArrayTypes(secretKey, msg);
    if (secretKey.length !== 32)
      throw new Error("wrong secret key length");
    if (opt_random) {
      checkArrayTypes(opt_random);
      if (opt_random.length !== 64)
        throw new Error("wrong random data length");
    }
    var buf = new Uint8Array((opt_random ? 128 : 64) + msg.length);
    curve25519_sign(buf, msg, msg.length, secretKey, opt_random);
    var signature = new Uint8Array(64);
    for (var i = 0; i < signature.length; i++)
      signature[i] = buf[i];
    return signature;
  }
  function generateKeyPair(seed) {
    checkArrayTypes(seed);
    if (seed.length !== 32)
      throw new Error("wrong seed length");
    var sk = new Uint8Array(32);
    var pk = new Uint8Array(32);
    for (var i = 0; i < 32; i++)
      sk[i] = seed[i];
    crypto_scalarmult_base(pk, sk);
    sk[0] &= 248;
    sk[31] &= 127;
    sk[31] |= 64;
    pk[31] &= 127;
    return {
      public: pk,
      private: sk
    };
  }

  // src/crypto/token.js
  function md5Cycle(x, k) {
    let a = x[0], b = x[1], c = x[2], d = x[3];
    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);
    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);
    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);
    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);
    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }
  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32(a << s | a >>> 32 - s, b);
  }
  function ff(a, b, c, d, x, s, t) {
    return cmn(b & c | ~b & d, a, b, x, s, t);
  }
  function gg(a, b, c, d, x, s, t) {
    return cmn(b & d | c & ~d, a, b, x, s, t);
  }
  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }
  function add32(a, b) {
    return a + b & 4294967295;
  }
  function md5blk(s) {
    const md5blks = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }
  var hex_chr = "0123456789abcdef".split("");
  function rhex(n) {
    let s = "";
    for (let j = 0; j < 4; j++) {
      s += hex_chr[n >> j * 8 + 4 & 15] + hex_chr[n >> j * 8 & 15];
    }
    return s;
  }
  function md5Hex(s) {
    const n = s.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;
    for (i = 64; i <= n; i += 64) {
      md5Cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++) {
      tail[i >> 2] |= s.charCodeAt(i) << (i % 4 << 3);
    }
    tail[i >> 2] |= 128 << (i % 4 << 3);
    if (i > 55) {
      md5Cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5Cycle(state, tail);
    return rhex(state[0]) + rhex(state[1]) + rhex(state[2]) + rhex(state[3]);
  }
  var IOS_PERSONAL_STATIC_TOKEN = "0a1mLfGUIBVrMKF1RdvLI5lkRBvof6vn0fD2QRSM";
  var IOS_BUSINESS_STATIC_TOKEN = "USUDuDYDeQhY4RF2fCSp5m3F6kJ1M2J8wS7bbNA2";
  function computeWAMobileToken(versionString, nationalNumber, isBusiness = true) {
    const cleanVer = String(versionString).trim();
    const verHash = md5Hex(cleanVer);
    const staticPrefix = isBusiness ? IOS_BUSINESS_STATIC_TOKEN : IOS_PERSONAL_STATIC_TOKEN;
    return md5Hex(staticPrefix + verHash + String(nationalNumber).trim());
  }

  // src/protocol.js
  var WA_REGISTRATION_PUBKEY = new Uint8Array([
    142,
    140,
    15,
    116,
    195,
    235,
    197,
    215,
    166,
    134,
    92,
    108,
    60,
    132,
    56,
    86,
    176,
    97,
    33,
    204,
    232,
    234,
    119,
    77,
    34,
    251,
    111,
    18,
    37,
    18,
    48,
    45
  ]);
  var DEFAULT_WA_BUSINESS_VERSION = "2.26.42.77";
  var VERSION_CACHE_TTL_MS = 30 * 60 * 1e3;
  function buildUserAgent(version = DEFAULT_WA_BUSINESS_VERSION, platform = "smb_ios", device = null) {
    if (platform === "ios" || platform === "personal_ios") {
      const dev2 = device || "iPhone_15_Pro";
      return `WhatsApp/${version} iOS/18.1 Device/${dev2}`;
    }
    if (platform === "smba" || platform === "business_android") {
      const dev2 = device || "Samsung-SM-S928B";
      return `WhatsApp/${version} SMBA/14 Device/${dev2}`;
    }
    const dev = device || "iPhone_15_Pro";
    return `WhatsApp/${version} SMB iOS/18.1 Device/${dev}`;
  }
  function randomBytes(length) {
    const buf = new Uint8Array(length);
    crypto.getRandomValues(buf);
    return buf;
  }
  function toBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  function toBase64Url(bytes) {
    return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_");
  }
  function toBase64UrlNoPad(bytes) {
    return toBase64Url(bytes).replace(/=+$/, "");
  }
  function toUrlHexUpper(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
      out += "%" + bytes[i].toString(16).padStart(2, "0").toUpperCase();
    }
    return out;
  }
  function uint32BE(val) {
    return new Uint8Array([
      val >>> 24 & 255,
      val >>> 16 & 255,
      val >>> 8 & 255,
      val & 255
    ]);
  }
  function uint24BE(val) {
    return new Uint8Array([
      val >>> 16 & 255,
      val >>> 8 & 255,
      val & 255
    ]);
  }
  function pbVarint(num) {
    const out = [];
    let n = BigInt(num);
    while (n >= 0x80n) {
      out.push(Number(n & 0x7fn | 0x80n));
      n >>= 7n;
    }
    out.push(Number(n));
    return new Uint8Array(out);
  }
  function pbVarintField(fieldNum, num) {
    const tag = fieldNum << 3 | 0;
    const val = pbVarint(num);
    const res = new Uint8Array(1 + val.length);
    res[0] = tag;
    res.set(val, 1);
    return res;
  }
  function pbLenField(fieldNum, bytes) {
    const tag = fieldNum << 3 | 2;
    const len = pbVarint(bytes.length);
    const res = new Uint8Array(1 + len.length + bytes.length);
    res[0] = tag;
    res.set(len, 1);
    res.set(bytes, 1 + len.length);
    return res;
  }
  function buildBusinessVnameCert(identityPrivateKey, verifiedName = "") {
    const serialBytes = randomBytes(7);
    let serial = 0n;
    for (let i = 0; i < serialBytes.length; i++) {
      serial = serial << 8n | BigInt(serialBytes[i]);
    }
    const f1 = pbVarintField(1, serial);
    const f2 = pbLenField(2, new TextEncoder().encode("smb:wa"));
    const f4 = pbLenField(4, new TextEncoder().encode(verifiedName));
    const details = new Uint8Array(f1.length + f2.length + f4.length);
    details.set(f1, 0);
    details.set(f2, f1.length);
    details.set(f4, f1.length + f2.length);
    const signature = sign(identityPrivateKey, details);
    const c1 = pbLenField(1, details);
    const c2 = pbLenField(2, signature);
    const cert = new Uint8Array(c1.length + c2.length);
    cert.set(c1, 0);
    cert.set(c2, c1.length);
    return toBase64Url(cert);
  }
  function createRegistrationSession(cc, nationalNumber, options = {}) {
    const identityKey = generateKeyPair(randomBytes(32));
    const noiseKey = generateKeyPair(randomBytes(32));
    const preKey = generateKeyPair(randomBytes(32));
    const signalPubKey = new Uint8Array(33);
    signalPubKey[0] = 5;
    signalPubKey.set(preKey.public, 1);
    const signature = sign(identityKey.private, signalPubKey);
    const regRandom = randomBytes(2);
    const regIdInt = ((regRandom[0] << 8 | regRandom[1]) & 16382) + 1;
    const isAndroid = options.platform === "smba" || options.platform === "business_android";
    const rawUuid = crypto.randomUUID();
    const profile = resolveCountryProfile(cc, nationalNumber);
    return {
      cc: String(cc),
      in: String(nationalNumber),
      lg: options.lg || profile.lg || "en",
      lc: options.lc || profile.iso || "US",
      mcc: options.mcc || profile.mcc || "310",
      mnc: options.mnc || profile.mnc || "001",
      authkey: toBase64UrlNoPad(noiseKey.public),
      vname: buildBusinessVnameCert(identityKey.private),
      e_regid: toBase64UrlNoPad(uint32BE(regIdInt)),
      e_keytype: toBase64UrlNoPad(new Uint8Array([5])),
      e_ident: toBase64UrlNoPad(identityKey.public),
      e_skey_id: toBase64UrlNoPad(uint24BE(1)),
      e_skey_val: toBase64UrlNoPad(preKey.public),
      e_skey_sig: toBase64UrlNoPad(signature),
      fdid: isAndroid ? rawUuid.toLowerCase() : rawUuid.toUpperCase(),
      expid: toBase64UrlNoPad(randomBytes(16)),
      id: toUrlHexUpper(randomBytes(20)),
      backup_token: toUrlHexUpper(randomBytes(20)),
      access_session_id: toBase64UrlNoPad(randomBytes(16)),
      offline_ab: "%7B%22exposure%22%3A%5B%5D%2C%22metrics%22%3A%7B%7D%7D"
    };
  }
  function serializeSessionQuery(session, token = null, extraPairs = []) {
    const pairs = [
      ["cc", session.cc],
      ["in", session.in],
      ["rc", "0"],
      ["lg", session.lg],
      ["lc", session.lc],
      ["authkey", session.authkey],
      ["vname", session.vname],
      ["e_regid", session.e_regid],
      ["e_keytype", session.e_keytype],
      ["e_ident", session.e_ident],
      ["e_skey_id", session.e_skey_id],
      ["e_skey_val", session.e_skey_val],
      ["e_skey_sig", session.e_skey_sig],
      ["fdid", session.fdid],
      ["expid", session.expid],
      ["id", session.id],
      ["backup_token", session.backup_token],
      ["access_session_id", session.access_session_id],
      ["offline_ab", session.offline_ab]
    ];
    if (token) {
      pairs.push(["token", token]);
    }
    for (const [k, v] of extraPairs) {
      if (v !== null && v !== void 0) {
        pairs.push([k, v]);
      }
    }
    return pairs.map(([k, v]) => `${k}=${v}`).join("&");
  }
  async function encryptWAQuery(queryString) {
    const eph = generateKeyPair(randomBytes(32));
    const shared = sharedKey(eph.private, WA_REGISTRATION_PUBKEY);
    const aesKey = await crypto.subtle.importKey(
      "raw",
      shared,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );
    const iv = new Uint8Array(12);
    const plaintext = new TextEncoder().encode(queryString);
    const ciphertextBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      aesKey,
      plaintext
    );
    const ciphertext = new Uint8Array(ciphertextBuf);
    const combined = new Uint8Array(eph.public.length + ciphertext.length);
    combined.set(eph.public, 0);
    combined.set(ciphertext, eph.public.length);
    return toBase64Url(combined);
  }
  function formatCooldown(seconds) {
    const sec = Math.max(0, Number(seconds || 0));
    if (sec === 0) {
      return {
        active: false,
        seconds: 0,
        minutes: 0,
        hours: 0,
        formatted: "0s",
        whatsapp_ui_label: "0s",
        ready_at_iso: new Date().toISOString()
      };
    }
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const remSeconds = Math.floor(sec % 60);
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (remSeconds > 0 || parts.length === 0) parts.push(`${remSeconds}s`);
    let uiLabel = "";
    if (sec >= 3600) {
      const roundedHours = Math.ceil(sec / 3600);
      uiLabel = `Coba lagi dalam ${roundedHours} jam`;
    } else {
      const m = Math.floor(sec / 60);
      const s = String(Math.floor(sec % 60)).padStart(2, "0");
      uiLabel = `Coba lagi dalam ${m}.${s}`;
    }
    return {
      active: true,
      seconds: sec,
      minutes: Number((sec / 60).toFixed(2)),
      hours: Number((sec / 3600).toFixed(2)),
      formatted: parts.join(" "),
      whatsapp_ui_label: uiLabel,
      ready_at_iso: new Date(Date.now() + sec * 1e3).toISOString()
    };
  }

  function parseWhatsAppDiagnostics(existRaw, codeRaw, parsedPhone, metaInfo) {
    const rawExist = existRaw || {};
    const rawCode = codeRaw || {};

    const hasExistError = Boolean(rawExist.status === "error" || rawExist.error_type || rawExist.reason === "non_json" || Object.keys(rawExist).length === 0);
    const hasCodeError = Boolean(rawCode.status === "error" || rawCode.error_type || rawCode.reason === "non_json" || Object.keys(rawCode).length === 0);

    if (hasExistError || hasCodeError) {
      const errType = rawExist.error_type || rawCode.error_type || "NETWORK_OR_TRANSPORT_ERROR";
      const errReason = rawExist.reason || rawCode.reason || "unknown_error";
      return {
        success: false,
        phone: {
          input: parsedPhone.full,
          e164: `+${parsedPhone.full}`,
          cc: parsedPhone.cc,
          number: parsedPhone.in,
          iso: parsedPhone.iso,
          lg: parsedPhone.lg,
          country_name: parsedPhone.country_name || "-",
          mcc: parsedPhone.mcc,
          mnc: parsedPhone.mnc,
          login_jid: `${parsedPhone.full}@s.whatsapp.net`
        },
        account_state: "ERROR",
        description: `Pemeriksaan gagal akibat gangguan transport/koneksi (${errType}: ${errReason}).`,
        flags: {
          in_cooldown: false,
          sms_in_cooldown: false,
          voice_in_cooldown: false,
          flash_in_cooldown: false,
          wa_old_in_cooldown: false,
          otp_ready: false,
          banned: false,
          clone_custom_block_screen: false,
          security_block: false,
          unofficial_app_block: false
        },
        account_security: {},
        status: "error",
        reason: errReason,
        cooldowns: {
          sms: formatCooldown(0),
          voice: formatCooldown(0),
          flash: formatCooldown(0),
          wa_old_device: formatCooldown(0),
          email_otp: formatCooldown(0),
          silent_auth: formatCooldown(0),
          retry_after: formatCooldown(0)
        },
        eligibility: {},
        otp_lengths: {},
        worker_meta: metaInfo,
        raw_whatsapp_response: { exist: existRaw, code: codeRaw }
      };
    }

    const exist = rawExist;
    const code = rawCode;
    const isCodeSent = code.status === "sent";

    const customBlock = exist.custom_block_screen || code.custom_block_screen || null;
    const hasCustomBlock = Boolean(customBlock);

    let isSecurityBlock = false;
    let isUnofficialAppBlock = false;
    let customBlockTitle = "";

    if (hasCustomBlock) {
      if (typeof customBlock === "object") {
        customBlockTitle = String(customBlock.title || customBlock.header || "");
      } else {
        customBlockTitle = String(customBlock);
      }
      const cbCombined = `${customBlockTitle} ${JSON.stringify(customBlock)}`.toLowerCase();
      const hasOfficialAppKeywords = (
        cbCombined.includes("official") ||
        cbCombined.includes("resmi") ||
        cbCombined.includes("unduh") ||
        cbCombined.includes("download") ||
        cbCombined.includes("unofficial") ||
        cbCombined.includes("whatsapp.com/download")
      );
      const hasSecurityKeywords = (
        cbCombined.includes("security") ||
        cbCombined.includes("keamanan") ||
        cbCombined.includes("login not available") ||
        cbCombined.includes("login is not available") ||
        cbCombined.includes("login is currently unavailable") ||
        cbCombined.includes("unable to log in") ||
        cbCombined.includes("can't log you in") ||
        cbCombined.includes("cannot log you in") ||
        cbCombined.includes("couldn't log you in") ||
        cbCombined.includes("tidak dapat masuk") ||
        cbCombined.includes("tidak bisa masuk") ||
        cbCombined.includes("login tidak tersedia") ||
        cbCombined.includes("no puedes iniciar") ||
        cbCombined.includes("unusual account activity") ||
        cbCombined.includes("aktivitas akun yang tidak biasa")
      );

      if (hasSecurityKeywords && !hasOfficialAppKeywords) {
        isSecurityBlock = true;
      } else {
        isUnofficialAppBlock = true;
      }
    } else {
      const fullRawStr = JSON.stringify({ exist, code }).toLowerCase();
      if (
        exist.reason === "security_block" ||
        code.reason === "security_block" ||
        fullRawStr.includes("for security reasons") ||
        fullRawStr.includes("demi keamanan") ||
        fullRawStr.includes("login not available right now") ||
        fullRawStr.includes("tidak dapat masuk saat ini")
      ) {
        isSecurityBlock = true;
      }
    }

    const isCloneBlocked = Boolean(isSecurityBlock || isUnofficialAppBlock);
    const hasAppeal = Boolean(
      exist.appeal_token || exist.violation_type || exist.in_app_ban_appeal || code.appeal_token || code.violation_type || code.in_app_ban_appeal
    );
    const isBanned = Boolean(
      !isCloneBlocked && (exist.status === "banned" || code.status === "banned" || exist.reason === "blocked" || code.reason === "blocked" || hasAppeal)
    );

    const existNoRoutes = exist.reason === "no_routes";
    const codeNoRoutes = code.reason === "no_routes";

    const existSmsWait = existNoRoutes ? 0 : Math.max(
      Number(exist.sms_wait ?? 0),
      Number(exist.send_sms_wait ?? 0)
    );
    const codeSmsWait = codeNoRoutes ? 0 : Math.max(
      Number(code.sms_wait ?? 0),
      Number(code.send_sms_wait ?? 0)
    );
    const rawSmsWait = Math.max(existSmsWait, codeSmsWait);

    const voiceWait = Math.max(Number(exist.voice_wait ?? 0), Number(code.voice_wait ?? 0));
    const flashWait = Math.max(Number(exist.flash_wait ?? 0), Number(code.flash_wait ?? 0));
    const emailOtpWait = Math.max(Number(exist.email_otp_wait ?? 0), Number(code.email_otp_wait ?? 0));
    const waOldWait = Math.max(Number(exist.wa_old_wait ?? 0), Number(code.wa_old_wait ?? 0));
    const silentAuthWait = Math.max(Number(exist.silent_auth_wait ?? 0), Number(code.silent_auth_wait ?? 0));
    const wipeWait = Math.max(Number(exist.wipe_wait ?? 0), Number(code.wipe_wait ?? 0));

    const hasWaOld = Number(exist.wa_old_eligible ?? code.wa_old_eligible ?? 0) === 1;
    const hasEmailOtp = Number(exist.email_otp_eligible ?? code.email_otp_eligible ?? 0) === 1;
    const hasPassword = Number(exist.password_eligible ?? code.password_eligible ?? 0) === 1;

    // When probing /v2/code with method=wa_old:
    // 1) First probe on an eligible account returns status:"sent", method:"wa_old", retry_after:~125s, sms_wait:~125s (unless real SMS cooldown >180s exists).
    // 2) Re-probing within ~125s returns status:"fail", reason:"too_recent" or "too_many", where sms_wait (~125s->0s) echoes wa_old_wait or voice_wait while exist.sms_wait is 0.
    // In both cases, if existSmsWait == 0 and codeSmsWait <= 180s matches that 2-minute wa_old probe timer, it is NOT an SMS OTP cooldown.
    const codeVoiceWait = codeNoRoutes ? 0 : Number(code.voice_wait ?? 0);
    const isWaOldTimerEcho = (
      existSmsWait === 0 &&
      codeSmsWait > 0 &&
      codeSmsWait <= 180 &&
      (
        isCodeSent ||
        (waOldWait > 0 && Math.abs(codeSmsWait - waOldWait) <= 5) ||
        (codeVoiceWait > 0 && Math.abs(codeSmsWait - codeVoiceWait) <= 5 && Number(code.send_sms_wait ?? 0) === 0)
      )
    );

    const isEffectiveCodeSent = isCodeSent && (rawSmsWait === 0 || isWaOldTimerEcho);

    const smsWait = (isEffectiveCodeSent || isWaOldTimerEcho) ? 0 : rawSmsWait;

    const rawRetryAfter = Math.max(
      existNoRoutes ? 0 : Number(exist.retry_after ?? 0),
      codeNoRoutes ? 0 : Number(code.retry_after ?? 0)
    );
    const retryAfter = (isEffectiveCodeSent || isWaOldTimerEcho) ? 0 : rawRetryAfter;

    const smsCooldown = (isEffectiveCodeSent || isWaOldTimerEcho) ? 0 : Math.max(smsWait, retryAfter);
    const primaryStatus = exist.status || code.status || "unknown";
    const primaryReason = exist.reason || code.reason || null;
    const maskedEmail = exist.email || code.email || null;
    const oldDeviceName = exist.wa_old_device_name || code.wa_old_device_name || null;
    const recommendedMethods = exist.recommended_method || code.recommended_method || [];

    let accountState = "UNKNOWN";
    let stateDescription = "";

    if (isBanned) {
      accountState = "BANNED";
      stateDescription = `Nomor diblokir / banned oleh WhatsApp (reason: blocked${exist.violation_type ? `, violation: ${exist.violation_type}` : ""}).`;
    } else if (isSecurityBlock) {
      accountState = "SECURITY_BLOCK";
      stateDescription = `Demi Keamanan: Tidak dapat masuk saat ini (${customBlockTitle || "Security Hold"}).`;
    } else if (isUnofficialAppBlock) {
      accountState = "CLONE_OR_UNOFFICIAL_APP_BLOCK";
      stateDescription = `Apk Tidak Resmi: Anda memerlukan aplikasi WhatsApp resmi (${customBlockTitle || "Unduh WhatsApp resmi"}).`;
    } else if (isEffectiveCodeSent) {
      if (hasWaOld || hasEmailOtp || hasPassword) {
        accountState = "REGISTERED_ON_DEVICE";
        stateDescription = "Nomor terdaftar aktif di perangkat lain & siap menerima OTP SMS.";
      } else {
        accountState = "AVAILABLE_READY";
        stateDescription = "Nomor siap menerima OTP SMS (status: sent).";
      }
    } else if (exist.reason === "no_routes" || code.reason === "no_routes") {
      accountState = "NO_ROUTES";
      stateDescription = "Jalur SMS tidak tersedia untuk nomor ini (no_routes).";
    } else if (code.reason === "method_not_allowed") {
      accountState = "UNKNOWN";
      stateDescription = "Metode tidak diizinkan oleh server (method_not_allowed).";
    } else if (exist.reason === "bad_param" || exist.reason === "bad_format" || exist.failure_reason === "bad_format" || exist.reason === "too_short" || exist.reason === "too_long" ||
               code.reason === "bad_param" || code.reason === "bad_format" || code.reason === "too_short" || code.reason === "too_long") {
      accountState = "INVALID_NUMBER";
      stateDescription = `Format nomor tidak valid di jaringan WhatsApp (${exist.reason || code.reason || "bad_format"}).`;
    } else if (exist.reason === "temporarily_unavailable" || code.reason === "temporarily_unavailable") {
      accountState = "TEMP_LOCKED_COOLDOWN";
      const cdSec = retryAfter || smsWait;
      stateDescription = `CD Tempo (Sementara Tidak Tersedia): ${cdSec > 0 ? formatCooldown(cdSec).formatted : "Durasi belum dapat dipastikan"}.`;
    } else if (primaryReason === "too_many_all_methods" || code.reason === "too_many_all_methods" ||
               (["too_many", "too_many_guesses", "too_recent"].includes(primaryReason) && smsCooldown > 0) ||
               (["too_many", "too_many_guesses", "too_recent"].includes(code.reason) && smsCooldown > 0)) {
      accountState = "RATE_LIMITED_COOLDOWN";
      stateDescription = `Terlalu banyak percobaan OTP (${code.reason || primaryReason}). Cooldown SMS: ${formatCooldown(smsWait || retryAfter).formatted}.`;
    } else if (smsCooldown > 0) {
      accountState = "IN_COOLDOWN";
      stateDescription = `Nomor sedang dalam cooldown SMS: ${formatCooldown(smsCooldown).formatted}.`;
    } else {
      const hasSmsWait = (exist.sms_wait !== undefined && exist.sms_wait !== null) || (code.sms_wait !== undefined && code.sms_wait !== null);
      if (!hasSmsWait) {
        accountState = "UNKNOWN";
        stateDescription = "Respons server tidak memiliki informasi sms_wait yang valid.";
      } else if (hasWaOld || hasEmailOtp || hasPassword) {
        accountState = "REGISTERED_ON_DEVICE";
        stateDescription = "Nomor terdaftar aktif di perangkat lain (wa_old / email OTP aktif) & siap menerima request OTP SMS.";
      } else {
        accountState = "AVAILABLE_READY";
        stateDescription = "Nomor tidak sedang cooldown dan siap menerima request OTP SMS baru.";
      }
    }

    const effectiveInCooldown = smsCooldown > 0 || accountState === "TEMP_LOCKED_COOLDOWN" || accountState === "RATE_LIMITED_COOLDOWN" || accountState === "IN_COOLDOWN";
    const isOtpReady = !isBanned && !isCloneBlocked && !effectiveInCooldown && (accountState === "AVAILABLE_READY" || accountState === "REGISTERED_ON_DEVICE");

    return {
      success: true,
      phone: {
        input: parsedPhone.full,
        e164: `+${parsedPhone.full}`,
        cc: parsedPhone.cc,
        number: parsedPhone.in,
        iso: parsedPhone.iso,
        lg: parsedPhone.lg,
        country_name: parsedPhone.country_name,
        mcc: parsedPhone.mcc,
        mnc: parsedPhone.mnc,
        login_jid: `${exist.login || code.login || parsedPhone.full}@s.whatsapp.net`
      },
      account_state: accountState,
      description: stateDescription,
      flags: {
        in_cooldown: effectiveInCooldown,
        sms_in_cooldown: smsWait > 0,
        voice_in_cooldown: voiceWait > 0,
        flash_in_cooldown: flashWait > 0,
        wa_old_in_cooldown: waOldWait > 0,
        otp_ready: isOtpReady,
        banned: isBanned,
        clone_custom_block_screen: isCloneBlocked,
        security_block: isSecurityBlock,
        unofficial_app_block: isUnofficialAppBlock,
        high_sms_rereg_user: Boolean(exist.high_sms_rereg_user),
        has_recovery_email: Boolean(maskedEmail || hasEmailOtp),
        has_active_device: hasWaOld
      },
      account_security: {
        masked_email: maskedEmail,
        wa_old_device_name: oldDeviceName,
        recommended_methods: recommendedMethods,
        fallback_methods: exist.fallback_methods || [],
        second_factor_methods: exist.second_factor_methods || [],
        num_visible_dbs_methods: exist.num_visible_dbs_methods ?? null,
        is_device_trusted: Boolean(exist.is_device_trusted),
        passkey_eligible: Boolean(exist.passkey_auth_challenge || exist.passkey_credential),
        password_eligible: hasPassword,
        wipe_type: exist.wipe_type || null,
        wipe_wait: formatCooldown(wipeWait)
      },
      status: primaryStatus,
      reason: primaryReason,
      cooldowns: {
        sms: formatCooldown(smsWait),
        voice: formatCooldown(voiceWait),
        flash: formatCooldown(flashWait),
        wa_old_device: formatCooldown(waOldWait),
        email_otp: formatCooldown(emailOtpWait),
        silent_auth: formatCooldown(silentAuthWait),
        retry_after: formatCooldown(retryAfter)
      },
      eligibility: {
        wa_old_device_otp: hasWaOld,
        email_otp: hasEmailOtp,
        two_factor_password: hasPassword,
        send_sms_to_wa: Boolean(exist.send_sms_eligible),
        silent_auth: Boolean(exist.silent_auth_eligible),
        account_transfer: Boolean(exist.acc_tr_eligible),
        flash_call_type: exist.flash_type ?? 0,
        high_sms_rereg_user: Boolean(exist.high_sms_rereg_user),
        recommended_method: recommendedMethods,
        fallback_methods: exist.fallback_methods || []
      },
      otp_lengths: {
        sms: exist.sms_length ?? 6,
        voice: exist.voice_length ?? 6,
        email_otp: exist.email_otp_length ?? 6,
        wa_old: exist.wa_old_length ?? 6
      },
      worker_meta: metaInfo,
      raw_whatsapp_response: {
        exist: existRaw,
        code: codeRaw
      }
    };
  }

  // bridge_entry.js
  async function buildDualPayloads(inputPhone, method = "wa_old") {
    const parsed = parsePhoneNumber(inputPhone);
    if (!parsed || !parsed.valid) {
      return { success: false, error: "Format nomor tidak valid" };
    }
    const platform = "smb_ios";
    const version = DEFAULT_WA_BUSINESS_VERSION;
    const userAgent = buildUserAgent(version, platform, "iPhone_15_Pro");
    const session = createRegistrationSession(parsed.cc, parsed.in, {
      platform,
      lg: parsed.lg || "id",
      lc: parsed.iso || "ID",
      mcc: parsed.mcc || "510",
      mnc: parsed.mnc || "010"
    });
    const waToken = computeWAMobileToken(version, parsed.in, true);
    const commonExtraPairs = [
      ["hasinrc", "1"],
      ["sim_mcc", parsed.mcc || "510"],
      ["sim_mnc", String(parsed.mnc || "010").padStart(3, "0")],
      ["jailbroken", "0"],
      ["cellular_strength", "1"]
    ];
    const allowedMethods = new Set(["sms", "voice", "flash", "email", "wa_old"]);
    const codeMethod = allowedMethods.has(String(method || "").toLowerCase()) ? String(method).toLowerCase() : "wa_old";
    const codeExtraPairs = [
      ["method", codeMethod],
      ...commonExtraPairs
    ];
    const plaintextExist = serializeSessionQuery(session, waToken, commonExtraPairs);
    const encExist = await encryptWAQuery(plaintextExist);
    const plaintextCode = serializeSessionQuery(session, waToken, codeExtraPairs);
    const encCode = await encryptWAQuery(plaintextCode);
    return {
      success: true,
      userAgent,
      exist: {
        url: "https://v.whatsapp.net/v2/exist",
        body: `ENC=${encExist}`
      },
      code: {
        url: "https://v.whatsapp.net/v2/code",
        body: `ENC=${encCode}`
      },
      phoneInfo: parsed,
      session,
      waToken,
      version,
      platform
    };
  }


  async function buildRegisterPayloads(inputPhone, otpCode = "000000", reuse = null) {
    const parsed = parsePhoneNumber(inputPhone);
    if (!parsed || !parsed.valid) {
      return { success: false, error: "Format nomor tidak valid" };
    }
    const platform = (reuse && reuse.platform) || "smb_ios";
    const version = (reuse && reuse.version) || DEFAULT_WA_BUSINESS_VERSION;
    const userAgent = (reuse && reuse.userAgent) || buildUserAgent(version, platform, "iPhone_15_Pro");
    const session = (reuse && reuse.session) || createRegistrationSession(parsed.cc, parsed.in, {
      platform,
      lg: parsed.lg || "id",
      lc: parsed.iso || "ID",
      mcc: parsed.mcc || "510",
      mnc: parsed.mnc || "010"
    });
    const waToken = (reuse && reuse.waToken) || computeWAMobileToken(version, parsed.in, true);
    const code = String(otpCode || "000000").replace(/\D/g, "").slice(0, 6).padStart(6, "0");
    const extraPairs = [
      ["code", code],
      ["entered", "1"],
      ["hasinrc", "1"],
      ["sim_mcc", parsed.mcc || "510"],
      ["sim_mnc", String(parsed.mnc || "010").padStart(3, "0")],
      ["jailbroken", "0"],
      ["cellular_strength", "1"]
    ];
    const plaintext = serializeSessionQuery(session, waToken, extraPairs);
    const enc = await encryptWAQuery(plaintext);
    return {
      success: true,
      userAgent,
      register: {
        url: "https://v.whatsapp.net/v2/register",
        body: `ENC=${enc}`
      },
      phoneInfo: parsed,
      code
    };
  }

  function parseDualResponse(phoneInfo, existRawText, codeRawText) {
    let existRaw = null;
    let codeRaw = null;
    try {
      if (existRawText) existRaw = JSON.parse(existRawText);
    } catch (e) {
      existRaw = { status: "error", error_type: "MALFORMED_JSON", reason: "non_json", raw: String(existRawText || "").slice(0, 100) };
    }
    try {
      if (codeRawText) codeRaw = JSON.parse(codeRawText);
    } catch (e) {
      codeRaw = { status: "error", error_type: "MALFORMED_JSON", reason: "non_json", raw: String(codeRawText || "").slice(0, 100) };
    }

    const diag = parseWhatsAppDiagnostics(existRaw, codeRaw, phoneInfo, { mode: "both", via: "ANDROID_LOCAL" });
    const isBanned = Boolean(diag.flags?.banned);
    const isSecurityBlock = Boolean(diag.flags?.security_block);
    const isUnofficialAppBlock = Boolean(diag.flags?.unofficial_app_block);
    const isCloneBlocked = Boolean(diag.flags?.clone_custom_block_screen || isSecurityBlock || isUnofficialAppBlock);
    const isCooldown = !isBanned && !isCloneBlocked && Boolean(diag.flags?.in_cooldown);
    const isReady = !isBanned && !isCloneBlocked && !isCooldown && Boolean(diag.flags?.otp_ready);

    const smsWait = diag.cooldowns?.sms?.seconds ?? 0;
    const retryAfter = diag.cooldowns?.retry_after?.seconds ?? 0;
    const smsCooldown = Math.max(smsWait, retryAfter);

    let state = diag.account_state;
    let desc = diag.description;
    let cooldownFmt = diag.cooldowns?.sms?.formatted || "0s";
    let cooldownLabel = diag.cooldowns?.sms?.whatsapp_ui_label || "";

    if (state === "TEMP_LOCKED_COOLDOWN" && smsCooldown === 0) {
      cooldownFmt = "Durasi belum dapat dipastikan";
      cooldownLabel = "Durasi belum dapat dipastikan";
    } else if (smsCooldown > 0) {
      if (smsWait > 0) {
        cooldownFmt = diag.cooldowns?.sms?.formatted;
        cooldownLabel = diag.cooldowns?.sms?.whatsapp_ui_label;
      } else if (retryAfter > 0) {
        cooldownFmt = diag.cooldowns?.retry_after?.formatted;
        cooldownLabel = diag.cooldowns?.retry_after?.whatsapp_ui_label;
      }
    }

    return {
      success: true,
      phone: diag.phone?.e164 || phoneInfo?.full || "",
      country: diag.phone?.country_name || phoneInfo?.country_name || "-",
      state,
      isReady,
      isCooldown,
      isBanned,
      isCloneBlocked,
      isSecurityBlock,
      isUnofficialAppBlock,
      description: desc,
      cooldownFormatted: cooldownFmt,
      cooldownLabel,
      cooldownSeconds: smsCooldown,
      maskedEmail: diag.account_security?.masked_email || null,
      rawStatus: diag.status,
      rawReason: diag.reason
    };
  }
  if (typeof window !== "undefined") {
    window.WADetector = {
      buildDualPayloads,
      buildRegisterPayloads,
      parseDualResponse,
      buildExistPayload: buildDualPayloads,
      parseResponse: function(phoneInfo, rawText) {
        return parseDualResponse(phoneInfo, rawText, null);
      }
    };
  }
  return __toCommonJS(bridge_entry_exports);
})();

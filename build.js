// build.js
// Run `node build.js SG` or `node build.js MY` before loading the extension.
// Reads the market-specific .env file and generates config.js.

const fs   = require("fs");
const path = require("path");

const SF_URLS = {
  SG: "https://propertyguru.lightning.force.com",
  MY: "https://propertyguru.my.salesforce.com"
};

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) {
    console.error(`❌  ${envPath} not found. Copy .env.example and fill in the values.`);
    process.exit(1);
  }

  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  const env = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key   = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }

  return env;
}

const REQUIRED = ["GROQ_API_KEY", "GROQ_ENDPOINT", "GROQ_MODEL", "MARKET"];

function validate(env) {
  const missing = REQUIRED.filter(k => !env[k]);
  if (missing.length > 0) {
    console.error(`❌  Missing required keys: ${missing.join(", ")}`);
    process.exit(1);
  }
}

const market = process.argv[2]?.toUpperCase();
if (!market || !["SG", "MY"].includes(market)) {
  console.error("❌  Please specify a market: node build.js SG  or  node build.js MY");
  process.exit(1);
}

const envPath      = path.join(__dirname, `.env.${market}`);
const templatePath = path.join(__dirname, "config.template.js");
const outputPath   = path.join(__dirname, "config.js");

const env = loadEnv(envPath);
validate(env);

const sfUrl = SF_URLS[market];

let template = fs.readFileSync(templatePath, "utf8");

template = template
  .replace("%%GROQ_API_KEY%%",  env.GROQ_API_KEY)
  .replace("%%GROQ_ENDPOINT%%", env.GROQ_ENDPOINT)
  .replace("%%GROQ_MODEL%%",    env.GROQ_MODEL)
  .replace("%%SF_URL%%",        sfUrl);

if (template.includes("%%")) {
  console.error("❌  Unreplaced placeholder found. Check your env file.");
  process.exit(1);
}

fs.writeFileSync(outputPath, template, "utf8");
console.log(`✅  config.js built for ${market}`);
console.log(`    SF URL   : ${sfUrl}`);
console.log(`    Endpoint : ${env.GROQ_ENDPOINT}`);
console.log(`    Model    : ${env.GROQ_MODEL}`);
console.log(`    Key      : ${env.GROQ_API_KEY.slice(0, 8)}...`);
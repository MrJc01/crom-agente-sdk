import fs from "fs";
import path from "path";
import { CromClient } from "../dist/crom-agente-sdk.js";

const envPath = "/home/j/.crom/.env";
if (!fs.existsSync(envPath)) {
  console.error(".env file not found at " + envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf8");
let cromiaApiKey = "";
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*CROMIA_API_KEY\s*=\s*(.*)??\s*$/);
  if (match) {
    let value = match[1] ? match[1].trim() : "";
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    cromiaApiKey = value;
  }
});

console.log("Found CROMIA_API_KEY:", cromiaApiKey ? `${cromiaApiKey.substring(0, 10)}...` : "(none)");

const client = new CromClient({
  cloudUrl: "https://cloud.ia.crom.run",
  sessionToken: cromiaApiKey,
});

client.getCloudModels()
  .then(models => {
    console.log("Success! Fetched models count:", models && models.data ? models.data.length : 0);
    console.log("Models list:", JSON.stringify(models, null, 2));
  })
  .catch(err => {
    console.error("Failed to get cloud models:", err);
  });

import dotenv from "dotenv";
import { getMissingProductionEnvironmentVariables } from "@/lib/env";

// This command reports names only. It intentionally never prints values,
// connection strings, provider identities, or other secret material.
dotenv.config({ path: process.env.ENV_FILE?.trim() || ".env" });

const missing = getMissingProductionEnvironmentVariables();

if (missing.length > 0) {
  console.error(`Environment preflight failed. Missing or placeholder variables: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("Environment preflight passed. All required production variable names are supplied.");
}

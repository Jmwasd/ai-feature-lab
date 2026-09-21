export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" &&
      process.env.NEXT_PHASE !== "phase-production-build" && !process.env.AUTH_SECRET) {
    throw new Error(
      "AUTH_SECRET is required. Generate a key and set AUTH_SECRET in .env.local " +
      "(see .env.local.example): node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
    );
  }
}

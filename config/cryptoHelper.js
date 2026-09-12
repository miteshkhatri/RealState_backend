const crypto = require("crypto");

const ENCRYPTION_KEY = crypto.createHash("sha256").update("my-fixed-secret-key").digest();
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text.toString(), "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(encryptedText) {
  if (!encryptedText) return "";
  if (!encryptedText.includes(":")) return encryptedText;

  const [ivHex, encryptedData] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}




// Export functions for other files
module.exports = { encrypt, decrypt };

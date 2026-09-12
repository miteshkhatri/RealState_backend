const fs = require("fs");
const path = require("path");

const logsDir = path.join(__dirname, "../logs");

function deleteLogsFolder() {
  if (!fs.existsSync(logsDir)) {
    console.log("ℹ️ Logs folder already deleted");
    return;
  }
 
  fs.rmSync(logsDir, { recursive: true, force: true });
  console.log("🗑️ Logs folder deleted completely");
}

module.exports = deleteLogsFolder;

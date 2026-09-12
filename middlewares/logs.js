
const fs = require("fs");
const path = require("path");

const logsDir = path.join(__dirname, "../logs");


// 📁 logs folder ensure
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}



function cleanOldLogs() {
  if (!fs.existsSync(logsDir)) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  fs.readdirSync(logsDir).forEach((file) => {
    if (!file.endsWith(".txt")) return;

    // filename: YYYY-MM-DD.txt
    const datePart = file.replace(".txt", "");
    const fileDate = new Date(datePart);

    if (isNaN(fileDate.getTime())) return;

    const diffDays =
      (today.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24);

    // 🔥 aaj + kal rakho, usse purani delete
    if (diffDays >= 2) {
      fs.unlinkSync(path.join(logsDir, file));
      console.log("🗑️ Deleted old log file:", file);
    }
  });
}

const logMiddleware = (req, res, next) => {

  // ❌ GET APIs skip
  if (req.method === "GET") {
    return next();
  }

  cleanOldLogs();

  const startTime = new Date();

  const formatIST = (date) => {
    return (
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
        hour12: false,
      })
        .format(date)
        .replace(",", "") + " (IST)"
    );
  };

  const logFileName = `${new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}.txt`;

  const logFilePath = path.join(logsDir, logFileName);

  const originalSend = res.send;

  res.send = function (body) {
    let requestData = {};

    if (req.is("multipart/form-data")) {
      requestData = {
        fields: req.body,
        files: req.files || req.file,
      };
    } else {
      requestData = req.body;
    }

    const logEntry = `
================= API LOG =================
Time       : ${formatIST(startTime)}
Method     : ${req.method}
URL        : ${req.originalUrl}
Request    : ${JSON.stringify(requestData, null, 2)}
Response   : ${JSON.stringify(body, null, 2)}
==========================================
`;

    fs.appendFile(logFilePath, logEntry, () => {});
    originalSend.call(this, body);
  };

  next();
};


module.exports = logMiddleware;

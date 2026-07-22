import { logger } from "@/config/logger.config";
import * as https from "https";

const TEXT_LK_ENDPOINT = "app.text.lk";
const TEXT_LK_PATH = "/api/v3/sms/send";

export const sendSms = async (to: string, message: string) => {
  const TEXT_LK_TOKEN = process.env.TEXT_LK_TOKEN || "";
  
  if (!TEXT_LK_TOKEN) {
    logger.warn(`[sendSms] -> TEXT_LK_TOKEN is missing. SMS not sent.`);
    return;
  }

  logger.info(`[sendSms] -> Using v3 API for ${to}`);

  let cleanTo = to.replace(/\D/g, "");
  if (cleanTo.startsWith("0")) {
    cleanTo = "94" + cleanTo.substring(1);
  } else if (cleanTo.length === 9) {
    cleanTo = "94" + cleanTo;
  }

  const postData = JSON.stringify({
    recipient: cleanTo,
    sender_id: "ALL FIX",
    type: "plain",
    message: message,
  });

  const options = {
    hostname: TEXT_LK_ENDPOINT,
    path: TEXT_LK_PATH,
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TEXT_LK_TOKEN}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
      "Accept": "application/json"
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(body);
            logger.info(`[sendSms] -> Success: ${JSON.stringify(parsed)}`);
            resolve(parsed);
          } catch (e) {
            logger.info(`[sendSms] -> Success (Non-JSON): ${body}`);
            resolve({ body });
          }
        } else {
          logger.error(`[sendSms] -> API Error (${res.statusCode}): ${body}`);
          reject(new Error(`API Error ${res.statusCode}: ${body.slice(0, 100)}`));
        }
      });
    });

    req.on("error", (e) => {
      logger.error(`[sendSms] -> Connection Error: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
};

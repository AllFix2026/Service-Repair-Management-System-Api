import { Router } from "express";
import { authenticate } from "@/middlewares/auth.middleware";
import { sendStandardSms } from "@/controllers/sms.controller";

const router = Router();

router.use(authenticate);
router.post("/send", sendStandardSms);

export default router;

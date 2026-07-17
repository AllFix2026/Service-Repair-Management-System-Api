import { Router } from "express";
import {
  listAppointments,
  addAppointment,
  patchAppointment,
  removeAppointment,
} from "@/controllers/appointment.controller";

const router = Router();

router.get("/", listAppointments);
router.post("/", addAppointment);
router.patch("/:id", patchAppointment);
router.delete("/:id", removeAppointment);

export default router;

import type { Request, Response } from "express";
import {
  createInitialAdminUser,
  getCurrentUser,
  loginUser,
  logoutSession,
  refreshSession,
  requestPasswordReset,
  completePasswordReset,
  updateCurrentUser,
} from "@/services/auth/auth.service";
import type { AuthRequest } from "@/types/auth.types";

export const login = async (req: Request, res: Response) => {
  console.log(`[LoginController] Login attempt:`, JSON.stringify(req.body));
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    console.log(`[LoginController] Missing credentials`);
    return res.status(400).json({ success: false, message: "email and password are required" });
  }

  try {
    const { user, tokens } = await loginUser(email, password);
    return res.status(200).json({ 
      success: true, 
      user, 
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken 
    });
  } catch (error: any) {
    return res.status(error.status ?? 500).json({
      success: false,
      message: error.message ?? "Unexpected failure",
    });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: "refreshToken is required" });
  }

  try {
    const data = await refreshSession(refreshToken);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.status ?? 500).json({
      success: false,
      message: error.message ?? "Unexpected failure",
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: "refreshToken is required" });
  }

  try {
    await logoutSession(refreshToken);
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (error: any) {
    return res.status(error.status ?? 500).json({
      success: false,
      message: error.message ?? "Unexpected failure",
    });
  }
};

export const me = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const data = await getCurrentUser(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.status ?? 500).json({
      success: false,
      message: error.message ?? "Unexpected failure",
    });
  }
};

export const createInitialAdmin = async (req: Request, res: Response) => {
  const { email, password, tenantName } = req.body as { email?: string; password?: string; tenantName?: string };
  if (!email || !password || !tenantName) {
    return res.status(400).json({ success: false, message: "email, password and tenantName are required" });
  }

  try {
    const data = await createInitialAdminUser(email, password, tenantName);
    return res.status(201).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.status ?? 500).json({
      success: false,
      message: error.message ?? "Unexpected failure",
    });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    await requestPasswordReset(email);
    return res.status(200).json({
      success: true,
      message: "If an account with that email exists, a reset link has been sent.",
    });
  } catch (error: any) {
    return res.status(error.status ?? 500).json({
      success: false,
      message: error.message ?? "Failed to process forgot password request",
    });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) {
    return res.status(400).json({ success: false, message: "Token and password are required" });
  }

  try {
    await completePasswordReset(token, password);
    return res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error: any) {
    return res.status(error.status ?? 500).json({
      success: false,
      message: error.message ?? "Failed to reset password",
    });
  }
};
export const updateMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const { fullName, password } = req.body;
    const data = await updateCurrentUser(req.user.id, { fullName, password });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(error.status ?? 500).json({
      success: false,
      message: error.message ?? "Failed to update profile",
    });
  }
};


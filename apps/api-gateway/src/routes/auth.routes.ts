import { Router, Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { AuthService } from "../services/auth.service";
import { validate } from "../middleware/validate";
import { signupSchema, loginSchema } from "../utils/schemas";
import { ApiResponse } from "@synchive/shared-types";
import { authenticate } from "../middleware/auth";
import { db } from "../services/db.service";
import { users } from "@synchive/db";
import { AppError } from "../middleware/error-handler";

export const authRouter = Router();

// POST /api/auth/signup
authRouter.post(
  "/signup",
  validate(signupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;
      const { user, token } = await AuthService.signup(name, email, password);
      res.status(201).json({
        success: true,
        data: { user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }, token },
      } satisfies ApiResponse);
    } catch (error) { next(error); }
  }
);

// POST /api/auth/login
authRouter.post(
  "/login",
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const { user, token } = await AuthService.login(email, password);
      res.status(200).json({
        success: true,
        data: { user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }, token },
      } satisfies ApiResponse);
    } catch (error) { next(error); }
  }
);

// GET /api/auth/me
authRouter.get("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
    res.json({ success: true, data: user } satisfies ApiResponse);
  } catch (error) { next(error); }
});

// PATCH /api/auth/me — update display name
authRouter.patch("/me", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) throw new AppError(400, "INVALID_NAME", "Name cannot be empty");
    const [updated] = await db
      .update(users)
      .set({ name: name.trim() })
      .where(eq(users.id, req.user!.userId))
      .returning({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt });
    if (!updated) throw new AppError(404, "USER_NOT_FOUND", "User not found");
    res.json({ success: true, data: updated } satisfies ApiResponse);
  } catch (error) { next(error); }
});

// PATCH /api/auth/password — change password (requires current password)
authRouter.patch("/password", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword)
      throw new AppError(400, "MISSING_FIELDS", "currentPassword and newPassword are required");
    if (newPassword.length < 8)
      throw new AppError(400, "WEAK_PASSWORD", "New password must be at least 8 characters");

    const [user] = await db.select().from(users).where(eq(users.id, req.user!.userId)).limit(1);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError(401, "INVALID_PASSWORD", "Current password is incorrect");

    const hash = await bcrypt.hash(newPassword, 12);
    await db.update(users).set({ passwordHash: hash }).where(eq(users.id, req.user!.userId));

    res.json({ success: true, data: { message: "Password updated successfully" } } satisfies ApiResponse);
  } catch (error) { next(error); }
});
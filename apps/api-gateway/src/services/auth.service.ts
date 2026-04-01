import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { users } from "@synchive/db";
import { config } from "../config";
import { db } from "./db.service";
import { AppError } from "../middleware/error-handler";
import { AuthPayload } from "../middleware/auth";

export class AuthService {
  static async signup(
    name: string,
    email: string,
    password: string
  ): Promise<{ user: typeof users.$inferSelect; token: string }> {
    // Check if email exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      throw new AppError(409, "EMAIL_EXISTS", "This email is already registered");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

    // Insert user
    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
      })
      .returning();

    // Generate JWT
    const token = AuthService.generateToken(user.id, user.email);

    return { user, token };
  }

  static async login(
    email: string,
    password: string
  ): Promise<{ user: typeof users.$inferSelect; token: string }> {
    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    if (!user.isActive) {
      throw new AppError(403, "ACCOUNT_DISABLED", "This account has been disabled");
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const token = AuthService.generateToken(user.id, user.email);

    return { user, token };
  }

  private static generateToken(userId: string, email: string): string {
    const payload: AuthPayload = { userId, email };
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    });
  }
}
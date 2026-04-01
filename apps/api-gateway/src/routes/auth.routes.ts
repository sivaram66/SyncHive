import { Router, Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { validate } from "../middleware/validate";
import { signupSchema, loginSchema } from "../utils/schemas";
import { ApiResponse } from "@synchive/shared-types";

export const authRouter = Router();

authRouter.post(
  "/signup",
  validate(signupSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;
      const { user, token } = await AuthService.signup(name, email, password);

      const response: ApiResponse = {
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
          },
          token,
        },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

authRouter.post(
  "/login",
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const { user, token } = await AuthService.login(email, password);

      const response: ApiResponse = {
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
          },
          token,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);
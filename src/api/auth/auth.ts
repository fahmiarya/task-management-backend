import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod/v4";
import { loginUser, registerUser } from "@/services/auth.services";

const authRouter = new Hono();

const registerSchema = z.object({
	name: z.string().min(2),
	email: z.email(),
	password: z.string().min(8),
});

const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(8),
});

authRouter.post("/register", zValidator("json", registerSchema), async (c) => {
	try {
		const body = c.req.valid("json");

		const user = await registerUser(body);

		return c.json(
			{
				success: true,
				message: "Registration successful",
				data: user,
			},
			201,
		);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "Email is already registered"
		) {
			return c.json(
				{
					success: false,
					message: error.message,
				},
				409,
			);
		}

		throw error;
	}
});

authRouter.post("/login", zValidator("json", loginSchema), async (c) => {
	try {
		const body = c.req.valid("json");

		const result = await loginUser(body);

		return c.json({
			success: true,
			message: "Login successful",
			data: result,
		});
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "Invalid email or password"
		) {
			return c.json(
				{
					success: false,
					message: error.message,
				},
				401,
			);
		}

		throw error;
	}
});

authRouter.post("/logout", async (c) => {
	return c.json({
		success: true,
		message: "Logout successful",
	});
});

export default authRouter;

import type { Context, Next } from "hono";
import { verifyAccessToken } from "../jwt";

export async function authMiddleware(c: Context, next: Next) {
	const authorization = c.req.header("Authorization");

	if (!authorization?.startsWith("Bearer ")) {
		return c.json(
			{
				success: false,
				message: "Unauthorized",
			},
			401,
		);
	}

	const token = authorization.substring(7);

	try {
		const payload = verifyAccessToken(token);

		c.set("userId", payload.sub);
		c.set("userRole", payload.role);

		await next();
	} catch {
		return c.json(
			{
				success: false,
				message: "Invalid or expired token",
			},
			401,
		);
	}
}

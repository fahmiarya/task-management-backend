import { Hono } from "hono";
import type { AuthType } from "@/lib/jwt";
import { authMiddleware } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";

const meRouter = new Hono<{ Variables: AuthType }>();

meRouter.use("*", authMiddleware);

meRouter.get("/", async (c) => {
	const userId = c.get("userId");

	const user = await prisma.user.findUnique({
		where: {
			id: userId,
		},
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			departmentId: true,
			department: {
				select: {
					id: true,
					name: true,
				},
			},
		},
	});

	if (!user) {
		return c.json(
			{
				success: false,
				message: "User not found",
			},
			404,
		);
	}

	return c.json({
		success: true,
		data: user,
	});
});

export default meRouter;

import { Hono } from "hono";

import { getAuthContext } from "@/lib/auth-context";
import { canAccessProject } from "@/lib/authorization";
import type { AuthType } from "@/lib/jwt";
import { authMiddleware } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";

const clientRouter = new Hono<{
	Variables: AuthType;
}>();

clientRouter.use("*", authMiddleware);

clientRouter.get("/projects/:projectId/tasks", async (c) => {
	const userId = c.get("userId");
	const projectId = c.req.param("projectId");

	const authContext = await getAuthContext(userId);

	if (!authContext) {
		return c.json({ success: false, message: "User not found" }, 404);
	}

	if (authContext.role !== "CLIENT_GUEST") {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	const allowed = await canAccessProject(authContext, projectId);

	if (!allowed) {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	const tasks = await prisma.task.findMany({
		where: {
			projectId,
			clientVisible: true,
			deletedAt: null,
		},
		select: {
			id: true,
			title: true,
			description: true,
			status: true,
			clientVisible: true,
			createdAt: true,
			updatedAt: true,
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return c.json({
		success: true,
		data: tasks,
	});
});

clientRouter.get("/projects/:projectId/metrics", async (c) => {
	const userId = c.get("userId");
	const projectId = c.req.param("projectId");

	const authContext = await getAuthContext(userId);

	if (!authContext) {
		return c.json({ success: false, message: "User not found" }, 404);
	}

	if (authContext.role !== "CLIENT_GUEST") {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	const allowed = await canAccessProject(authContext, projectId);

	if (!allowed) {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	const tasks = await prisma.task.findMany({
		where: {
			projectId,
			deletedAt: null,
			clientVisible: true,
		},
		select: {
			status: true,
		},
	});

	const total = tasks.length;
	const completed = tasks.filter((task) => task.status === "DONE").length;

	const inProgress = tasks.filter(
		(task) => task.status === "IN_PROGRESS",
	).length;

	const todo = tasks.filter((task) => task.status === "TODO").length;

	return c.json({
		success: true,
		data: {
			total,
			completed,
			inProgress,
			todo,
			completionPercentage:
				total === 0 ? 0 : Math.round((completed / total) * 100),
		},
	});
});

export default clientRouter;

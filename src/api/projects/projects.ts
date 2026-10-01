import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod/v4";
import { getAuthContext } from "@/lib/auth-context";
import { canAccessProject } from "@/lib/authorization";
import type { AuthType } from "@/lib/jwt";
import { authMiddleware } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import {
	createProject,
	getProjectById,
	softDeleteProject,
	updateProject,
} from "@/services/project.service";
import {
	addProjectMember,
	getProjectMembers,
	removeProjectMember,
} from "@/services/project-member.service";

const projectRouter = new Hono<{
	Variables: AuthType;
}>();

projectRouter.use("*", authMiddleware);

const memberSchema = z.object({
	userId: z.string().min(1),
});
const createProjectSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().optional(),
});

const updateProjectSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	description: z.string().optional(),
});

projectRouter.post("/", zValidator("json", createProjectSchema), async (c) => {
	const userId = c.get("userId");
	const authContext = await getAuthContext(userId);

	if (!authContext) {
		return c.json(
			{
				success: false,
				message: "User not found",
			},
			404,
		);
	}

	if (authContext.role !== "PRODUCT_MANAGER") {
		return c.json(
			{
				success: false,
				message: "Forbidden",
			},
			403,
		);
	}

	const input = c.req.valid("json");

	const project = await createProject(input);

	return c.json(
		{
			success: true,
			data: project,
		},
		201,
	);
});

projectRouter.get("/:projectId", async (c) => {
	const userId = c.get("userId");
	const projectId = c.req.param("projectId");

	const authContext = await getAuthContext(userId);

	if (!authContext) {
		return c.json(
			{
				success: false,
				message: "User not found",
			},
			404,
		);
	}

	const project = await getProjectById(projectId);

	if (!project) {
		return c.json(
			{
				success: false,
				message: "Project not found",
			},
			404,
		);
	}

	if (authContext.role === "CLIENT_GUEST") {
		return c.json(
			{
				success: false,
				message: "Forbidden",
			},
			403,
		);
	}

	const allowed = await canAccessProject(authContext, projectId);

	if (!allowed) {
		return c.json(
			{
				success: false,
				message: "Forbidden",
			},
			403,
		);
	}

	return c.json({
		success: true,
		data: project,
	});
});

projectRouter.patch(
	"/:projectId",
	zValidator("json", updateProjectSchema),
	async (c) => {
		const userId = c.get("userId");
		const projectId = c.req.param("projectId");

		const authContext = await getAuthContext(userId);

		if (!authContext) {
			return c.json(
				{
					success: false,
					message: "User not found",
				},
				404,
			);
		}

		if (authContext.role !== "PRODUCT_MANAGER") {
			return c.json(
				{
					success: false,
					message: "Forbidden",
				},
				403,
			);
		}

		const project = await getProjectById(projectId);

		if (!project) {
			return c.json(
				{
					success: false,
					message: "Project not found",
				},
				404,
			);
		}

		const input = c.req.valid("json");

		const updatedProject = await updateProject(projectId, input);

		return c.json({
			success: true,
			data: updatedProject,
		});
	},
);

projectRouter.delete("/:projectId", async (c) => {
	const userId = c.get("userId");
	const projectId = c.req.param("projectId");

	const authContext = await getAuthContext(userId);

	if (!authContext) {
		return c.json(
			{
				success: false,
				message: "User not found",
			},
			404,
		);
	}

	if (authContext.role !== "PRODUCT_MANAGER") {
		return c.json(
			{
				success: false,
				message: "Forbidden",
			},
			403,
		);
	}

	const project = await getProjectById(projectId);

	if (!project) {
		return c.json(
			{
				success: false,
				message: "Project not found",
			},
			404,
		);
	}

	await softDeleteProject(projectId);

	return c.json({
		success: true,
		message: "Project deleted successfully",
	});
});

projectRouter.get("/:projectId/members", async (c) => {
	const userId = c.get("userId");
	const projectId = c.req.param("projectId");

	const authContext = await getAuthContext(userId);

	if (!authContext) {
		return c.json({ success: false, message: "User not found" }, 404);
	}

	const allowed = await canAccessProject(authContext, projectId);

	if (!allowed) {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	const members = await getProjectMembers(projectId);

	return c.json({
		success: true,
		data: members,
	});
});

projectRouter.post(
	"/:projectId/members",
	zValidator("json", memberSchema),
	async (c) => {
		const userId = c.get("userId");
		const projectId = c.req.param("projectId");

		const authContext = await getAuthContext(userId);

		if (!authContext) {
			return c.json({ success: false, message: "User not found" }, 404);
		}

		if (authContext.role !== "PRODUCT_MANAGER") {
			return c.json({ success: false, message: "Forbidden" }, 403);
		}

		const { userId: memberUserId } = c.req.valid("json");

		try {
			const member = await addProjectMember(projectId, memberUserId);

			return c.json(
				{
					success: true,
					data: member,
				},
				201,
			);
		} catch (error) {
			if (error instanceof Error && error.message.includes("Only internal")) {
				return c.json({ success: false, message: error.message }, 400);
			}

			return c.json(
				{
					success: false,
					message: "User is already a project member",
				},
				409,
			);
		}
	},
);

projectRouter.delete("/:projectId/members/:memberUserId", async (c) => {
	const userId = c.get("userId");
	const projectId = c.req.param("projectId");
	const memberUserId = c.req.param("memberUserId");

	const authContext = await getAuthContext(userId);

	if (!authContext) {
		return c.json({ success: false, message: "User not found" }, 404);
	}

	if (authContext.role !== "PRODUCT_MANAGER") {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	try {
		await removeProjectMember(projectId, memberUserId);
	} catch {
		return c.json({ success: false, message: "Member not found" }, 404);
	}

	return c.json({
		success: true,
		message: "Member removed successfully",
	});
});

projectRouter.get("/", async (c) => {
	const userId = c.get("userId");
	const authContext = await getAuthContext(userId);

	if (!authContext) {
		return c.json({ success: false, message: "User not found" }, 404);
	}

	const projects = await prisma.project.findMany({
		where: {
			deletedAt: null,
			...(authContext.role === "INTERNAL"
				? {
						members: {
							some: {
								userId: authContext.userId,
							},
						},
					}
				: {}),
		},
		orderBy: {
			createdAt: "desc",
		},
	});

	return c.json({
		success: true,
		data: projects,
	});
});

export default projectRouter;

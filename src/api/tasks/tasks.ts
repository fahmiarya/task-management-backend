import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod/v4";
import { getAuthContext } from "@/lib/auth-context";
import { canAccessProject } from "@/lib/authorization";
import type { AuthType } from "@/lib/jwt";
import { authMiddleware } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { buildTaskQuery } from "@/lib/query-filter";
import {
	addTaskDependency,
	changeTaskStatus,
	createTask,
	getTaskAuditLogs,
	getTaskById,
	listTasks,
	softDeleteTask,
	updateTask,
} from "@/services/task.service";
import {
	createTaskAttachment,
	getTaskAttachments,
} from "@/services/task-attachment.service";

const taskRouter = new Hono<{
	Variables: AuthType;
}>();

taskRouter.use("*", authMiddleware);

const createTaskSchema = z.object({
	projectId: z.string().min(1),
	title: z.string().min(1).max(255),
	description: z.string().optional(),
	assigneeId: z.string().optional(),
	clientVisible: z.boolean().optional(),
});

const updateTaskSchema = z.object({
	version: z.number().int().positive(),
	title: z.string().min(1).max(255).optional(),
	description: z.string().optional(),
	assigneeId: z.string().nullable().optional(),
	clientVisible: z.boolean().optional(),
});

const statusSchema = z.object({
	version: z.number().int().positive(),
	status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
});

const dependencySchema = z.object({
	dependsOnId: z.string().min(1),
});

const attachmentSchema = z.object({
	fileName: z.string().min(1),
	fileUrl: z.string().url(),
	mimeType: z.string().optional(),
	size: z.number().int().nonnegative().optional(),
});

taskRouter.post("/", zValidator("json", createTaskSchema), async (c) => {
	const userId = c.get("userId");
	const authContext = await getAuthContext(userId);

	if (!authContext) {
		return c.json({ success: false, message: "User not found" }, 404);
	}

	if (authContext.role !== "PRODUCT_MANAGER") {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	const input = c.req.valid("json");

	const allowed = await canAccessProject(authContext, input.projectId);

	if (!allowed) {
		return c.json({ success: false, message: "Project not found" }, 404);
	}

	try {
		const task = await createTask(input);

		return c.json(
			{
				success: true,
				data: task,
			},
			201,
		);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message === "ASSIGNEE_MUST_BE_INTERNAL_PROJECT_MEMBER"
		) {
			return c.json(
				{
					success: false,
					message: "Assignee must be an internal project member",
				},
				400,
			);
		}

		throw error;
	}
});

taskRouter.get("/project/:projectId", async (c) => {
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

	const query = buildTaskQuery(new URL(c.req.url).searchParams);

	const result = await listTasks(projectId, query);

	return c.json({
		success: true,
		data: result.items,
		meta: {
			total: result.total,
			page: Math.floor(query.skip / query.take) + 1,
			rows: query.take,
			totalPages: Math.ceil(result.total / query.take),
		},
	});
});

taskRouter.get("/:taskId", async (c) => {
	const userId = c.get("userId");
	const taskId = c.req.param("taskId");

	const authContext = await getAuthContext(userId);

	if (!authContext) {
		return c.json({ success: false, message: "User not found" }, 404);
	}

	const task = await getTaskById(taskId);

	if (!task) {
		return c.json({ success: false, message: "Task not found" }, 404);
	}

	const allowed = await canAccessProject(authContext, task.projectId);

	if (!allowed) {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	return c.json({
		success: true,
		data: task,
	});
});

taskRouter.patch(
	"/:taskId",
	zValidator("json", updateTaskSchema),
	async (c) => {
		const userId = c.get("userId");
		const taskId = c.req.param("taskId");

		const authContext = await getAuthContext(userId);

		if (!authContext) {
			return c.json({ success: false, message: "User not found" }, 404);
		}

		const task = await getTaskById(taskId);

		if (!task) {
			return c.json({ success: false, message: "Task not found" }, 404);
		}

		const allowed = await canAccessProject(authContext, task.projectId);

		if (!allowed) {
			return c.json({ success: false, message: "Forbidden" }, 403);
		}

		if (authContext.role === "INTERNAL" && task.assigneeId !== userId) {
			return c.json({ success: false, message: "Forbidden" }, 403);
		}

		const { version, ...input } = c.req.valid("json");

		try {
			const updated = await updateTask(taskId, version, input, userId);

			return c.json({
				success: true,
				data: updated,
			});
		} catch (error) {
			if (error instanceof Error) {
				if (error.message === "VERSION_CONFLICT") {
					return c.json(
						{
							success: false,
							message: "Task was modified by another user",
						},
						409,
					);
				}

				if (error.message === "ASSIGNEE_MUST_BE_INTERNAL_PROJECT_MEMBER") {
					return c.json(
						{
							success: false,
							message: "Assignee must be an internal project member",
						},
						400,
					);
				}
			}

			throw error;
		}
	},
);

taskRouter.patch(
	"/:taskId/status",
	zValidator("json", statusSchema),
	async (c) => {
		const userId = c.get("userId");
		const taskId = c.req.param("taskId");

		const authContext = await getAuthContext(userId);

		if (!authContext) {
			return c.json({ success: false, message: "User not found" }, 404);
		}

		const task = await getTaskById(taskId);

		if (!task) {
			return c.json({ success: false, message: "Task not found" }, 404);
		}

		const allowed = await canAccessProject(authContext, task.projectId);

		if (!allowed) {
			return c.json({ success: false, message: "Forbidden" }, 403);
		}

		if (authContext.role === "INTERNAL" && task.assigneeId !== userId) {
			return c.json({ success: false, message: "Forbidden" }, 403);
		}

		if (authContext.role === "INTERNAL") {
			return c.json(
				{
					success: false,
					message: "Internal engineers can only change task status",
				},
				403,
			);
		}

		const input = c.req.valid("json");

		// Frontend can only start a task after all dependencies are done.
		if (
			authContext.department === "FRONTEND" &&
			input.status === "IN_PROGRESS"
		) {
			const dependencies = await prisma.taskDependency.findMany({
				where: {
					taskId,
				},
				include: {
					dependsOn: {
						select: {
							status: true,
						},
					},
				},
			});

			if (dependencies.some((item) => item.dependsOn.status !== "DONE")) {
				return c.json(
					{
						success: false,
						message: "Task is blocked by unfinished dependencies",
					},
					409,
				);
			}
		}

		try {
			const updated = await changeTaskStatus(
				taskId,
				input.version,
				input.status,
				userId,
			);

			return c.json({
				success: true,
				data: updated,
			});
		} catch (error) {
			if (error instanceof Error) {
				if (error.message === "ONLY_EXECUTOR_CAN_COMPLETE") {
					return c.json(
						{
							success: false,
							message: "Only the task executor can complete the task",
						},
						403,
					);
				}
				if (error.message === "VERSION_CONFLICT") {
					return c.json(
						{
							success: false,
							message: "Task was modified by another user",
						},
						409,
					);
				}

				if (error.message === "DEPENDENCY_BLOCKED") {
					return c.json(
						{
							success: false,
							message: "Task is blocked by unfinished dependencies",
						},
						409,
					);
				}
			}

			throw error;
		}
	},
);

taskRouter.post(
	"/:taskId/dependencies",
	zValidator("json", dependencySchema),
	async (c) => {
		const userId = c.get("userId");
		const taskId = c.req.param("taskId");

		const authContext = await getAuthContext(userId);

		if (!authContext) {
			return c.json({ success: false, message: "User not found" }, 404);
		}

		if (authContext.role !== "PRODUCT_MANAGER") {
			return c.json({ success: false, message: "Forbidden" }, 403);
		}

		const task = await getTaskById(taskId);

		if (!task) {
			return c.json({ success: false, message: "Task not found" }, 404);
		}

		try {
			const dependency = await addTaskDependency(
				taskId,
				c.req.valid("json").dependsOnId,
			);

			return c.json(
				{
					success: true,
					data: dependency,
				},
				201,
			);
		} catch (error) {
			if (error instanceof Error) {
				if (error.message === "SELF_DEPENDENCY") {
					return c.json(
						{
							success: false,
							message: "A task cannot depend on itself",
						},
						400,
					);
				}

				if (error.message === "CROSS_PROJECT_DEPENDENCY") {
					return c.json(
						{
							success: false,
							message: "Dependencies must belong to the same project",
						},
						400,
					);
				}

				if (error.message === "TASK_NOT_FOUND") {
					return c.json(
						{
							success: false,
							message: "Task not found",
						},
						404,
					);
				}
			}

			return c.json(
				{
					success: false,
					message: "Dependency already exists",
				},
				409,
			);
		}
	},
);

taskRouter.delete("/:taskId", async (c) => {
	const userId = c.get("userId");
	const taskId = c.req.param("taskId");

	const authContext = await getAuthContext(userId);

	if (!authContext) {
		return c.json({ success: false, message: "User not found" }, 404);
	}

	if (authContext.role !== "PRODUCT_MANAGER") {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	const task = await getTaskById(taskId);

	if (!task) {
		return c.json({ success: false, message: "Task not found" }, 404);
	}

	await softDeleteTask(taskId, authContext.userId);

	return c.json({
		success: true,
		message: "Task deleted successfully",
	});
});

taskRouter.get("/:taskId/audit-logs", async (c) => {
	const userId = c.get("userId");
	const taskId = c.req.param("taskId");

	const authContext = await getAuthContext(userId);

	if (!authContext) {
		return c.json({ success: false, message: "User not found" }, 404);
	}

	const task = await getTaskById(taskId);

	if (!task) {
		return c.json({ success: false, message: "Task not found" }, 404);
	}

	const allowed = await canAccessProject(authContext, task.projectId);

	if (!allowed || authContext.role === "CLIENT_GUEST") {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	const logs = await getTaskAuditLogs(taskId);

	return c.json({
		success: true,
		data: logs,
	});
});

taskRouter.post("/:taskId/attachments", async (c) => {
	const auth = await getAuthContext(c.get("userId"));

	if (!auth) {
		return c.json({ success: false, message: "Unauthorized" }, 401);
	}

	if (auth.role === "CLIENT_GUEST") {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	const taskId = c.req.param("taskId");

	const task = await getTaskById(taskId);

	if (!task) {
		return c.json({ success: false, message: "Task not found" }, 404);
	}

	const allowed = await canAccessProject(auth, task.projectId);

	if (!allowed) {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	// Internal engineer hanya boleh upload pada task miliknya.
	if (auth.role === "INTERNAL" && task.assigneeId !== auth.userId) {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	const body = attachmentSchema.safeParse(await c.req.json());

	if (!body.success) {
		return c.json(
			{
				success: false,
				message: "Invalid attachment data",
				errors: body.error.flatten(),
			},
			400,
		);
	}

	const attachment = await createTaskAttachment({
		taskId,
		uploadedById: auth.userId,
		...body.data,
	});

	return c.json(
		{
			success: true,
			data: attachment,
		},
		201,
	);
});

taskRouter.get("/:taskId/attachments", async (c) => {
	const auth = await getAuthContext(c.get("userId"));

	if (!auth) {
		return c.json({ success: false, message: "Unauthorized" }, 401);
	}

	if (auth.role === "CLIENT_GUEST") {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	const task = await getTaskById(c.req.param("taskId"));

	if (!task) {
		return c.json({ success: false, message: "Task not found" }, 404);
	}

	if (!(await canAccessProject(auth, task.projectId))) {
		return c.json({ success: false, message: "Forbidden" }, 403);
	}

	const attachments = await getTaskAttachments(task.id);

	return c.json({
		success: true,
		data: attachments,
	});
});

export default taskRouter;

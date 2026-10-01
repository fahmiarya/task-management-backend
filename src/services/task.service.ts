import { prisma } from "@/lib/prisma";
import type { TaskStatus } from "../../prisma/generated/prisma-client";

export async function createTask(input: {
	projectId: string;
	title: string;
	description?: string;
	assigneeId?: string;
	clientVisible?: boolean;
}) {
	return prisma.task.create({
		data: {
			projectId: input.projectId,
			title: input.title,
			description: input.description,
			assigneeId: input.assigneeId,
			clientVisible: input.clientVisible ?? false,
		},
	});
}

export async function getTaskById(taskId: string) {
	return prisma.task.findFirst({
		where: {
			id: taskId,
			deletedAt: null,
		},
		include: {
			assignee: {
				select: {
					id: true,
					name: true,
					email: true,
					role: true,
					department: {
						select: {
							name: true,
						},
					},
				},
			},
			dependencies: {
				include: {
					dependsOn: {
						select: {
							id: true,
							title: true,
							status: true,
						},
					},
				},
			},
		},
	});
}

export async function listTasks(
	projectId: string,
	query: {
		where: Record<string, unknown>;
		orderBy: Record<string, unknown>;
		skip: number;
		take: number;
	},
) {
	const where = {
		...query.where,
		projectId,
	};

	const [tasks, total] = await prisma.$transaction([
		prisma.task.findMany({
			where,
			orderBy: query.orderBy,
			skip: query.skip,
			take: query.take,
			include: {
				assignee: {
					select: {
						id: true,
						name: true,
						email: true,
						role: true,
						department: {
							select: {
								name: true,
							},
						},
					},
				},
			},
		}),
		prisma.task.count({ where }),
	]);

	return {
		items: tasks,
		total,
	};
}

export async function updateTask(
	taskId: string,
	version: number,
	input: {
		title?: string;
		description?: string;
		assigneeId?: string | null;
		clientVisible?: boolean;
	},
	userId: string,
) {
	return prisma.$transaction(async (tx) => {
		const updated = await tx.task.updateMany({
			where: {
				id: taskId,
				version,
				deletedAt: null,
			},
			data: {
				...input,
				version: {
					increment: 1,
				},
			},
		});

		if (updated.count === 0) {
			throw new Error("VERSION_CONFLICT");
		}

		const task = await tx.task.findUniqueOrThrow({
			where: { id: taskId },
		});

		for (const [column, newValue] of Object.entries(input)) {
			await tx.auditLog.create({
				data: {
					taskId,
					userId,
					changedColumn: column,
					oldValue: null,
					newValue: String(newValue),
				},
			});
		}

		return task;
	});
}

export async function changeTaskStatus(
	taskId: string,
	version: number,
	status: TaskStatus,
	userId: string,
) {
	return prisma.$transaction(async (tx) => {
		const task = await tx.task.findFirst({
			where: {
				id: taskId,
				deletedAt: null,
			},
			include: {
				dependencies: {
					include: {
						dependsOn: {
							select: {
								id: true,
								status: true,
							},
						},
					},
				},
			},
		});

		if (!task) {
			throw new Error("TASK_NOT_FOUND");
		}

		if (task.version !== version) {
			throw new Error("VERSION_CONFLICT");
		}

		if (task.status === "IN_PROGRESS" && status === "DONE") {
			const user = await tx.user.findUnique({
				where: {
					id: userId,
				},
				select: {
					role: true,
				},
			});

			if (user?.role === "PRODUCT_MANAGER") {
				throw new Error("ONLY_EXECUTOR_CAN_COMPLETE");
			}
		}

		if (
			(status === "IN_PROGRESS" || status === "DONE") &&
			task.dependencies.some(
				(dependency) => dependency.dependsOn.status !== "DONE",
			)
		) {
			throw new Error("DEPENDENCY_BLOCKED");
		}

		const updated = await tx.task.updateMany({
			where: {
				id: taskId,
				version,
				deletedAt: null,
			},
			data: {
				status,
				version: {
					increment: 1,
				},
			},
		});

		if (updated.count === 0) {
			throw new Error("VERSION_CONFLICT");
		}

		await tx.auditLog.create({
			data: {
				taskId,
				userId,
				changedColumn: "status",
				oldValue: task.status,
				newValue: status,
			},
		});

		return tx.task.findUniqueOrThrow({
			where: { id: taskId },
		});
	});
}

export async function addTaskDependency(taskId: string, dependsOnId: string) {
	if (taskId === dependsOnId) {
		throw new Error("SELF_DEPENDENCY");
	}

	const [task, dependency] = await Promise.all([
		prisma.task.findFirst({
			where: {
				id: taskId,
				deletedAt: null,
			},
		}),
		prisma.task.findFirst({
			where: {
				id: dependsOnId,
				deletedAt: null,
			},
		}),
	]);

	if (!task || !dependency) {
		throw new Error("TASK_NOT_FOUND");
	}

	if (task.projectId !== dependency.projectId) {
		throw new Error("CROSS_PROJECT_DEPENDENCY");
	}

	return prisma.taskDependency.create({
		data: {
			taskId,
			dependsOnId,
		},
	});
}

export async function softDeleteTask(taskId: string) {
	return prisma.task.update({
		where: {
			id: taskId,
		},
		data: {
			deletedAt: new Date(),
		},
	});
}

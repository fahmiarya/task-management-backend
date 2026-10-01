import { prisma } from "@/lib/prisma";

type CreateProjectInput = {
	name: string;
	description?: string;
};

type UpdateProjectInput = {
	name?: string;
	description?: string;
};

export async function createProject(input: CreateProjectInput) {
	return prisma.project.create({
		data: {
			name: input.name,
			description: input.description,
		},
	});
}

export async function getProjectById(projectId: string) {
	return prisma.project.findFirst({
		where: {
			id: projectId,
			deletedAt: null,
		},
		include: {
			members: {
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
							role: true,
							department: {
								select: {
									id: true,
									name: true,
								},
							},
						},
					},
				},
			},
		},
	});
}

export async function updateProject(
	projectId: string,
	input: UpdateProjectInput,
) {
	return prisma.project.update({
		where: {
			id: projectId,
		},
		data: input,
	});
}

export async function softDeleteProject(projectId: string) {
	return prisma.project.update({
		where: {
			id: projectId,
		},
		data: {
			deletedAt: new Date(),
		},
	});
}

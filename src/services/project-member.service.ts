import { prisma } from "@/lib/prisma";

export async function getProjectMembers(projectId: string) {
	return prisma.projectMember.findMany({
		where: {
			projectId,
		},
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
	});
}

export async function addProjectMember(projectId: string, userId: string) {
	const user = await prisma.user.findFirst({
		where: {
			id: userId,
			deletedAt: null,
			role: {
				in: ["INTERNAL", "CLIENT_GUEST"],
			},
		},
	});

	if (!user) {
		throw new Error(
			"Only internal users or client guests can be project members",
		);
	}

	return prisma.projectMember.create({
		data: {
			projectId,
			userId,
		},
		include: {
			user: {
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
	});
}

export async function removeProjectMember(projectId: string, userId: string) {
	return prisma.projectMember.delete({
		where: {
			projectId_userId: {
				projectId,
				userId,
			},
		},
	});
}

import { prisma } from "@/lib/prisma";

export async function createTaskAttachment(input: {
	taskId: string;
	uploadedById: string;
	fileName: string;
	fileUrl: string;
	mimeType?: string;
	size?: number;
}) {
	return prisma.taskAttachment.create({
		data: input,
	});
}

export async function getTaskAttachments(taskId: string) {
	return prisma.taskAttachment.findMany({
		where: { taskId },
		include: {
			uploadedBy: {
				select: {
					id: true,
					name: true,
					role: true,
					department: {
						select: { name: true },
					},
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});
}

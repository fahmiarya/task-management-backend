import { prisma } from "@/lib/prisma";
import type {
	DepartmentName,
	UserRole,
} from "../../prisma/generated/prisma-client";

export type AuthorizationContext = {
	userId: string;
	role: UserRole;
	department: DepartmentName | null;
};

export async function canAccessProject(
	context: AuthorizationContext,
	projectId: string,
): Promise<boolean> {
	if (context.role === "PRODUCT_MANAGER") {
		return true;
	}

	const membership = await prisma.projectMember.findUnique({
		where: {
			projectId_userId: {
				projectId,
				userId: context.userId,
			},
		},
		select: {
			id: true,
		},
	});

	return Boolean(membership);
}

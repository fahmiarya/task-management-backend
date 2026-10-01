import { prisma } from "@/lib/prisma";
import type {
	DepartmentName,
	UserRole,
} from "../../prisma/generated/prisma-client";

export type AuthContext = {
	userId: string;
	role: UserRole;
	department: DepartmentName | null;
};

export async function getAuthContext(
	userId: string,
): Promise<AuthContext | null> {
	const user = await prisma.user.findUnique({
		where: {
			id: userId,
			deletedAt: null,
		},
		select: {
			id: true,
			role: true,
			department: {
				select: {
					name: true,
				},
			},
		},
	});

	if (!user) {
		return null;
	}

	return {
		userId: user.id,
		role: user.role,
		department: user.department?.name as DepartmentName | null,
	};
}

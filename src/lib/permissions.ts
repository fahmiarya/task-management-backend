import type {
	DepartmentName,
	UserRole,
} from "../../prisma/generated/prisma-client";

export type Permission =
	| "project:create"
	| "project:read"
	| "project:update"
	| "project:delete"
	| "project:manage-members"
	| "task:create"
	| "task:read"
	| "task:update"
	| "task:delete"
	| "task:change-status"
	| "task:manage-dependencies";

type PermissionContext = {
	role: UserRole;
	department: DepartmentName | null;
};

export function hasPermission(
	context: PermissionContext,
	permission: Permission,
): boolean {
	if (context.role === "PRODUCT_MANAGER") {
		return true;
	}

	if (context.role === "CLIENT_GUEST") {
		return permission === "project:read" || permission === "task:read";
	}

	if (context.role === "INTERNAL") {
		if (!context.department) {
			return false;
		}

		return [
			"project:read",
			"task:read",
			"task:update",
			"task:change-status",
		].includes(permission);
	}

	return false;
}

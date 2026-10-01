import type { Prisma } from "../../prisma/generated/prisma-client";

const allowedTaskFields = [
	"title",
	"status",
	"assigneeId",
	"clientVisible",
	"projectId",
] as const;

type AllowedTaskField = (typeof allowedTaskFields)[number];

function isAllowedField(value: string): value is AllowedTaskField {
	return allowedTaskFields.includes(value as AllowedTaskField);
}

function parseJsonParam<T>(value: string | undefined, fallback: T): T {
	if (!value) return fallback;

	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

export function buildTaskQuery(searchParams: URLSearchParams): {
	where: Prisma.TaskWhereInput;
	orderBy: Prisma.TaskOrderByWithRelationInput;
	skip: number;
	take: number;
} {
	const filters = parseJsonParam<Record<string, unknown>>(
		searchParams.get("filters") ?? undefined,
		{},
	);

	const searchFilters = parseJsonParam<Record<string, unknown>>(
		searchParams.get("searchFilters") ?? undefined,
		{},
	);

	const rangedFilters = parseJsonParam<
		Array<{
			key: string;
			start?: number | string;
			end?: number | string;
		}>
	>(searchParams.get("rangedFilters") ?? undefined, []);

	const page = Math.max(
		1,
		Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
	);

	const rows = Math.min(
		100,
		Math.max(1, Number.parseInt(searchParams.get("rows") ?? "20", 10) || 20),
	);

	const where: Prisma.TaskWhereInput = {
		deletedAt: null,
	};

	// Exact filters
	// Exact filters
	for (const [key, value] of Object.entries(filters)) {
		if (!isAllowedField(key)) continue;

		if (key === "status" && typeof value === "string") {
			where.status = value as "TODO" | "IN_PROGRESS" | "DONE";
			continue;
		}

		if (key === "clientVisible" && typeof value === "boolean") {
			where.clientVisible = value;
			continue;
		}

		if (key === "projectId" && typeof value === "string") {
			where.projectId = value;
			continue;
		}

		if (key === "assigneeId") {
			if (typeof value === "string") {
				where.assigneeId = value;
			} else if (Array.isArray(value)) {
				where.assigneeId = {
					in: value.filter((item): item is string => typeof item === "string"),
				};
			}
			continue;
		}

		if (key === "title" && typeof value === "string") {
			where.title = value;
		}
	}

	// Partial / contains search
	for (const [key, value] of Object.entries(searchFilters)) {
		if (!isAllowedField(key)) continue;

		if (typeof value === "string" && value.length > 0) {
			where[key] = {
				contains: value,
				mode: "insensitive",
			};
		}
	}

	// Ranged filters
	for (const range of rangedFilters) {
		if (!isAllowedField(range.key)) continue;

		const condition: Record<string, unknown> = {};

		if (range.start !== undefined) {
			condition.gte = range.start;
		}

		if (range.end !== undefined) {
			condition.lte = range.end;
		}

		where[range.key] = condition;
	}

	const requestedOrderKey = searchParams.get("orderKey") ?? "createdAt";

	const allowedOrderKeys = [
		"title",
		"status",
		"createdAt",
		"updatedAt",
		"version",
	];

	const orderKey = allowedOrderKeys.includes(requestedOrderKey)
		? requestedOrderKey
		: "createdAt";

	const orderRule = searchParams.get("orderRule") === "asc" ? "asc" : "desc";

	return {
		where,
		orderBy: {
			[orderKey]: orderRule,
		},
		skip: (page - 1) * rows,
		take: rows,
	};
}

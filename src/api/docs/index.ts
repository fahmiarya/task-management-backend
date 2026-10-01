import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import type { AuthType } from "@/lib/jwt";
import { systemLogger } from "@/services/logger";

const docsRouter = new Hono<{ Variables: AuthType }>();

docsRouter.get(
	"/",
	Scalar({
		sources: [
			{
				url: "/api/v1/docs/openapi.json",
				title: "Task Management API",
			},
		],
		theme: "default",
		pageTitle: "Task Management API Documentation",
	}),
);

docsRouter.get("/openapi.json", async (c) => {
	try {
		const specPath = join(process.cwd(), "src", "api", "docs", "openapi.json");

		const spec = JSON.parse(readFileSync(specPath, "utf-8"));

		return c.json(spec, 200, {
			"Content-Type": "application/json; charset=utf-8",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
			"Access-Control-Allow-Headers": "Content-Type, Authorization",
		});
	} catch (error) {
		systemLogger.error(
			{
				error,
				path: "/docs/openapi.json",
			},
			"Failed to serve OpenAPI specification",
		);

		return c.json(
			{
				success: false,
				message: "Failed to load OpenAPI specification",
			},
			500,
		);
	}
});

export type AppType = typeof docsRouter;

export default docsRouter;

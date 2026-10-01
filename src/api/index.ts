import { Hono } from "hono";
import authRouter from "@/api/auth/auth";
import meRouter from "@/api/auth/me";
import clientRouter from "@/api/client/client";
import docsRouter from "@/api/docs";
import projectRouter from "@/api/projects/projects";
import systemRouter from "@/api/system";
import taskRouter from "@/api/tasks/tasks";
import type { AuthType } from "@/lib/jwt";

const apiRouter = new Hono<{ Variables: AuthType }>({
	strict: false,
});

apiRouter.route("/", systemRouter);
apiRouter.route("/auth", authRouter);
apiRouter.route("/docs", docsRouter);
apiRouter.route("/me", meRouter);
apiRouter.route("/projects", projectRouter);
apiRouter.route("/tasks", taskRouter);
apiRouter.route("/client", clientRouter);

export default apiRouter;

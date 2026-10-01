import { Hono } from "hono";
import authRouter from "@/api/auth/auth";
import meRouter from "@/api/auth/me";
import docsRouter from "@/api/docs";
import systemRouter from "@/api/system";
import type { AuthType } from "@/lib/jwt";

const apiRouter = new Hono<{ Variables: AuthType }>({
	strict: false,
});

apiRouter.route("/", systemRouter);
apiRouter.route("/auth", authRouter);
apiRouter.route("/docs", docsRouter);
apiRouter.route("/me", meRouter);

export default apiRouter;

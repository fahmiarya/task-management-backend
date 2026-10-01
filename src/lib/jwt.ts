import jwt from "jsonwebtoken";
import { config } from "../config/environment";

export type AccessTokenPayload = {
	sub: string;
	role: string;
};

export type AuthType = {
	userId: string;
	userRole: string;
};

export function signAccessToken(payload: AccessTokenPayload): string {
	return jwt.sign(payload, config.JWT_SECRET, {
		expiresIn: config.JWT_EXPIRES_IN,
	});
}

export function verifyAccessToken(token: string): AccessTokenPayload {
	const decoded = jwt.verify(token, config.JWT_SECRET);

	if (typeof decoded === "string") {
		throw new Error("Invalid JWT payload");
	}

	return decoded as AccessTokenPayload;
}

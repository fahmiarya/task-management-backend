import { signAccessToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";

type RegisterInput = {
	name: string;
	email: string;
	password: string;
};

type LoginInput = {
	email: string;
	password: string;
};

export async function registerUser(input: RegisterInput) {
	const existingUser = await prisma.user.findUnique({
		where: {
			email: input.email,
		},
	});

	if (existingUser) {
		throw new Error("Email is already registered");
	}

	const passwordHash = await Bun.password.hash(input.password);

	const user = await prisma.user.create({
		data: {
			name: input.name,
			email: input.email,
			passwordHash,
			role: "INTERNAL",
		},
	});

	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};
}

export async function loginUser(input: LoginInput) {
	const user = await prisma.user.findUnique({
		where: {
			email: input.email,
		},
	});

	if (!user) {
		throw new Error("Invalid email or password");
	}

	const validPassword = await Bun.password.verify(
		input.password,
		user.passwordHash,
	);

	if (!validPassword) {
		throw new Error("Invalid email or password");
	}

	const accessToken = signAccessToken({
		sub: user.id,
		role: user.role,
	});

	return {
		accessToken,
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			departmentId: user.departmentId,
		},
	};
}

import { PrismaClient } from "./generated/prisma-client";

const prisma = new PrismaClient();

async function main() {
	const passwordHash = await Bun.password.hash("Password123!");

	const uiUx = await prisma.department.upsert({
		where: {
			name: "UI_UX",
		},
		update: {},
		create: {
			name: "UI_UX",
		},
	});

	const frontend = await prisma.department.upsert({
		where: {
			name: "FRONTEND",
		},
		update: {},
		create: {
			name: "FRONTEND",
		},
	});

	const backend = await prisma.department.upsert({
		where: {
			name: "BACKEND",
		},
		update: {},
		create: {
			name: "BACKEND",
		},
	});

	await prisma.user.upsert({
		where: {
			email: "pm@example.com",
		},
		update: {},
		create: {
			name: "Product Manager",
			email: "pm@example.com",
			passwordHash,
			role: "PRODUCT_MANAGER",
		},
	});

	await prisma.user.upsert({
		where: {
			email: "uiux@example.com",
		},
		update: {},
		create: {
			name: "UI/UX Engineer",
			email: "uiux@example.com",
			passwordHash,
			role: "INTERNAL",
			departmentId: uiUx.id,
		},
	});

	await prisma.user.upsert({
		where: {
			email: "frontend@example.com",
		},
		update: {},
		create: {
			name: "Frontend Engineer",
			email: "frontend@example.com",
			passwordHash,
			role: "INTERNAL",
			departmentId: frontend.id,
		},
	});

	await prisma.user.upsert({
		where: {
			email: "backend@example.com",
		},
		update: {},
		create: {
			name: "Backend Engineer",
			email: "backend@example.com",
			passwordHash,
			role: "INTERNAL",
			departmentId: backend.id,
		},
	});

	await prisma.user.upsert({
		where: {
			email: "client@example.com",
		},
		update: {},
		create: {
			name: "Client Guest",
			email: "client@example.com",
			passwordHash,
			role: "CLIENT_GUEST",
		},
	});

	console.log("Seed completed successfully.");
}

main()
	.catch((error) => {
		console.error(error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});

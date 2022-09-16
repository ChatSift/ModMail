import { parentPort } from "node:worker_threads";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
await prisma.block.deleteMany({ where: { expiresAt: { lt: new Date() } } });

parentPort?.postMessage("done");

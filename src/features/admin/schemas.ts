import { z } from "zod";
export const branchSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().min(2).max(500),
  phone: z.string().trim().min(2).max(40),
  email: z.union([z.literal(""), z.email()]),
  openingHours: z.string().trim().max(300),
});
export const employeeSchema = z.object({
  email: z.email(),
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40),
  roleId: z.uuid(),
  branchIds: z.array(z.uuid()).max(20),
});
export const accessSchema = z.object({
  userId: z.uuid(),
  roleId: z.uuid(),
  branchIds: z.array(z.uuid()).max(20),
  isActive: z.boolean(),
});

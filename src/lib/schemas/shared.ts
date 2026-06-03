import { z } from "zod";

export const cuidSchema = z.string().cuid({ message: "ID inválido" });
export const emailSchema = z.string().email("Email inválido").toLowerCase().trim();
export const dateSchema = z.coerce.date({ message: "Data inválida" });
export const amountCentsSchema = z.coerce.bigint({ message: "Valor inválido" });

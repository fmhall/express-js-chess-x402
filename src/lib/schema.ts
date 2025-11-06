import * as z from "zod";
import type { HTTPRequestStructure } from "x402/types";
import e from "express";

export function inputSchemaToX402GET(
  inputSchema: z.ZodObject<z.ZodRawShape>,
): Record<string, any> {
  const jsonSchema = z.toJSONSchema(inputSchema, { target: "openapi-3.0" });

  // Convert JSON Schema properties to Record<string, string> for x402
  // x402 expects simple string descriptions, not full JSON schema objects
  const queryParams: Record<string, any> = {};

  if (jsonSchema.properties) {
    for (const [key, value] of Object.entries(jsonSchema.properties)) {
      if (typeof value === "object" && value !== null) {
        queryParams[key] = value;
        if (!("default" in value && value.default !== undefined)) {
          queryParams[key].required = true;
        } else {
          queryParams[key].required = false;
        }
      }
    }
  }

  return {
    type: "http" as const,
    method: "GET" as const,
    queryParams,
  };
}

export function inputSchemaToX402POST(
  inputSchema: z.ZodObject<z.ZodRawShape>,
): HTTPRequestStructure {
  const jsonSchema = z.toJSONSchema(inputSchema, { target: "openapi-3.0" });

  return {
    type: "http" as const,
    method: "POST" as const,
    bodyType: "json" as const,
    bodyFields: jsonSchema,
  };
}

export function zodToJsonSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema);
}

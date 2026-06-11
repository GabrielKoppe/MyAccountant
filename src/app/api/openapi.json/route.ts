import { generateOpenApiSpec } from "@/server/api/openapi-registry";

// Importar todos os route handlers que registram paths no registry
import "@/app/api/v1/accounts/[accountId]/notifications/route";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(generateOpenApiSpec());
}

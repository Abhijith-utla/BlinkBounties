import { ACTIONS_CORS_HEADERS, type ActionsJson } from "@solana/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload: ActionsJson = {
    rules: [
      {
        pathPattern: "/raffle/*",
        apiPath: "/api/actions/raffle/*",
      },
    ],
  };

  return Response.json(payload, {
    headers: ACTIONS_CORS_HEADERS,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: ACTIONS_CORS_HEADERS,
  });
}

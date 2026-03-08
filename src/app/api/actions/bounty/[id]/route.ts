import {
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  type ActionGetResponse,
  type ActionPostRequest,
} from "@solana/actions";
import { PublicKey } from "@solana/web3.js";

import {
  APP_URL,
  buildSubmitWorkTransaction,
  fetchBountyByAddress,
} from "@/lib/solana";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

function jsonError(message: string, status = 400) {
  return Response.json(
    {
      message,
    },
    {
      status,
      headers: ACTIONS_CORS_HEADERS,
    },
  );
}

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;

  let bountyPubkey: PublicKey;
  try {
    bountyPubkey = new PublicKey(id);
  } catch {
    return jsonError("Invalid bounty id.", 404);
  }

  const bounty = await fetchBountyByAddress(bountyPubkey);
  if (!bounty) {
    return jsonError("Bounty not found.", 404);
  }

  const url = new URL(req.url);
  const submitHref = `${APP_URL}/api/actions/bounty/${id}?workUrl={workUrl}`;

  const payload: ActionGetResponse = {
    type: "action",
    icon: `${APP_URL}/next.svg`,
    title: `Bounty: ${bounty.amountSol.toFixed(3)} SOL`,
    description: bounty.description,
    label: bounty.status === "open" ? "Submit Work" : "View Bounty",
    disabled: bounty.status !== "open",
    links: {
      actions: [
        {
          type: "transaction",
          href: submitHref,
          label: "Submit Proof of Work",
          parameters: [
            {
              type: "url",
              name: "workUrl",
              label: "PR or proof link",
              required: true,
            },
          ],
        },
      ],
    },
  };

  if (url.searchParams.get("preview") === "true") {
    payload.description = `${payload.description}\n\nStatus: ${bounty.status.toUpperCase()}`;
  }

  return Response.json(payload, {
    headers: ACTIONS_CORS_HEADERS,
  });
}

export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;

  let bountyPubkey: PublicKey;
  try {
    bountyPubkey = new PublicKey(id);
  } catch {
    return jsonError("Invalid bounty id.", 404);
  }

  const bounty = await fetchBountyByAddress(bountyPubkey);
  if (!bounty) {
    return jsonError("Bounty not found.", 404);
  }

  if (bounty.status !== "open") {
    return jsonError("Bounty is not open for submissions.", 409);
  }

  const requestUrl = new URL(req.url);
  const fallbackWorkUrl = requestUrl.searchParams.get("workUrl")?.trim() ?? "";

  let body: ActionPostRequest;
  try {
    body = (await req.json()) as ActionPostRequest;
  } catch {
    return jsonError("Invalid POST body.");
  }

  let user: PublicKey;
  try {
    user = new PublicKey(body.account);
  } catch {
    return jsonError("Invalid wallet account.");
  }

  const data = body.data as Record<string, string | string[]> | undefined;
  const workUrlCandidate = data?.workUrl;
  const workUrlFromBody =
    typeof workUrlCandidate === "string" ? workUrlCandidate.trim() : "";
  const workUrl = workUrlFromBody || fallbackWorkUrl;

  if (!workUrl || !/^https?:\/\//i.test(workUrl)) {
    return jsonError("workUrl is required and must be an http(s) URL.");
  }

  const tx = await buildSubmitWorkTransaction({
    user,
    bounty: bountyPubkey,
    workUrl,
  });

  const payload = await createPostResponse({
    fields: {
      type: "transaction",
      transaction: tx,
      message: "Submit work for this bounty",
    },
  });

  return Response.json(payload, {
    headers: ACTIONS_CORS_HEADERS,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: ACTIONS_CORS_HEADERS,
  });
}

import { NextResponse } from "next/server";
import { ApiError, apiFailure, authorizedTestUser, factorId, oktaJson, safeTransaction } from "../../../../../../../../lib/okta";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { factorId: string; transactionId: string } }) {
  try {
    const { id } = await authorizedTestUser();
    if (!/^[a-zA-Z0-9_-]{5,150}$/.test(params.transactionId)) throw new ApiError(400, "Transaction ID ไม่ถูกต้อง");
    const result = await oktaJson(`/api/v1/users/${id}/factors/${factorId(params.factorId)}/transactions/${params.transactionId}`);
    return NextResponse.json(safeTransaction(result, params.factorId, id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}

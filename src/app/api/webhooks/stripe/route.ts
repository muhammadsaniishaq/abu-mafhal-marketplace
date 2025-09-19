import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest){
// 1) Verify signature
// 2) On checkout.session.completed -> mark order paid
return NextResponse.json({received:true});
}
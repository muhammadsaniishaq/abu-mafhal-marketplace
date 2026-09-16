// Ambient TypeScript declarations for Supabase Deno Edge Functions in Antigravity/VS Code

declare const Deno: {
    serve: (handler: (req: Request) => Promise<Response> | Response) => void;
    env: {
        get: (key: string) => string | undefined;
        set: (key: string, value: string) => void;
        delete: (key: string) => void;
        toObject: () => Record<string, string>;
    };
    [key: string]: any;
};

declare module "https://*" {
    const content: any;
    export default content;
    export const createClient: any;
}

declare module "jsr:*" {
    const content: any;
    export default content;
    export const createClient: any;
}

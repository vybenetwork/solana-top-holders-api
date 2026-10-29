import type { NextFunction, Request, Response } from 'express';
/** The root text key, or null when ROOT_TEXT_KEY is empty. */
export declare function rootTextKey(): string | null;
/** Serve /{ROOT_TEXT_KEY}.txt when the env value is set. Otherwise this route is absent. */
export declare function serveRootKeyFile(): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=root-key-file.d.ts.map
import type { NextFunction, Request, Response } from 'express';
export declare function googleMeasurementId(): string | null;
/** Empty unless GA_MEASUREMENT_ID is a complete measurement ID. */
export declare function googleTagSnippet(): string;
export declare function injectGoogleTag(html: string): string;
/** Serve / and /index.html with the Google tag inserted only when the env ID is complete. */
export declare function serveIndexWithGoogleTag(publicDir: string): (req: Request, res: Response, next: NextFunction) => void;
export declare function sendIndexHtml(publicDir: string, res: Response, next: NextFunction): void;
//# sourceMappingURL=google-tag.d.ts.map
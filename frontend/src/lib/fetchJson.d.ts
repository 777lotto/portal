export declare class ApiError extends Error {
    status: number;
    details?: any | undefined;
    constructor(message: string, status: number, details?: any | undefined);
}
export declare function fetchJson<T = unknown>(input: string, init?: RequestInit): Promise<T>;

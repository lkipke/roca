import type { Context } from "@jest/reporters";
import type { ProjectConfig } from "@jest/types/build/Config";

export interface Diag {
    [key: string]: unknown;
    stack: string[];
    message: string;
    expected?: string;
    actual?: string;
    funcname?: string;
}

export interface Assert {
    ok: boolean;
    id: number;
    name: string;
    fullname: string;
    todo?: string | boolean;
    skip?: string | boolean;
    diag?: Diag;
}

/**
 * This generates a Jest Context-like object.
 * @param config The Jest Project config
 */
export function createContext(config: ProjectConfig): Context {
    // Coerce the type because Jest expects some internal stuff that we have no need for,
    // and is difficult to generate.
    return { config } as Context;
}

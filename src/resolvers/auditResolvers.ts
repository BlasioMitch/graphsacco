import { requireRole } from "../utils/auth.js";

// The audit trail is for ADMIN users only (managers' own actions are in it)
const ADMIN_ONLY = ['ADMIN'] as const;

export default {
    Query: {
        auditLogs: async (_: any, { filter, limit, offset }: { filter?: Record<string, unknown> | null, limit?: number | null, offset?: number | null }, context: any) => {
            requireRole(context.token, ADMIN_ONLY);
            return context.restAPI.getAuditLogs({ ...(filter ?? {}), limit, offset });
        },
        auditFacets: async (_: any, __: any, context: any) => {
            requireRole(context.token, ADMIN_ONLY);
            return context.restAPI.getAuditFacets();
        },
    },
};

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    priceId: null,
    limits: {
      maxProjects: 3,
      maxUnitsPerFlowsheet: 8,
      maxScenariosPerProject: 1,
      maxSimRunsPerDay: 20,
      pdfReports: false,
      teamSharing: false,
      apiAccess: false,
    },
  },
  pro: {
    name: 'Pro',
    price: 49,
    priceId: null as string | null, // set via env at runtime
    limits: {
      maxProjects: Infinity,
      maxUnitsPerFlowsheet: 50,
      maxScenariosPerProject: 10,
      maxSimRunsPerDay: Infinity,
      pdfReports: true,
      teamSharing: false,
      apiAccess: false,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 199,
    priceId: null as string | null,
    limits: {
      maxProjects: Infinity,
      maxUnitsPerFlowsheet: Infinity,
      maxScenariosPerProject: Infinity,
      maxSimRunsPerDay: Infinity,
      pdfReports: true,
      teamSharing: true,
      apiAccess: true,
    },
  },
} as const;

export type PlanTier = keyof typeof PLANS;

export function getPlanLimits(tier: string) {
  return PLANS[tier as PlanTier]?.limits ?? PLANS.free.limits;
}

/**
 * COORDINATE SYSTEM — one convention, declared once per {@link DesignPackage}.
 *
 *  - Right-handed, Z-up. PLAN view is the X–Y plane (north-up site layout).
 *  - +X = site East (grid East). +Y = site North. +Z = elevation UP.
 *  - ORIGIN (0,0,0) = the site survey benchmark / setting-out point
 *    (south-west corner of the site boundary by default).
 *  - All linear values in METRES. All angles in DEGREES, CCW positive in plan
 *    (a 0° object faces +X / East; 90° faces +Y / North).
 *  - z is the FINISHED-GROUND-LEVEL footprint elevation of the object's base,
 *    NOT top-of-water. invertLevel / topWaterLevel live in object params.
 *
 * Authoritative shape: "AquaSim v3 — MVP Architecture" §3. The geo-reference
 * (`origin`) lets a downstream CAD/BIM/3D consumer place the plant on a real
 * site without any re-derivation.
 */
export interface CoordinateSystem {
  convention: 'right-handed-z-up';
  linearUnit: 'm';
  angleUnit: 'deg';
  origin: {
    /** e.g. "SW site boundary peg, survey BM-01". */
    description: string;
    /** Coordinate reference system, e.g. "EPSG:2049" (Hartebeesthoek94 Lo29, SA). */
    crs?: string;
    /** Optional real-world tie-in of the origin. */
    eastingM?: number;
    northingM?: number;
    /** Datum elevation of the origin, metres above mean sea level. */
    groundLevelMamsl?: number;
  };
}

/**
 * Build the default site-local coordinate system. Convention/units are fixed;
 * only the origin description and optional geo-reference vary. Deterministic:
 * same arguments always yield the same object (no clocks, no randomness).
 */
export function siteLocalCoordinateSystem(
  origin: CoordinateSystem['origin'] = { description: 'SW site setting-out peg' },
): CoordinateSystem {
  return {
    convention: 'right-handed-z-up',
    linearUnit: 'm',
    angleUnit: 'deg',
    origin,
  };
}

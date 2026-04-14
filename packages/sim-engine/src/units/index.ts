export { Influent, influentDefinition } from './influent';
export { PrimaryClarifier, primaryClarifierDefinition } from './primary-clarifier';
export { BioreactorAerobic, bioreactorAerobicDefinition } from './bioreactor-aerobic';
export { BioreactorAnoxic, bioreactorAnoxicDefinition } from './bioreactor-anoxic';
export { BioreactorAnaerobic, bioreactorAnaerobicDefinition } from './bioreactor-anaerobic';
export { SecondaryClarifier, secondaryClarifierDefinition } from './secondary-clarifier';
export { Splitter, splitterDefinition } from './splitter';
export { Mixer, mixerDefinition } from './mixer';
export { Thickener, thickenerDefinition } from './thickener';
export { Effluent, effluentDefinition, checkCompliance } from './effluent';
export { Screen, screenDefinition } from './screen';
export { GritRemoval, gritRemovalDefinition } from './grit-removal';
export { EqualisationTank, equalisationTankDefinition } from './equalisation-tank';
export { MBR, mbrDefinition } from './mbr';
export { AerationBlower, aerationBlowerDefinition } from './aeration-blower';
export { Dewatering, dewateringDefinition } from './dewatering';
export { ChemicalDosing, chemicalDosingDefinition } from './chemical-dosing';
export { UvDisinfection, uvDisinfectionDefinition } from './uv-disinfection';
export { InletPumping, inletPumpingDefinition } from './inlet-pumping';

import type { ProcessUnit, UnitType, UnitDefinition } from '../types';
import { Influent, influentDefinition } from './influent';
import { PrimaryClarifier, primaryClarifierDefinition } from './primary-clarifier';
import { BioreactorAerobic, bioreactorAerobicDefinition } from './bioreactor-aerobic';
import { BioreactorAnoxic, bioreactorAnoxicDefinition } from './bioreactor-anoxic';
import { BioreactorAnaerobic, bioreactorAnaerobicDefinition } from './bioreactor-anaerobic';
import { SecondaryClarifier, secondaryClarifierDefinition } from './secondary-clarifier';
import { Splitter, splitterDefinition } from './splitter';
import { Mixer, mixerDefinition } from './mixer';
import { Thickener, thickenerDefinition } from './thickener';
import { Effluent, effluentDefinition } from './effluent';
import { Screen, screenDefinition } from './screen';
import { GritRemoval, gritRemovalDefinition } from './grit-removal';
import { EqualisationTank, equalisationTankDefinition } from './equalisation-tank';
import { MBR, mbrDefinition } from './mbr';
import { AerationBlower, aerationBlowerDefinition } from './aeration-blower';
import { Dewatering, dewateringDefinition } from './dewatering';
import { ChemicalDosing, chemicalDosingDefinition } from './chemical-dosing';
import { UvDisinfection, uvDisinfectionDefinition } from './uv-disinfection';
import { InletPumping, inletPumpingDefinition } from './inlet-pumping';

/** Registry of all unit definitions */
export const unitDefinitions: Record<UnitType, UnitDefinition> = {
  influent: influentDefinition,
  primary_clarifier: primaryClarifierDefinition,
  bioreactor_aerobic: bioreactorAerobicDefinition,
  bioreactor_anoxic: bioreactorAnoxicDefinition,
  bioreactor_anaerobic: bioreactorAnaerobicDefinition,
  secondary_clarifier: secondaryClarifierDefinition,
  splitter: splitterDefinition,
  mixer: mixerDefinition,
  thickener: thickenerDefinition,
  effluent: effluentDefinition,
  // Phase 2
  screen: screenDefinition,
  grit_removal: gritRemovalDefinition,
  equalisation_tank: equalisationTankDefinition,
  mbr: mbrDefinition,
  aeration_blower: aerationBlowerDefinition,
  dewatering: dewateringDefinition,
  chemical_dosing: chemicalDosingDefinition,
  uv_disinfection: uvDisinfectionDefinition,
  inlet_pumping: inletPumpingDefinition,
};

/** Create a ProcessUnit instance from type and parameters */
export function createUnit(type: UnitType, parameters: Record<string, number>): ProcessUnit {
  switch (type) {
    case 'influent': return new Influent(parameters);
    case 'primary_clarifier': return new PrimaryClarifier(parameters);
    case 'bioreactor_aerobic': return new BioreactorAerobic(parameters);
    case 'bioreactor_anoxic': return new BioreactorAnoxic(parameters);
    case 'bioreactor_anaerobic': return new BioreactorAnaerobic(parameters);
    case 'secondary_clarifier': return new SecondaryClarifier(parameters);
    case 'splitter': return new Splitter(parameters);
    case 'mixer': return new Mixer(parameters);
    case 'thickener': return new Thickener(parameters);
    case 'effluent': return new Effluent(parameters);
    case 'screen': return new Screen(parameters);
    case 'grit_removal': return new GritRemoval(parameters);
    case 'equalisation_tank': return new EqualisationTank(parameters);
    case 'mbr': return new MBR(parameters);
    case 'aeration_blower': return new AerationBlower(parameters);
    case 'dewatering': return new Dewatering(parameters);
    case 'chemical_dosing': return new ChemicalDosing(parameters);
    case 'uv_disinfection': return new UvDisinfection(parameters);
    case 'inlet_pumping': return new InletPumping(parameters);
  }
}

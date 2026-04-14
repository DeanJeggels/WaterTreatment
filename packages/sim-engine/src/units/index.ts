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
  // Phase 2 stubs — to be replaced with real definitions
  aeration_blower: { type: 'aeration_blower', label: 'Aeration blower (stub)', description: 'stub', icon: 'fan', handles: [], defaultParameters: {}, parameterSchema: [] },
  dewatering: { type: 'dewatering', label: 'Dewatering (stub)', description: 'stub', icon: 'droplet', handles: [], defaultParameters: {}, parameterSchema: [] },
  chemical_dosing: { type: 'chemical_dosing', label: 'Chemical dosing (stub)', description: 'stub', icon: 'beaker', handles: [], defaultParameters: {}, parameterSchema: [] },
  uv_disinfection: { type: 'uv_disinfection', label: 'UV (stub)', description: 'stub', icon: 'sun', handles: [], defaultParameters: {}, parameterSchema: [] },
  inlet_pumping: { type: 'inlet_pumping', label: 'Inlet pump (stub)', description: 'stub', icon: 'arrow-up', handles: [], defaultParameters: {}, parameterSchema: [] },
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
    case 'aeration_blower':
    case 'dewatering':
    case 'chemical_dosing':
    case 'uv_disinfection':
    case 'inlet_pumping':
      throw new Error(`Unit type "${type}" not yet implemented (Phase 2 in progress)`);
  }
}

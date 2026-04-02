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
  }
}

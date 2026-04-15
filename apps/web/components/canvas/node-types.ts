import type { NodeTypes } from '@xyflow/react';
import ProcessUnitNode from './custom-nodes/ProcessUnitNode';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: NodeTypes = {
  processUnit: ProcessUnitNode as any,
};

import { layeredLayout } from './dist/graph/layered.js';

const nodes = [
  { id: 'Customer', width: 120, height: 150 },
  { id: 'Order', width: 120, height: 120 },
];
const edges = [
  { from: 'Customer', to: 'Order' },
];

const result = layeredLayout(nodes, edges, { direction: 'TB', nodeGap: 40, layerGap: 70, margin: 32 });
console.log('Customer box:', result.boxes.get('Customer'));
console.log('Order box:', result.boxes.get('Order'));
console.log('edgeBends:', result.edgeBends);

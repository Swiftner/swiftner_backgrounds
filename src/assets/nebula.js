import { createMesh } from '../renderers/mesh.js';
import data from '../data/mesh1.js';
export default { bg: data.bg, render: createMesh(data) };

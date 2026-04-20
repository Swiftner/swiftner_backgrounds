import { createMesh } from '../renderers/mesh.js';
import data from '../data/mesh2.js';
export default { bg: data.bg, render: createMesh(data) };

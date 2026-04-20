import { createBlob } from '../renderers/blob.js';
import data from '../data/blob1.js';
export default { bg: data.bg, render: createBlob(data) };

import { createWave } from '../renderers/wave.js';
import data from '../data/wave3.js';
export default { bg: data.bg, render: createWave(data) };

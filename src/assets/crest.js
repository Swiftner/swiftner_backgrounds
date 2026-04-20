import { createWave } from '../renderers/wave.js';
import data from '../data/wave2.js';
export default { bg: data.bg, render: createWave(data) };

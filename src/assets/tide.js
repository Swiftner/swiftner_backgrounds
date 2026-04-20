import { createWave } from '../renderers/wave.js';
import data from '../data/wave1.js';
export default { bg: data.bg, render: createWave(data) };

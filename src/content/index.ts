import type { GameContent } from '../core/types';
import { config } from './config';
import { difficulties } from './difficulties';
import { events } from './events';
import { features } from './features';
import { productTypes } from './productTypes';

export const content: GameContent = { config, difficulties, productTypes, features, events };

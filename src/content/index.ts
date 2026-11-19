import type { GameContent } from '../core/types';
import { config } from './config';
import { difficulties } from './difficulties';
import { events } from './events';
import { features } from './features';
import { milestones } from './milestones';
import { productTypes } from './productTypes';
import { themes } from './themes';

export const content: GameContent = { config, difficulties, productTypes, features, events, milestones, themes };

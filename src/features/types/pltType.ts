import {SORTING_ACTIONS} from '@/utils/constants';
import {hex2rgb, randRgbGen, rgb2hex} from '../../utils/colors.ts';

/**
 * The current order of cards.
 */
export type orderStateType = 'gray' | 'random';

export type SortActionType = typeof SORTING_ACTIONS[number];

export type cardType = {
  /**
   * RGB sapce value, [red, green, blue].
   */
  rgb: number[];
  /**
   * RGB sapce value in hex code.
   */
  hex: string;
  /**
   * The card is lock (can't refresh the card).
   */
  isLock: boolean;
  /**
   * The card is in bookmarks.
   */
  isFav: boolean;
  /**
   * The card is in editing mode.
   */
  isEditing: boolean;
};

/**
 * Create a new state object.
 * @return {cardType} State object.
 */
export const newCard = (hex?: string): cardType => {
  if (!hex) {
    const rgb = randRgbGen();
    return {
      rgb,
      hex: rgb2hex(rgb),
      isLock: false,
      isFav: false,
      isEditing: false,
    };
  } else {
    return {
      rgb: hex2rgb(hex) as number[],
      hex,
      isLock: false,
      isFav: false,
      isEditing: false,
    };
  }
};

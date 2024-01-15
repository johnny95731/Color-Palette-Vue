import {defineStore} from 'pinia';
import {get, update, set} from 'idb-keyval';

import {favoritesDb, FAV_COLORS, FAV_PLTS} from '../../utils/database.ts';

type state = {
  /**
   * Favorite colors.
   */
  colors: string[];
  /**
   * Favorite palettes(plts).
   */
  plts: string[];
  /**
   * Whether the colors/plts is loaded.
   */
  isInitialized: [boolean, boolean];
}

const initialState: state = {
  colors: [],
  plts: [],
  isInitialized: [false, false],
};

const useFavStore = defineStore('favorites', {
  state: (): state => initialState,
  actions: {
    async initializeColors() {
      const colors = await get<string[]>(FAV_COLORS, favoritesDb);
      if (!colors) { // First time enter this site.
        set(FAV_PLTS, [], favoritesDb);
      } else {
        this.colors = colors;
      }
      this.isInitialized[0] = true;
    },
    async initializePlts() {
      const plts = await get<string[]>(FAV_PLTS, favoritesDb);
      if (!plts) { // First time enter this site.
        set(FAV_PLTS, [], favoritesDb);
      } else {
        this.plts = plts;
      }
      this.isInitialized[1] = true;
    },
    favColorsChanged(targetHex: string) {
      const isIncluding = this.colors.includes(targetHex);
      // Update database
      update<string[]>(FAV_COLORS, (prev) => {
        if (!prev) return [];
        let newFav: string[];
        if (isIncluding) { // Favoriting => Non-Favoriting
          newFav = prev.filter((hex) => hex != targetHex);
        } else { // Non-Favoriting => Favoriting
          newFav = [...prev];
          newFav.push(targetHex);
        }
        return newFav;
      }, favoritesDb)
          .catch((e) => console.error(e));
      // Update state
      if (isIncluding) { // Favoriting => Non-Favoriting
        this.colors = this.colors.filter((hex) => hex != targetHex);
      } else { // Non-Favoriting => Favoriting
        this.colors.push(targetHex);
      }
    },
    favPltsChanged(targetPlt: string) {
      // Update database
      update<string[]>(FAV_PLTS, (prev) => {
        if (!prev) return [];
        let newFav: string[];
        if (prev.includes(targetPlt)) { // Favoriting => Non-Favoriting
          newFav = prev.filter((plt) => plt != targetPlt);
        } else { // Non-Favoriting => Favoriting
          newFav = [...prev];
          newFav.push(targetPlt);
        }
        return newFav;
      }, favoritesDb)
          .catch((e) => console.error(e));
      // Update state
      if (this.plts.includes(targetPlt)) { // Favoriting => Non-Favoriting
        this.plts = this.plts.filter((plt) => plt != targetPlt);
      } else { // Non-Favoriting => Favoriting
        this.plts.push(targetPlt);
      }
    },
  },
});

export default useFavStore;


export type Blender = (c1: number[], c2: number[]) => number[];

/**
 * Infomations about color space.
 */
export type ColorSpaceInfos = {
  /**
   * Name of channels
   */
  labels: string[];
  /**
   * Range of each channels.
   * If type of `range` is [number, number], it means [min, max].
   * If type of `range` is number, it means the maximum, [0, range].
   */
  range: (number | [number, number])[];
};

/**
 * Functions for transform color space from RGB to specific space.
 */
export type ColorSpaceTrans = {
  /**
   * The converter that convert RGB space to specified color space.
   * @param x RGB values.
   * @returns specified color space values.
   */
  converter: (x: number[]) => number[];
  /**
   * The converter that convert specified color space to RGB space.
   * @param x specified color space values.
   * @returns RGB values.
   */
  inverter: (x: number[]) => number[];
};

export type VueClass = string | Record<string, boolean> | (string | Record<string, boolean>)[];

<template>
  <main id="main">
    <TheCard
      v-for="(card, i) in pltState.cards"
      :key="`card${i}`"
      :ref="(el) => cardRefs[i] = (el as cardInstance)"
      :cardIdx="i"
      :card="card"
      :cardDisplay="{
        size: cardAttrs.size.percent,
        position: cardAttrs.positions[i]
      }"
      :styleInSettings="styleInSettings"
      @transitionend="setIsInTrans(i, false)"
      @remove="handleRemoveCard(i)"
      @dragging="draggingCardEvent.start($event, i)"
    />
    <!-- Insert Region -->
    <div
      :style="insertStyle"
    >
      <div
        v-for="(val, i) in cardAttrs.positions"
        :key="`insert${i}`"
        :class="$style.insertWrapper"
        :style="{[media.pos]: val}"
      >
        <div @click="handleAddCard(i)">
          <TheIcon type="insert" />
        </div>
      </div>
    </div>
  </main>
</template>

<script lang="ts" setup>
import {
  ref, computed, useCssModule, reactive, watch,
} from 'vue';
import TheIcon from '../TheIcon.vue';
import TheCard from './TheCard.vue';
import { INIT_NUM_OF_CARDS, MAX_NUM_OF_CARDS } from '@/utils/constants';
import { equallyLength, evalPosition, round } from '@/utils/helpers';
import { randRgbGen, rgb2hex } from '@/utils/colors';
import { blenders } from '@/utils/blend';
// Stores / Contexts
import usePltStore from '@/features/stores/usePltStore';
import useSettingStore from '@/features/stores/useSettingStore';
import media from '@/features/useMedia';
// Types
import type { CSSProperties } from 'vue';

type cardInstance = InstanceType<typeof TheCard>;

const $style = useCssModule();

const dragIdx = ref<{
      /**
       * Index of card in `cards` state.
       */
      draggingIdx: number | null;
      /**
       * Final index(order) that cursor at.
       */
      finalIdx: number | null;
  }>({
    draggingIdx: null, finalIdx: null,
  });
const cardRefs = ref<cardInstance[]>([]);

const pltState = usePltStore();
const settingsState = useSettingStore();

const styleInSettings = computed<CSSProperties>(() => ({
  borderWidth: `${settingsState.border.width / 2}px`,
  borderColor: settingsState.border.show ? settingsState.border.color : '',
  transitionDuration: (
    `${settingsState.transition.pos}ms, ${
      settingsState.transition.pos}ms, ${
      settingsState.transition.color}ms`
  ),
}));

function calcCardAttrs() {
  const totalSpace = media.windowSize[media.isSmall ? 0 : 1] - media.bound[0];
  return {
    /**
     * Card width or height (depend on window width).
     */
    size: {
      px: totalSpace / pltState.numOfCards,
      percent: equallyLength(pltState.numOfCards)
    },
    /**
     * Card left or top (depend on window width).
     */
    positions: Array.from({ length: pltState.numOfCards + 1 },
      (_, i) => evalPosition(i, pltState.numOfCards),
    ),
  };
}
const cardAttrs = reactive(calcCardAttrs());
watch(() => pltState.numOfCards, () => {
  Object.assign(cardAttrs, calcCardAttrs());
});

// Set style to all cards.
/**
 * Set position of card from `start` to `end` with total cards
 * number `total`.
 * @param start The first index that be set position.
 * @param end The final index that be set position.
 * @param total Total number of cards.
 */
function resetPosition() {
  for (let i = 0; i < pltState.numOfCards; i++) {
    if (i === dragIdx.value.draggingIdx) continue;
    cardRefs.value[i].setPos(evalPosition(i, pltState.numOfCards));
  }
}
function removeTransition() {
  for (let i = 0; i < pltState.numOfCards; i++) {
    cardRefs.value[i].setTransProperty('none');
  }
}
function resetTransition(end?: number) {
  if (end === undefined) end = pltState.numOfCards;
  for (let i = 0; i < end; i++) {
    if (i === dragIdx.value.draggingIdx) continue;
    cardRefs.value[i].setTransProperty('reset');
  }
}

// Add card, remove card, and drag card have transition event.
// The state is for checking the transition is end.
const isInTrans = reactive<{arr: boolean[]}>({
  arr: Array.from({ length: INIT_NUM_OF_CARDS }, () => false),
});
function setIsInTrans(idx: number, newVal: boolean) {
  const newState = [...isInTrans.arr];
  newState[idx] = newVal;
  isInTrans.arr = newState;
}

/**
 * Infomation that be used in some events like mouseup(dragging end), add a
 * card, or remove card.
 */
const eventInfo = ref<{
  event: 'mouseup' | 'add' | 'remove';
  idx?: number;
  rgb?: number[];
} | null
>(null);

// Insert Regions
const handleAddCard = (idx: number) => {
  // Evaluate new color.
  let rgb;
  if (pltState.blendMode === 'random') rgb = randRgbGen();
  else {
    const { inverter } = pltState.spaceInfos;
    // Pick cards.
    let leftRgbColor;
    let rightRgbColor;
    // -Add to thequallyLengthsition. Blending the first card and black.
    if (!idx) leftRgbColor = [0, 0, 0];
    else leftRgbColor = inverter(pltState.cards[idx - 1].color);
    // -Add to the last position. Blending the last card and white.
    if (idx === pltState.numOfCards) rightRgbColor = [255, 255, 255];
    else rightRgbColor = inverter(pltState.cards[idx].color);
    rgb = blenders[pltState.blendMode](
      leftRgbColor, rightRgbColor, pltState.colorSpace,
    );
  }
  if (!settingsState.transition.pos) { // no transition.
    pltState.addCard(idx, rgb);
    removeTransition();
    setTimeout(() => resetTransition(), 50);
    return;
  }
  document.body.style.backgroundColor = rgb2hex(rgb);
  eventInfo.value = { event: 'add', idx, rgb };
  // Transition: shrink and move card. The enpty space is new card
  const length = equallyLength(pltState.numOfCards + 1);
  for (let i = 0; i < pltState.numOfCards; i++) {
    cardRefs.value[i].setSize(length);
    const bias = i >= idx ? 1 : 0;
    cardRefs.value[i].setPos(evalPosition(i + bias, pltState.numOfCards + 1));
  }
  // Trigger side effect when !isInTrans.some()
  Object.assign(isInTrans, { arr: Array.from({ length: pltState.numOfCards }, () => true) });
  pltState.setIsPending(true);
};

// Handle delete card.
/**
 * Transition before delete card object.
 * @param idx
 */
const handleRemoveCard = (idx: number) => {
  if (!settingsState.transition.pos) { // no transition.
    pltState.delCard(idx);
    removeTransition();
    setTimeout(() => resetTransition(pltState.numOfCards - 1), 50);
    return;
  }
  const newSize = equallyLength(pltState.numOfCards - 1);
  // Shrink target card and expand other card.
  for (let i = 0; i < pltState.numOfCards; i++) {
    cardRefs.value[i].setSize(i === idx ? '0%' : newSize);
    const bias = i > idx ? 1 : 0;
    cardRefs.value[i].setPos(evalPosition(i - bias, pltState.numOfCards - 1));
  }
  eventInfo.value = { event: 'remove', idx };
  Object.assign(isInTrans, { arr: Array.from({ length: pltState.numOfCards }, () => true) });
  pltState.setIsPending(true);
};

// Drag events start
const draggingCardEvent = computed(() => {
  const halfCardLength = cardAttrs.size.px / 2;
  // Rewrite `cursorPos / cardLength` to `cursorPos * cursorRationCoeff`.
  // Since division cost much time than multiplication.
  const cursorRationCoeff = 1 / cardAttrs.size.px;
  const cursorLimited = media.bound[1] - media.bound[0];
  let card: cardInstance | null;

  /**
   * The event is triggered when the `<->` icon on a card is dragging.
   * @param {number} cardIdx The n-th card.
   */
  function start(
    e: MouseEvent | TouchEvent, cardIdx: number,
  ) {
    // Prevent pointer-event.
    if (!e.type.startsWith('touch')) e.preventDefault();
    // Disable pull-to-refresh on mobile.
    document.body.style.overscrollBehavior = 'none';
    // Cursor position when mouse down.
    const cursorPos = (
      (e as MouseEvent)[media.clientPos] ||
        (e as TouchEvent).touches[0][media.clientPos]
    ) - media.bound[0];
    if (settingsState.transition.pos) {
      setIsInTrans(cardIdx, true);
    }
    pltState.setIsPending(true);
    dragIdx.value = {
      draggingIdx: cardIdx,
      finalIdx: cardIdx,
    };
    card = cardRefs.value[cardIdx];
    card.setPos(`${round(cursorPos - halfCardLength)}px`);
    card.setTransProperty('none');
    card.$el.classList.add($style.dragging);
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('mouseup', end);
    window.addEventListener('touchend', end);
  }
  /**
   * The event is triggered when the `<->` icon on a card is dragging and
   * cursor is moving.
   */
  function move(e: MouseEvent | TouchEvent) {
    if (!card) return;
    const cursorPos = (
      (e as MouseEvent)[media.clientPos] ||
        (e as TouchEvent).touches[0][media.clientPos]
    ) - media.bound[0];
      // Mouse is not in range.
    if (cursorPos < 0 || cursorPos > cursorLimited) return;
    card.setPos(`${round(cursorPos - halfCardLength)}px`);
    // Order of card that cursor at.
    const order = Math.floor(cursorPos * cursorRationCoeff);
    const idx = dragIdx.value.draggingIdx as number;
    const lastOrder = dragIdx.value.finalIdx as number;
    dragIdx.value.finalIdx = order;
    // Change `.order` attribute.
    pltState.moveCardOrder(idx, order);
    // Update state: which card start transition.
    if (settingsState.transition.pos && order !== lastOrder) {
      const moveToRightSide = lastOrder < order;
      setIsInTrans(
        (order < idx && !moveToRightSide) ||
        (idx < order && moveToRightSide) ?
          order :
          lastOrder,
        true,
      );
    }
  }
  /**
   * The event is triggered when release left buton.
   */
  function end() {
    if (!card) return;
    const card_ = card;
    card = null;
    // Able pull-to-refresh on mobile.
    document.body.style.overscrollBehavior = '';
    // `draggingIdx` and `finalIdx`setIsEventEnd are set to be non-null
    // together when mouse down.
    const idx = dragIdx.value.draggingIdx;
    const finalOrder = dragIdx.value.finalIdx as number;
    dragIdx.value.draggingIdx = null;
    dragIdx.value.finalIdx = null;
    if (idx === null) return;
    // Remove class.
    card_.$el.classList.remove($style.dragging);
    eventInfo.value = { event: 'mouseup' };
    if (!settingsState.transition.pos) {
      removeTransition();
      pltState.resetOrder();
      resetPosition();
      return;
    }
    // Dragging card move to target position.
    card_.setPos(cardAttrs.positions[finalOrder]);
    card_.setTransProperty('reset');

    window.removeEventListener('mousemove', move);
    window.removeEventListener('touchmove', move);
    window.removeEventListener('mouseup', end);
    window.removeEventListener('touchend', end);
  }
  return {
    start,
    move,
    end,
  };
});
watch(() => dragIdx.value.finalIdx, async (newQuestion) => {
  if (newQuestion === null) return;
  for (let i = 0; i < pltState.numOfCards; i++) {
    if (i === dragIdx.value.draggingIdx) continue;
    cardRefs.value[i].setPos(cardAttrs.positions[pltState.cards[i].order]);
  }
});
// Drag events end
// Side effect when transition is over.
watch(() => isInTrans.arr.some((val) => val),
  (someCardIsInTrans) => {
    if (someCardIsInTrans || !eventInfo.value) return;
    const info = eventInfo.value;
    // This LayoutEffect occurs only when transition is over.
    removeTransition();
    const start = info?.idx ? info.idx : 0;
    switch (info.event) {
    case 'add':
      document.body.style.backgroundColor = '';
      pltState.addCard(start, eventInfo.value.rgb as number[]);
      break;
    case 'remove':
      pltState.delCard(start);
      break;
    case 'mouseup':
      pltState.resetOrder();
      resetPosition();
      break;
    }
    eventInfo.value = null;
  },
);
watch(() => eventInfo.value, (newVal) => {
  if (!newVal) {
    setTimeout(() => {
      resetTransition();
      pltState.setIsPending(false);
    }, 50);
  }
});

/**
 * Style of insertion region.
 */
const insertStyle = computed(() => (
  pltState.numOfCards === MAX_NUM_OF_CARDS || pltState.isPending) ?
  { display: 'none' } :
  undefined,
);
</script>

<style src="./ThePalette.module.scss" module />

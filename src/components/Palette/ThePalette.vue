<template>
<div :class="$style.main">
  <TheCard v-for="(card, i) in pltState.cards" :key="`card${i}`"
    :ref="(el) => cardRefs[i] = (el as cardInstance)"
    :cardIdx="i"
    :card="card"
    :styleInSettings="styleInSettings"
    @transitionend="setIsInTrans(i, false)"
    @remove="handleRemoveCard(i)"
    @dragging="draggintCardEvent.start($event, i)"
  />
  <!-- Insert Region -->
  <div :style="insertStyle">
    <div v-for="(val, i) in positions"
      :key="`insert${i}`"
      tabindex="-1"
      :class="$style.insertWrapper"
      :style="{[pos]: val}"
    >
      <div @click="handleAddCard(i)" >
        <TheIcon type="insert" />
      </div>
    </div>
  </div>
</div>
</template>

<script lang="ts" setup>
import {
  ref, watchEffect, inject, toRefs, computed, useCssModule, reactive, watch,
} from 'vue';
import TheIcon from '../TheIcon.vue';
import TheCard from './TheCard.vue';
import {INIT_NUM_OF_CARDS, MAX_NUM_OF_CARDS} from '@/utils/constants';
import {evalLength, evalPosition, round} from '@/utils/helpers';
import {getSpaceTrans, randRgbGen, rgb2hex} from '@/utils/colors';
import {blenders} from '@/utils/blend';
// Stores / Contexts
import usePltStore from '@/features/stores/usePltStore';
import useSettingStore from '@/features/stores/useSettingStore';
// Types
import type {Ref, CSSProperties} from 'vue';
import type {MediaContextType} from '@/features/types/mediaType';

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
const media = inject('media') as Ref<MediaContextType>;
const {windowSize, isSmall, pos, clientPos, bound} = toRefs(media.value);

const styleInSettings = computed<CSSProperties>(() => ({
  borderWidth: `${settingsState.border.width}px`,
  borderColor: settingsState.border.show ? settingsState.border.color : '',
  transitionDuration: (
    `${settingsState.transition.pos}ms, ${
      settingsState.transition.pos}ms, ${
      settingsState.transition.color}ms`
  ),
}));

const cardLength = computed(() => {
  const pltLength = windowSize.value[isSmall.value ? 0 : 1] - bound.value[0];
  return pltLength / pltState.numOfCards;
});
const positions = computed<string[]>(() => (
  Array.from({length: pltState.numOfCards + 1},
      (_, i) => evalPosition(i, pltState.numOfCards),
  )
));

// Set style to all cards.
/**
 * Set position of card from `start` to `end` with total cards
 * number `total`.
 * @param start The first index that be set position.
 * @param end The final index that be set position.
 * @param total Total number of cards.
 */
function resetPosition(
    start: number = 0,
    end?: number,
    total?: number,
) {
  if (end === undefined) end = pltState.numOfCards;
  if (total === undefined) total = pltState.numOfCards;
  for (let i = start; i < end; i++) {
    if (i === dragIdx.value.draggingIdx) continue;
    cardRefs.value[i].setPos(evalPosition(i, total));
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
  arr: Array.from({length: INIT_NUM_OF_CARDS}, () => false),
});
function setIsInTrans(idx: number, newVal: boolean) {
  const newState = [...isInTrans.arr];
  newState[idx] = newVal;
  isInTrans.arr = newState;
}
// After transition end, some side effect will happen. This state is present
// for checking the entire event and side effect is complete.
const isEventEnd = ref(true);

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

// Drag events start
const draggintCardEvent = computed(() => {
  const halfCardLength = cardLength.value / 2;
  // Rewrite `cursorPos / cardLength` to `cursorPos * cursorRationCoeff`.
  // Since division cost much time than multiplication.
  const cursorRationCoeff = 1 / cardLength.value;
  const cursorLimited = bound.value[1] - bound.value[0];
  let card: cardInstance | null;
  return {
    /**
     * The event is triggered when the `<->` icon on a card is dragging.
     * @param {number} cardIdx The n-th card.
     */
    start(
        e: MouseEvent | TouchEvent, cardIdx: number,
    ) {
      // Prevent pointer-event.
      if (!e.type.startsWith('touch')) e.preventDefault();
      // Disable pull-to-refresh on mobile.
      document.body.style.overscrollBehavior = 'none';
      // Cursor position when mouse down.
      const cursorPos = (
        (e as MouseEvent)[clientPos.value] ||
        (e as TouchEvent).touches[0][clientPos.value]
      ) - bound.value[0];
      if (settingsState.transition.pos) {
        setIsInTrans(cardIdx, true);
      }
      pltState.setIsPending(true);
      isEventEnd.value = false;
      dragIdx.value = {
        draggingIdx: cardIdx,
        finalIdx: cardIdx,
      };
      card = cardRefs.value[cardIdx];
      card.setPos(`${round(cursorPos - halfCardLength)}px`);
      card.setTransProperty('none');
      card.$el.classList.add($style.dragging);
    },
    /**
     * The event is triggered when the `<->` icon on a card is dragging and
     * cursor is moving.
     */
    move(e: MouseEvent | TouchEvent) {
      if (!card) return;
      const cursorPos = (
        (e as MouseEvent)[clientPos.value] ||
        (e as TouchEvent).touches[0][clientPos.value]
      ) - bound.value[0];
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
    },
    /**
     * The event is triggered when release left buton.
     */
    end() {
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
      if (!settingsState.transition.pos) {
        removeTransition();
        pltState.resetOrder();
        resetPosition();
        isEventEnd.value = true; // Trigger `resetTransition`;
        return;
      }
      // Dragging card move to target position.
      card_.setPos(evalPosition(finalOrder, pltState.numOfCards));
      card_.setTransProperty('reset');
      eventInfo.value = {event: 'mouseup'};
    },
  };
});
watch(() => dragIdx.value.finalIdx, async (newQuestion) => {
  if (newQuestion === null) return;
  for (let i = 0; i < pltState.numOfCards; i++) {
    if (i === dragIdx.value.draggingIdx) continue;
    cardRefs.value[i].setPos(positions.value[pltState.cards[i].order]);
  }
});

watchEffect((cleanup) => {
  window.addEventListener('mousemove', draggintCardEvent.value.move);
  window.addEventListener('touchmove', draggintCardEvent.value.move);
  window.addEventListener('mouseup', draggintCardEvent.value.end);
  window.addEventListener('touchend', draggintCardEvent.value.end);
  cleanup(() => {
    window.removeEventListener('mousemove', draggintCardEvent.value.move);
    window.removeEventListener('touchmove', draggintCardEvent.value.move);
    window.removeEventListener('mouseup', draggintCardEvent.value.end);
    window.removeEventListener('touchend', draggintCardEvent.value.end);
  });
});
// Drag events end

// Insert Regions
const handleAddCard = (idx: number) => {
  // Evaluate new color.
  let rgb;
  if (pltState.blendMode === 'random') rgb = randRgbGen();
  else {
    const {inverter} = getSpaceTrans(pltState.colorSpace);
    // Pick cards.
    let leftRgbColor;
    let rightRgbColor;
    // -Add to the first position. Blending the first card and black.
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
  eventInfo.value = {event: 'add', idx, rgb};
  // Transition: shrink and move card. The enpty space is new card
  const length = evalLength(pltState.numOfCards + 1);
  for (let i = 0; i < pltState.numOfCards; i++) {
    cardRefs.value[i].setSize(length);
    const bias = i >= idx ? 1 : 0;
    cardRefs.value[i].setPos(evalPosition(i + bias, pltState.numOfCards + 1));
  }
  // Trigger side effect when !isInTrans.some()
  isInTrans.arr = Array.from({length: pltState.numOfCards}, () => true);
  pltState.setIsPending(true);
  isEventEnd.value = false;
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
    setTimeout(() => (
      resetTransition(pltState.numOfCards - 1),
      50
    ));
    return;
  }
  const newLength = evalLength(pltState.numOfCards - 1);
  // Shrink target card and expand other card.
  for (let i = 0; i < pltState.numOfCards; i++) {
    cardRefs.value[i].setSize(i === idx ? '0%' : newLength);
    const bias = i > idx ? 1 : 0;
    cardRefs.value[i].setPos(evalPosition(i - bias, pltState.numOfCards - 1));
  }
  eventInfo.value = {event: 'remove', idx};
  isInTrans.arr = Array.from({length: pltState.numOfCards}, () => true);
  pltState.setIsPending(true);
  isEventEnd.value = false;
};
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
      }
      eventInfo.value = null;
      isEventEnd.value = true;
    },
);
watch(() => isEventEnd.value, (newVal) => {
  if (newVal) {
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
    {display: 'none'} :
    undefined,
);
</script>

<style lang="scss" module>
.main {
  display: inline-block;
  position: relative;
  top: var(--header-height);
  height: calc(100vh - var(--header-height));
  width: 100vw;
}

.insertWrapper {
  position: absolute;
  height: 100%;
  width: 70px;
  transform: translateX(-50%);
  user-select: none;
  >div {
    @extend %center;
    display: none;
    // shape
    height: 25px;
    border-radius: $radius-lg;
    padding: 10px;
    background-color: #ffffffd0;
    cursor: pointer;
  }
  .icon {
    height: 100%;
  }
  &:hover >div {
    display: block;
  }

  @include small {
    height: 35px;
    width: 100%;
    transform: translateY(-50%);
    >div {
      display: block;
      height: 13px;
      padding: 7px;
      border-radius: $radius-lg;
      background-color: #fff;
      opacity: 0.6;
      .icon {
        transform: rotate(90deg);
      }
    }
    &:focus >div {
      opacity: 1;
    }
  }
  @include mobile {
    height: 30px;
    >div {
      padding: 7px;
      .icon {
        transform: rotate(90deg);
      }
    }
  }
}

.dragging {
  box-shadow: 0px 0px 10px black;
  pointer-events: none;
  overscroll-behavior: none;
  z-index: 1;
}
</style>

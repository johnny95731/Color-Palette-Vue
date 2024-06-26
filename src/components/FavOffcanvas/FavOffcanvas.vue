<template>
  <OverlayContainer
    role="dialog"
    :eager="true"
    v-model="isActive"
  >
    <Transition name="slide-x">
      <div
        v-show="model"
        :class="styles.favOffcanvas"
        @transitionstart="isTransition = true"
        @transitionend="isTransition = false"
      >
        <div
          :class="styles.menuBar"
          role="tablist"
        >
          <button
            v-for="(label, i) in pageLabels"
            :key="`page ${label}`"
            type="button"
            role="tab"
            :class="i === page ? styles.selected : undefined"
            @click="setPage(i)"
          >
            {{
              label
            }}
          </button>
          <div class="spacer" />
          <button
            type="button"
            aria-label="關閉"
            @click="isActive = false"
          >
            <TheIcon
              type="close"
            />
          </button>
        </div>
        <!-- Page content -->
        <ul
          v-show="page === 0"
          :class="styles.pageContent"
        >
          <ColorBlock
            v-for="(hex) in favState.colors"
            :key="`favColor ${hex}`"
            :hex="hex"
          />
        </ul>
        <ul
          v-show="page === 1"
          :class="styles.pageContent"
        >
          <PaletteBlock
            v-for="(plt) in favState.plts"
            :key="`favPlt ${plt}`"
            :plt="plt"
          />
        </ul>
        <div
          :class="styles.appendPlt"
          @click="favPltChanged"
        >
          <TheIcon :type="state.icon" />{{ state.text }}
        </div>
      </div>
    </Transition>
  </OverlayContainer>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import styles from './FavOffcanvas.module.scss';
import TheIcon from '../TheIcon.vue';
import OverlayContainer from '@/components/Custom/OverlayContainer.vue';
import ColorBlock from './ColorBlock.vue';
import PaletteBlock from './PaletteBlock.vue';
import usePltStore from '@/features/stores/usePltStore';
import useFavStore from '@/features/stores/useFavStore';

const model = defineModel<boolean>();
const isTransition = ref(false);
const isActive = computed({
  get() {
    return model.value || isTransition.value;
  },
  set(newVal) {
    isTransition.value = !newVal;
    model.value = newVal;
    if (!model.value && isTransition.value) isTransition.value = false;
  }
});

const pageLabels: string[] = ['Colors', 'Palettes'];
const page = ref<number>(0);
function setPage(i: number) {
  page.value = i;
}

const pltState = usePltStore();
const favState = useFavStore();
const pltStrings = computed(() => (
  pltState.cards.map((state) => state.hex.slice(1)).join('-')
));
const state = computed(() => {
  const isFavPlt = favState.plts.includes(pltStrings.value);
  if (isFavPlt) {
    return {
      icon: 'unfavorPallete',
      text: 'Remove Pallete',
    } as const;
  } else {
    return {
      icon: 'favorPallete',
      text: 'Append Pallete',
    } as const;
  }
});

function favPltChanged() {
  favState.favPltsChanged(pltStrings.value);
  setPage(1);
}
</script>

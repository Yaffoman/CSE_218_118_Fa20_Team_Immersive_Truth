<template>
  <div class="name-component">
    <Logo />
    <div class="room-title">ROOM CODE</div>
    <div class="room-id">{{ roomId }}</div>
    <div class="name-title">YOUR NAME?</div>
    <input ref="name" placeholder="ENTER NAME..." type="text" class="name" />
    <button class="enter" @click="enterGame">ENTER GAME</button>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue';
import { useRouter } from 'vue-router';

import Logo from '../components/Logo.vue';
import { useStore } from '../store';

export default defineComponent({
  components: {
    Logo,
  },
  setup() {
    const store = useStore();
    const router = useRouter();
    const name = ref<HTMLInputElement | null>(null);

    function enterGame() {
      // check name value
      if (name.value.value.length === 0) {
        return alert('Please enter a valid username.');
      }

      store.commit('setName', name.value?.value);
      // TODO: enter game
      router.push('/gameRoom');
    }

    return {
      roomId: computed(() => store.state.roomId),
      router,
      enterGame,
      name,
    };
  },
});
</script>

<style lang="scss" scoped>
@import '../scss/mixins.scss';
@import '../scss/variables.scss';

.name-component {
  @include full-screen();
  @include theme();
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.room-title {
  font-size: $title-font-size;
}

.room-id {
  color: $red;
  margin: 10px 0;
}

.name-title {
  font-size: $title-font-size;
}

.name {
  @include input();
}

.enter {
  @include button();
  position: absolute;
  bottom: 100px;
}
</style>

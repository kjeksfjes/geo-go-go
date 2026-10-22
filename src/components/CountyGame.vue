<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AdministrativeGameProps } from '../types/administrativeMap'
import AdministrativeGame from './AdministrativeGame.vue'
import { countyMap } from '../data/norwayCounties'

defineOptions({ inheritAttrs: false })
const props = defineProps<AdministrativeGameProps>()
const game = ref<InstanceType<typeof AdministrativeGame> | null>(null)
defineExpose({ confirmLeave: () => game.value?.confirmLeave() ?? true, tipContext: computed(() => game.value?.tipContext) })
</script>

<template><AdministrativeGame ref="game" :map-data="countyMap" v-bind="{ ...props, ...$attrs }" /></template>

<template>
  <span class="loading-spinner" aria-hidden="true" />
</template>

<style scoped>
.loading-spinner {
  display: inline-block;
  width: var(--loading-spinner-size, 0.8rem);
  height: var(--loading-spinner-size, 0.8rem);
  flex: none;
  border: 2px solid rgb(82 103 110 / 22%);
  border-top-color: var(--ui-ink);
  border-radius: 50%;
  animation: loading-spinner-spin 700ms linear infinite;
}

@keyframes loading-spinner-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner { animation: none; }
}
</style>

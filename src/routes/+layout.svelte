<!-- src/routes/+layout.svelte -->
<script>
  import '../app.css';
</script>

<div class="min-h-screen bg-[#111827] text-white">
  <main>
    <slot />
  </main>
</div>

<style>
  :global(html) {
    background-color: theme(colors.background);
  }
</style> 
<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/editor');
  });
</script>

<div class="container">
  <h1>Swappy</h1>
  <p>Audio/Video Editor</p>
  <p>Redirecting to editor...</p>
</div>

<style>
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: var(--background);
    color: var(--text);
  }

  h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  p {
    font-size: 1.2rem;
    margin: 0.5rem 0;
  }
</style>

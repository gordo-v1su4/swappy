<script>
  import '../app.css';
</script>

<div class="app">
  <header>
    <nav>
      <a href="/" class="logo">Swappy</a>
      <div class="nav-links">
        <a href="/editor">Editor</a>
      </div>
    </nav>
  </header>

  <main>
    <slot />
  </main>

  <footer>
    <p>© 2024 Swappy - Audio/Video Editor</p>
  </footer>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: var(--background);
    color: var(--text);
  }

  header {
    background-color: var(--surface-1);
    border-bottom: 1px solid var(--border);
    padding: 0.5rem 1rem;
  }

  nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1280px;
    margin: 0 auto;
    width: 100%;
  }

  .logo {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--text);
    text-decoration: none;
  }

  .nav-links a {
    color: var(--text);
    text-decoration: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    transition: background-color 0.2s;
  }

  .nav-links a:hover {
    background-color: var(--surface-2);
  }

  main {
    flex: 1;
    padding: 1rem;
    width: 100%;
    max-width: 1280px;
    margin: 0 auto;
    box-sizing: border-box;
  }

  footer {
    background-color: var(--surface-1);
    border-top: 1px solid var(--border);
    padding: 1rem;
    text-align: center;
    font-size: 0.875rem;
    color: var(--text-2);
  }
</style> 
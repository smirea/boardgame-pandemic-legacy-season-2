<!-- The × that closes a dialog, in the ink of whatever it stands on. -->
<script lang="ts">
  let { label, onclick }: { label: string; onclick: () => void } = $props();
</script>

<button type="button" {onclick} aria-label={label}>×</button>

<style>
  button {
    flex: none;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    margin-left: auto;
    padding: 0;
    border: 1px solid color-mix(in srgb, currentColor 38%, transparent);
    border-radius: 50%;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      background 140ms ease;
  }

  button:hover {
    border-color: color-mix(in srgb, currentColor 75%, transparent);
    background: color-mix(in srgb, currentColor 9%, transparent);
  }
</style>

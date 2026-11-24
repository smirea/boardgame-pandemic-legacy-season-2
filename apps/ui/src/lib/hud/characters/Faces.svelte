<script lang="ts">
  import Portrait from "../Portrait.svelte";

  type Props = {
    /** The faces nobody else wears. */
    faces: number[];
    chosen: number | null;
    pick: (portrait: number) => void;
  };
  let { faces, chosen, pick }: Props = $props();
</script>

<!-- Laid over the figure's foot: choosing one puts it on the figure. -->
<div class="faces" role="radiogroup" aria-label="Face">
  {#each faces as index (index)}
    <button
      type="button"
      role="radio"
      class="face"
      aria-checked={chosen === index}
      aria-label={`Face ${index + 1}`}
      onclick={() => pick(index)}
      data-testid={`face-${index}`}
    >
      <Portrait portrait={index} color="#3a3128" />
    </button>
  {/each}
</div>

<style>
  .faces {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.9cqh;
    max-width: 46cqw;
  }

  .face {
    position: relative;
    width: 7cqh;
    height: 7cqh;
    padding: 0;
    border: 2px solid rgb(240 230 206 / 0.35);
    border-radius: 50%;
    overflow: hidden;
    background: none;
    box-shadow: 0 0.4cqh 1.2cqh rgb(0 0 0 / 0.6);
    cursor: pointer;
    transition:
      transform 160ms ease,
      border-color 160ms ease;
  }

  .face:hover,
  .face:focus-visible {
    transform: translateY(-0.4cqh) scale(1.08);
    border-color: rgb(240 230 206 / 0.8);
    outline: none;
  }

  .face[aria-checked="true"] {
    border-color: #e2c36a;
    box-shadow:
      0 0 0 0.4cqh rgb(226 195 106 / 0.35),
      0 0.4cqh 1.2cqh rgb(0 0 0 / 0.6);
  }
</style>

<!--
	What an Epidemic card says, on the Player card and on the Legacy cards that add one: its three steps over the
	biohazard mark, with the torn "It's wearing off" sticker over step 2 once Door R is open. The card around it gives
	the background. `roomy` is the Legacy card's proportions. Spans only, since a Player card is a button.
-->
<script lang="ts">
  import RichText from "#lib/hud/RichText.svelte";
  import { fitText } from "./fit.ts";
  import { BIOHAZARD } from "./icons.ts";
  import { EPIDEMIC_STEPS, EPIDEMIC_WEARING_OFF_STEP } from "./playerPrint.ts";

  type Props = { wearingOff: boolean; roomy?: boolean };

  let { wearingOff, roomy = false }: Props = $props();

  const steps = $derived(
    wearingOff ? [EPIDEMIC_STEPS[0], EPIDEMIC_WEARING_OFF_STEP, EPIDEMIC_STEPS[2]] : EPIDEMIC_STEPS,
  );
  const plain = $derived(steps.map((step) => `${step.heading}: ${step.text}`).join(" "));
  const fit = $derived(roomy ? { max: 1.02, min: 0.58 } : { max: 0.76, min: 0.44 });
</script>

<span class="ep" class:roomy>
  <span class="ep-top">
    <span class="ep-title">EPIDEMIC</span>
    {#if roomy}<span class="ep-scale" aria-hidden="true"></span>{/if}
  </span>
  <span class="ep-body" {@attach fitText(plain, fit)}>
    <svg class="ep-art" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path d={BIOHAZARD} fill="currentColor" />
    </svg>
    {#each steps as step, idx (step.heading)}
      <span class="ep-step" class:wearing-off={wearingOff && idx === 1}>
        <strong>{step.heading}</strong>
        <span><RichText text={step.text} /></span>
      </span>
    {/each}
  </span>
</span>

<style>
  /* The parts lie straight in the card's own column. */
  .ep {
    display: contents;
    --top-pad: 0.34em 0.4em 0.3em;
    --top-rule: rgb(244 238 204 / 0.42);
    --title: 1.06em;
    --body-gap: 0.34em;
    --body-pad: 0.46em 0.52em 0.5em;
    --body-line: 1.22;
    --step-gap: 0.04em;
    --heading: 1em;
    --heading-space: 0.02em;
    --torn-margin: 0 -0.22em;
    --torn-pad: 0.24em 0.34em;
    --torn-shadow: 0 0.18em 0.45em rgb(0 0 0 / 0.52);
    --torn-tilt: -1.8deg;
  }

  .ep.roomy {
    --top-pad: 0.52em 0.6em 0.36em;
    --top-rule: rgb(244 238 204 / 0.45);
    --title: 1.82em;
    --body-gap: 0.72em;
    --body-pad: 0.8em 0.9em 1.35em;
    --body-line: 1.32;
    --step-gap: 0.12em;
    --heading: 1.05em;
    --heading-space: 0.03em;
    --torn-margin: 0 -0.25em;
    --torn-pad: 0.34em 0.45em;
    --torn-shadow: 0 0.22em 0.55em rgb(0 0 0 / 0.55);
    --torn-tilt: -1.6deg;
  }

  .ep-top {
    padding: var(--top-pad);
    border-bottom: 1.5px solid var(--top-rule);
    background: linear-gradient(180deg, #d86d24, #ecc63b);
    text-align: center;
    flex: none;
  }

  .roomy .ep-top {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .ep-title {
    font-family: var(--font-display);
    font-size: var(--title);
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #8f1d14;
    line-height: 1;
  }

  .ep-scale {
    width: 92%;
    height: 0.32em;
    margin-top: 0.14em;
    border-bottom: 1.5px solid #6b2212;
    background: repeating-linear-gradient(90deg, #6b2212 0 1px, transparent 1px 0.45em);
    opacity: 0.65;
  }

  .ep-body {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--body-gap);
    padding: var(--body-pad);
    overflow: hidden;
    line-height: var(--body-line);
  }

  .ep-art {
    position: absolute;
    right: -14%;
    bottom: -14%;
    z-index: 0;
    width: 72%;
    height: 72%;
    color: #0a1f0d;
    opacity: 0.32;
    pointer-events: none;
  }

  .ep-step {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: var(--step-gap);
  }

  .ep-step strong {
    color: #ffffff;
    font-size: var(--heading);
    font-style: italic;
    letter-spacing: var(--heading-space);
  }

  .ep-step > span {
    color: #f6ea8e;
  }

  .ep-step.wearing-off {
    margin: var(--torn-margin);
    padding: var(--torn-pad);
    border: 1px solid rgb(56 42 24 / 0.55);
    border-radius: 0.14em;
    background:
      repeating-linear-gradient(-12deg, rgb(120 92 48 / 0.05) 0 4px, transparent 4px 9px),
      linear-gradient(170deg, #ede1c0, #d8c69b);
    box-shadow:
      var(--torn-shadow),
      inset 0 0 0 1px rgb(255 250 234 / 0.35);
    transform: rotate(var(--torn-tilt));
  }

  .ep-step.wearing-off strong {
    color: #9e2119;
    font-style: normal;
  }

  .ep-step.wearing-off > span {
    color: #231a11;
  }
</style>

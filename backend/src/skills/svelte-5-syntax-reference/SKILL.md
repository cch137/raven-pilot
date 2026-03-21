---
name: svelte-5-syntax-reference
description: A compact reference for Svelte 5 and SvelteKit 2 covering Runes, template syntax, directives, lifecycle hooks, context API, stores, reactive classes, routing conventions, and a Svelte 4→5 migration cheatsheet. Intended to correct common LLM errors caused by knowledge cutoff on this rapidly evolving framework.
---

# Svelte 5 Syntax Reference

> Based on Svelte 5 / SvelteKit 2 (current stable, 2025). Svelte 5 introduces the **Runes** system, replacing the implicit reactivity model of Svelte 4.

---

## 1. File Types

| Extension                   | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `.svelte`                   | Component file — contains `<script>`, template, `<style>` |
| `.svelte.js` / `.svelte.ts` | Non-component module that uses Runes                      |

```js
// counter.svelte.ts — runes usable outside components
export const count = $state(0);
export const double = $derived(count * 2);
```

---

## 2. Runes

Runes are compiler-directive functions prefixed with `$`. **No import needed** — use them directly.

### `$state` — Reactive state

Objects and arrays are deeply proxied; mutations like `array.push()` trigger updates.

```svelte
<script>
  let count = $state(0);
  let todos = $state([{ done: false, text: 'buy milk' }]);
</script>
<button onclick={() => count++}>{count}</button>
```

#### `$state.raw` — Shallow state (only full reassignment triggers updates)

```js
let arr = $state.raw([]);
arr.push(1); // ❌ no update
arr = [...arr, 1]; // ✅ triggers update
```

#### `$state.snapshot` — Extract a plain copy from a state proxy

```js
let foo = $state({ bar: 0 });
const plain = $state.snapshot(foo); // plain object, not a Proxy
```

---

### `$derived` — Computed values

Auto-tracks dependencies; recomputes when they change. **Do not mutate state inside.**

```svelte
<script>
  let count = $state(0);
  let double = $derived(count * 2);
  // Use $derived.by for multi-line logic:
  let label = $derived.by(() => (count > 10 ? 'big' : 'small'));
</script>
```

---

### `$effect` — Side effects

Runs after the component mounts; reruns when tracked dependencies change. Return a function for cleanup.

```svelte
<script>
  let color = $state('red');
  $effect(() => {
    document.body.style.background = color;
    return () => { document.body.style.background = ''; };
  });
</script>
```

#### `$effect.pre` — Runs before the DOM is updated

```js
$effect.pre(() => {
  // executes before Svelte patches the DOM
});
```

#### `$effect.tracking` — Check if inside a tracking context

```js
$effect(() => {
  console.log($effect.tracking());
}); // true
console.log($effect.tracking()); // false
```

#### `$effect.root` — Manually scoped effect (advanced)

```js
const cleanup = $effect.root(() => {
  $effect(() => {
    console.log(count);
  });
});
cleanup(); // manually tear down
```

---

### `$props` — Receive component props (replaces `export let`)

```svelte
<script>
  let { name, age = 18, class: klass, ...rest } = $props();
</script>
```

With TypeScript:

```svelte
<script lang="ts">
  interface Props { name: string; age?: number; }
  let { name, age = 18 }: Props = $props();
</script>
```

---

### `$bindable` — Two-way bindable prop

```svelte
<!-- Child.svelte -->
<script>
  let { value = $bindable(0) } = $props();
</script>
<input bind:value={value} />

<!-- Parent.svelte -->
<Child bind:value={myVar} />
```

---

### `$inspect` — Dev-only debugging (stripped in production)

```js
let count = $state(0);
$inspect(count); // logs on every change
$inspect(count).with(console.trace); // custom handler
```

---

### `$host` — Access the host element inside a custom element

```svelte
<svelte:options customElement="my-btn" />
<script>
  function click() { $host().dispatchEvent(new CustomEvent('boom')); }
</script>
<button onclick={click}>Click</button>
```

---

## 3. Template Syntax

### `{#if}` / `{:else if}` / `{:else}`

```svelte
{#if user.admin}
  <Admin />
{:else if user.loggedIn}
  <Dashboard />
{:else}
  <Login />
{/if}
```

### `{#each}` — List rendering

```svelte
{#each items as item, i (item.id)}
  <li>{i}: {item.name}</li>
{:else}
  <li>No items</li>
{/each}
```

`(item.id)` is the key — tells Svelte how to track identity across updates.

### `{#key}` — Force re-creation when value changes

```svelte
{#key userId}
  <UserProfile />  <!-- fully remounted whenever userId changes -->
{/key}
```

### `{#await}` — Async data

```svelte
{#await promise}
  <Loading />
{:then data}
  <p>{data}</p>
{:catch err}
  <p>Error: {err.message}</p>
{/await}
```

### `{#snippet}` / `{@render}` — Reusable markup blocks (replaces slots)

```svelte
{#snippet card(title, body)}
  <div class="card"><h2>{title}</h2><p>{body}</p></div>
{/snippet}

{@render card('Hello', 'World')}

<!-- Pass a snippet as a prop -->
<Table {card} />
```

Receive default content via the `children` prop:

```svelte
<!-- Layout.svelte -->
<script>
  let { children } = $props();
</script>
<main>{@render children()}</main>

<!-- Usage -->
<Layout><p>Content here</p></Layout>
```

### `{@html}` — Raw HTML output (beware XSS)

```svelte
{@html markdownOutput}
```

### `{@attach}` — Element attachments (Svelte 5.29+, replaces some `use:` patterns)

```svelte
<canvas {@attach (el) => {
  const ctx = el.getContext('2d');
  $effect(() => { ctx.fillStyle = color; ctx.fillRect(0, 0, 32, 32); });
}}></canvas>
```

Return a function for cleanup; a falsy return means no attachment.

### `{@const}` — Local constant inside a template block

```svelte
{#each items as item}
  {@const price = item.qty * item.rate}
  <p>{price}</p>
{/each}
```

### `{@debug}` — Template debugging

```svelte
{@debug user, count}
```

---

## 4. Directives

### `bind:` — Two-way binding

```svelte
<input bind:value={name} />
<input type="checkbox" bind:checked={active} />
<div bind:clientWidth={w} bind:clientHeight={h}></div>
<Component bind:value={x} />

<!-- bind:this — get a reference to the DOM element -->
<canvas bind:this={canvasEl}></canvas>
```

### Event handling — Svelte 5 uses standard DOM event attributes (replaces `on:`)

```svelte
<!-- ✅ Svelte 5 -->
<button onclick={() => count++}>Click</button>
<input oninput={(e) => (name = e.target.value)} />

<!-- ❌ Legacy (deprecated) -->
<button on:click={handler}>Click</button>
```

### `use:` — Actions (run on element mount)

```svelte
<script>
  function tooltip(node, text) {
    // set up tooltip...
    return {
      update(newText) { /* text changed */ },
      destroy() { /* element removed */ }
    };
  }
</script>
<button use:tooltip={'Hello'}>Hover me</button>
```

### `transition:` / `in:` / `out:` — Enter/leave animations

```svelte
<script>
  import { fade, fly } from 'svelte/transition';
</script>
{#if visible}
  <div transition:fade={{ duration: 300 }}>...</div>
  <div in:fly={{ y: 20 }} out:fade>...</div>
{/if}
```

### `animate:` — List reorder animations (used with keyed `{#each}`)

```svelte
<script>
  import { flip } from 'svelte/animate';
</script>
{#each items as item (item.id)}
  <div animate:flip={{ duration: 200 }}>{item.name}</div>
{/each}
```

### `style:` — Inline style shorthand

```svelte
<div style:color={active ? 'red' : 'gray'} style:font-size="1rem">...</div>
```

### `class` — Dynamic class binding

```svelte
<!-- Boolean toggle -->
<div class:active={isActive} class:error>...</div>

<!-- Object syntax (Svelte 5) -->
<div class={{ active: isActive, disabled: !enabled }}>...</div>
```

---

## 5. Special Elements

```svelte
<svelte:head>
  <title>Page Title</title>
</svelte:head>

<svelte:window bind:scrollY={y} onresize={handleResize} />

<svelte:document onvisibilitychange={handler} />

<svelte:body class="modal-open" />

<!-- Dynamic tag name -->
<svelte:element this={tag} class="box">...</svelte:element>

<!-- Error boundary -->
<svelte:boundary>
  <MightThrow />
  {#snippet failed(error, reset)}
    <p>Error: {error.message}</p>
    <button onclick={reset}>Retry</button>
  {/snippet}
</svelte:boundary>

<!-- Component options -->
<svelte:options runes={true} customElement="my-el" />
```

---

## 6. Lifecycle Hooks

```svelte
<script>
  import { onMount, onDestroy, tick } from 'svelte';

  onMount(() => {
    console.log('mounted');
    return () => console.log('cleanup'); // optional teardown
  });

  onDestroy(() => {
    console.log('destroyed');
  });

  async function update() {
    someState = newValue;
    await tick(); // wait for DOM to reflect the change
    console.log('DOM updated');
  }
</script>
```

> ⚠️ `beforeUpdate` and `afterUpdate` are **removed** in Svelte 5. Use `$effect.pre()` and `tick()` instead.

---

## 7. Context API

Pass data through the component tree without prop drilling. Must be called during component initialization.

```svelte
<!-- Parent.svelte -->
<script>
  import { setContext } from 'svelte';
  let user = $state({ name: 'Alice' });
  setContext('user', user);                               // object — reactive by ref
  setContext('count', { get value() { return count; } }); // primitive — use getter
</script>

<!-- Child.svelte (any depth) -->
<script>
  import { getContext } from 'svelte';
  const user = getContext('user');
</script>
<p>{user.name}</p>
```

#### `createContext` — Type-safe alternative (Svelte 5.40+)

```ts
// context.svelte.ts
import { createContext } from "svelte";
export const [getUser, setUser] = createContext<User>();
```

Other utilities: `hasContext(key)` checks existence; `getAllContexts()` returns all.

---

## 8. Stores

Still supported but not required when Runes + context cover the use case.

```svelte
<script>
  import { writable, derived } from 'svelte/store';
  const count = writable(0);
  const doubled = derived(count, $c => $c * 2);
</script>

<!-- $ prefix auto-subscribes and unsubscribes -->
<p>{$count} — {$doubled}</p>
<button onclick={() => $count++}>+</button>
```

---

## 9. SvelteKit Project Structure

```
my-app/
├ src/
│  ├ lib/               # shared components/utilities (alias: $lib)
│  │  └ server/         # server-only code (alias: $lib/server)
│  ├ routes/            # file-based routing
│  ├ app.html           # HTML shell
│  ├ hooks.server.ts    # server-side hooks
│  └ hooks.client.ts    # client-side hooks
├ static/               # static assets
├ svelte.config.js
└ vite.config.ts
```

---

## 10. SvelteKit Routing Conventions

| File                | Purpose                           |
| ------------------- | --------------------------------- |
| `+page.svelte`      | Page component                    |
| `+page.ts`          | Shared/client `load` function     |
| `+page.server.ts`   | Server-only `load` + form actions |
| `+layout.svelte`    | Layout (`{@render children()}`)   |
| `+layout.server.ts` | Layout server load                |
| `+server.ts`        | API endpoint (GET / POST / etc.)  |
| `+error.svelte`     | Error page                        |

### Route naming

```
src/routes/
  +page.svelte               → /
  about/+page.svelte         → /about
  blog/[slug]/+page.svelte   → /blog/:slug
  [[lang]]/+page.svelte      → /:lang?  (optional param)
  [...rest]/+page.svelte     → /*       (catch-all)
  (group)/about/+page.svelte → /about   (grouping only, no URL effect)
```

### `load` function

```ts
// +page.ts
import type { PageLoad } from './$types';
export const load: PageLoad = async ({ params, fetch }) => {
  const data = await fetch(`/api/posts/${params.slug}`).then(r => r.json());
  return { data };
};

// +page.svelte
<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
</script>
```

### Server-only load

```ts
// +page.server.ts
import type { PageServerLoad } from "./$types";
export const load: PageServerLoad = async ({ locals, cookies }) => {
  return { user: locals.user };
};
```

### API endpoint

```ts
// src/routes/api/hello/+server.ts
import { json } from "@sveltejs/kit";
export const GET = async ({ url }) => {
  return json({ message: "hello" });
};
```

### Form actions

```ts
// +page.server.ts
import { fail, redirect } from "@sveltejs/kit";
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    if (!data.get("name")) return fail(400, { error: "Required" });
    redirect(303, "/success");
  },
};
```

```svelte
<!-- +page.svelte -->
<script>
  import { enhance } from '$app/forms';
  let { form } = $props(); // data returned by the action
</script>
<form method="POST" use:enhance>
  <input name="name" />
  {#if form?.error}<p>{form.error}</p>{/if}
</form>
```

### Common `$app/*` modules

```ts
import { page } from "$app/state"; // page.url, page.params, page.data
import { goto, invalidate, preloadData } from "$app/navigation";
import { PUBLIC_API_URL } from "$env/static/public";
import { API_SECRET } from "$env/static/private"; // server-only
```

> ⚠️ `$app/stores` from Svelte 4 is replaced by `$app/state` in SvelteKit 2.12+.

---

## 11. Reactive Classes

Runes work inside class fields in `.svelte.ts` files — ideal for encapsulating complex state.

```ts
// counter.svelte.ts
export class Counter {
  count = $state(0);
  double = $derived(this.count * 2);
  increment() {
    this.count++;
  }
}
```

```svelte
<script>
  import { Counter } from './counter.svelte.ts';
  const c = new Counter();
</script>
<button onclick={() => c.increment()}>{c.count} (×2: {c.double})</button>
```

---

## 12. Reactive Collections (`svelte/reactivity`)

Drop-in replacements for `Map`/`Set`/etc. with fine-grained reactivity.

```ts
import { SvelteMap, SvelteSet, SvelteDate, SvelteURL } from "svelte/reactivity";

let map = new SvelteMap<string, number>();
map.set("a", 1); // triggers reactive updates
```

---

## 13. Svelte 4 → 5 Migration Cheatsheet

| Svelte 4                                    | Svelte 5                                 |
| ------------------------------------------- | ---------------------------------------- |
| `export let x = 0`                          | `let { x = 0 } = $props()`               |
| `let x = 0` (implicit top-level reactivity) | `let x = $state(0)`                      |
| `$: double = x * 2`                         | `let double = $derived(x * 2)`           |
| `$: { sideEffect() }`                       | `$effect(() => { sideEffect() })`        |
| `on:click={fn}`                             | `onclick={fn}`                           |
| `<slot>` / `<slot name="x">`                | `{@render children()}` / `{@render x()}` |
| `$$restProps`                               | `let { a, ...rest } = $props()`          |
| `<svelte:component this={C}>`               | `<C />` (use variable directly)          |
| `beforeUpdate` / `afterUpdate`              | `$effect.pre()` / `tick()`               |

---

## 14. Key Gotchas

- **Runes mode is all-or-nothing**: once any rune is used in a file, legacy syntax cannot be mixed in.
- **`$derived` is declaration-only**: it can only appear as a variable initializer or class field; use `$derived.by(() => ...)` for complex logic.
- **Passing primitives loses reactivity**: when passing a `$state` primitive to a function or context, wrap it in an object or use a getter `() => state` to keep it reactive.
- **`$effect` does not run on the server**: effects are skipped during SSR — never rely on them for initial data setup.
- **`.svelte.ts` naming required**: only rename a `.ts` file to `.svelte.ts` when it actually uses runes.
- **Module-level `$state` is shared across SSR requests**: avoid module-level reactive state on the server; use context or `locals` instead.

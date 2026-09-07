/**
 * Browser APIs jsdom does not implement, stubbed for the component project.
 *
 * Three things reach for them here: Radix primitives position themselves with
 * observers a real browser provides, the theme provider asks the browser what
 * colour scheme the user prefers, and it then remembers the answer in
 * `localStorage`. None of that is what a component test asserts on — these
 * stubs only stop the components throwing before they render. The preference
 * answers "light", so a test that cares about the system theme is stating it
 * rather than inheriting it.
 */

/**
 * Scrolling, which jsdom has no layout to do.
 *
 * The method is absent rather than inert, so a component that scrolls a
 * section into view throws before it can be asserted on. A no-op restores the
 * call, and a test that cares which element was scrolled spies on it.
 */
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

class NoopResizeObserver implements ResizeObserver {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
}

globalThis.ResizeObserver ??= NoopResizeObserver;

function stubMediaQueryList(query: string): MediaQueryList {
	const list: MediaQueryList = {
		matches: false,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	};
	return list;
}

window.matchMedia ??= stubMediaQueryList;

/**
 * Web Storage, in memory.
 *
 * `globalThis.localStorage` exists under this runtime but is a bare object
 * carrying none of the Storage methods, so the first `getItem` throws rather
 * than returning null — a component that persists a preference cannot even
 * render, and a test cannot clear between cases. In-memory is what a test
 * wants regardless: it starts empty, and `clear()` actually clears something.
 */
function createMemoryStorage(): Storage {
	const entries = new Map<string, string>();
	return {
		get length() {
			return entries.size;
		},
		clear: () => entries.clear(),
		getItem: (key: string) => entries.get(key) ?? null,
		key: (index: number) => [...entries.keys()][index] ?? null,
		removeItem: (key: string) => {
			entries.delete(key);
		},
		setItem: (key: string, value: string) => {
			entries.set(key, String(value));
		},
	};
}

// Guarded on the method rather than on the object: the object is present, it
// is only the API that is missing, so `??=` would leave the broken one in place.
if (typeof globalThis.localStorage?.getItem !== "function") {
	Object.defineProperty(globalThis, "localStorage", {
		value: createMemoryStorage(),
		configurable: true,
		writable: true,
	});
}

/**
 * The clipboard, in memory.
 *
 * jsdom ships none, and a copy-link button is exactly the kind of thing whose
 * only observable effect is what was written. Storing it — rather than
 * counting calls on a spy — lets a test assert the value the reader would
 * paste, which is the behaviour, while a test about a browser that refuses the
 * clipboard still stubs `writeText` itself.
 */
if (!navigator.clipboard) {
	let written = "";
	Object.defineProperty(navigator, "clipboard", {
		value: {
			writeText: async (text: string) => {
				written = text;
			},
			readText: async () => written,
		},
		configurable: true,
		writable: true,
	});
}

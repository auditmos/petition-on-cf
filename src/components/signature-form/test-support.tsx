import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { SignatureForm } from "@/components/signature-form/signature-form";
import { getContent, type Language } from "@/content";
import { getLegalText } from "@/content/legal";

/**
 * What the two form test files share: the boundaries they stand in for, and
 * the one way they put the form on screen.
 *
 * `fetch` and Cloudflare's widget script are both genuinely outside this code
 * — a network call and a remote script that draws its own UI — so they are the
 * only things stubbed. Everything else in a form test is the real component.
 */
type Reply = { status: number; body: unknown };

export function stubFetch(...replies: Reply[]) {
	const queue = [...replies];
	const stub = vi.fn(async () => {
		const reply = queue.shift() ?? { status: 201, body: { data: { status: "created" } } };
		return new Response(JSON.stringify(reply.body), {
			status: reply.status,
			headers: { "content-type": "application/json" },
		});
	});
	vi.stubGlobal("fetch", stub);
	return stub;
}

export function sentBody(stub: ReturnType<typeof stubFetch>): unknown {
	const [, init] = stub.mock.calls[0] as unknown as [string, RequestInit];
	return JSON.parse(String(init.body));
}

/**
 * Stands in for Cloudflare's widget script, which is a system boundary: it is
 * remote, it draws its own UI, and nothing about it is this form's code.
 *
 * `render` is where the real script hands back a token, so the stub calls the
 * callback the same way — synchronously for a key that passes, not at all for
 * a widget still thinking or already broken.
 */
export function stubTurnstile(token: string | null = "a-token-the-widget-produced") {
	const api = {
		render: vi.fn(
			(_element: HTMLElement, options: { callback: (token: string) => void; language: string }) => {
				if (token !== null) options.callback(token);
				return "widget-id";
			},
		),
		remove: vi.fn(),
	};
	vi.stubGlobal("turnstile", api);
	return api;
}

/** The options Cloudflare's script was asked to render the widget with. */
export function renderedWith(api: ReturnType<typeof stubTurnstile>): { language: string } {
	const [, options] = api.render.mock.calls[0] as unknown as [HTMLElement, { language: string }];
	return options;
}

/**
 * A fresh client per test, with retries off so a failure is observed once
 * rather than after a backoff the test would have to wait out.
 *
 * `collectSignerRole` is the one deployment setting a test ever varies; left
 * out, the form uses whatever this deployment configured.
 */
export function renderSignatureForm(
	language: Language,
	{ collectSignerRole }: { collectSignerRole?: boolean } = {},
): void {
	const content = getContent(language);
	const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
	render(
		<QueryClientProvider client={queryClient}>
			<SignatureForm
				copy={content.sign}
				legal={content.legal}
				language={language}
				{...(collectSignerRole === undefined ? {} : { collectSignerRole })}
			/>
		</QueryClientProvider>,
	);
}

/**
 * The consent wording is not copy — it is a legal text, and it is the same
 * Polish text in both languages by decision. So the assertion is against the
 * fixture rather than against a sentence written here: what the form must show
 * is exactly what was approved, with this deployment's identity filled in.
 *
 * Markdown links collapse to their label, which is what a reader sees and what
 * an accessible name is computed from.
 */
export function approved(name: Parameters<typeof getLegalText>[0]): string {
	return getLegalText(name)
		.trim()
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

/**
 * Matches a control whose accessible name is this legal text.
 *
 * Accessible-name computation joins an element's children with spaces, so a
 * sentence ending in a link comes back with a space before its full stop. That
 * is the algorithm rather than the form, so the test normalises it away instead
 * of the form pandering to it.
 */
export function named(text: string): (accessibleName: string) => boolean {
	return (accessibleName) => accessibleName.replace(/\s+([.,])/g, "$1") === text;
}

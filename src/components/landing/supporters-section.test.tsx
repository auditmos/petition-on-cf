import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SupportersSection } from "@/components/landing/supporters-section";
import { getContent } from "@/content";
import type { SupporterPage } from "@/core/supporters";

/**
 * The public list, as a reader sees it.
 *
 * ## Assumptions this file encodes
 *
 * - **Input**: the first page, server-rendered into the route's loader data,
 *   and this language's copy. Every later page is fetched by this component.
 * - **Output**: one line per supporter — the name the server published, and
 *   the town beside it when there is one — plus a button for the next page,
 *   and only while there is one.
 * - **Boundaries**: an empty list, a single page, a next page that fails to
 *   arrive.
 * - **`fetch` is stubbed**, because it is the boundary: what the endpoint puts
 *   in the response is `signatures-supporters.worker.test.ts`'s subject, and
 *   what this component does with it is this file's.
 * - **Nothing here re-checks consent or the name format.** Both are decided in
 *   SQL, and a component that re-derived either could disagree with the query.
 */

const COPY = getContent("pl");

const PERSON = { id: "id-anna", name: "Anna K.", city: "Warszawa" };
const ORGANIZATION = { id: "id-fundacja", name: "Fundacja Przykład", city: null };

function firstPage(page: Partial<SupporterPage> = {}): SupporterPage {
	return { supporters: [PERSON], nextCursor: null, ...page };
}

describe("SupportersSection", () => {
	it("writes a person as their published name and their town", () => {
		render(<SupportersSection page={firstPage()} copy={COPY.supporters} />);

		expect(screen.getByRole("listitem").textContent).toBe("Anna K., Warszawa");
	});

	// An entity signs under its name alone. A town beside it would be the town
	// of whoever filled the form in, which is not what the entity published.
	it("writes a non-personal signer as its name, with nothing beside it", () => {
		render(
			<SupportersSection page={firstPage({ supporters: [ORGANIZATION] })} copy={COPY.supporters} />,
		);

		expect(screen.getByRole("listitem").textContent).toBe("Fundacja Przykład");
	});

	it("says nobody has consented yet rather than showing an empty list", () => {
		render(<SupportersSection page={firstPage({ supporters: [] })} copy={COPY.supporters} />);

		expect(screen.getByText(COPY.supporters.empty).textContent).toBe(COPY.supporters.empty);
		expect(screen.queryByRole("list")).toBeNull();
	});
});

/**
 * The rest of the list, which the reader asks for rather than receives.
 *
 * Deliberately a button and not a scroll listener: the list is one section of
 * a long page, and a reader on their way to the FAQ should not be made to load
 * two hundred names on the way past.
 */
describe("SupportersSection, the next page", () => {
	const NEXT = { id: "id-piotr", name: "Piotr N.", city: "Kraków" };

	function answerWith(page: SupporterPage): ReturnType<typeof vi.fn> {
		const stub = vi.fn(async () => Response.json({ data: page }));
		vi.stubGlobal("fetch", stub);
		return stub;
	}

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function loadMore(): HTMLElement {
		return screen.getByRole("button", { name: COPY.supporters.loadMore });
	}

	it("offers nothing to load when the first page is the whole list", () => {
		render(<SupportersSection page={firstPage()} copy={COPY.supporters} />);

		expect(screen.queryByRole("button")).toBeNull();
	});

	it("asks for the page the cursor names and adds it to the list", async () => {
		const fetched = answerWith({ supporters: [NEXT], nextCursor: null });
		render(
			<SupportersSection
				page={firstPage({ nextCursor: "500.the-cursor" })}
				copy={COPY.supporters}
			/>,
		);

		fireEvent.click(loadMore());

		await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
		expect(fetched.mock.calls[0]?.[0]).toContain("cursor=500.the-cursor");
		expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
			"Anna K., Warszawa",
			"Piotr N., Kraków",
		]);
	});

	it("stops offering more once a page comes back without a cursor", async () => {
		answerWith({ supporters: [NEXT], nextCursor: null });
		render(
			<SupportersSection
				page={firstPage({ nextCursor: "500.the-cursor" })}
				copy={COPY.supporters}
			/>,
		);

		fireEvent.click(loadMore());

		await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
	});

	// The same page fetched twice is the same names listed twice, which is the
	// duplicate the cursor was chosen to rule out — reintroduced by an impatient
	// reader rather than by the query.
	it("ignores a second click while a page is still on its way", async () => {
		const fetched = answerWith({ supporters: [NEXT], nextCursor: null });
		render(
			<SupportersSection
				page={firstPage({ nextCursor: "500.the-cursor" })}
				copy={COPY.supporters}
			/>,
		);

		fireEvent.click(loadMore());
		fireEvent.click(loadMore());

		await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
		expect(fetched).toHaveBeenCalledTimes(1);
	});

	// A page that did not arrive is not a page that is empty. The names already
	// on screen stay, the reader is told, and the button stays so they can try.
	it("keeps what is on screen and says so when a page does not arrive", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("offline");
			}),
		);
		render(
			<SupportersSection
				page={firstPage({ nextCursor: "500.the-cursor" })}
				copy={COPY.supporters}
			/>,
		);

		fireEvent.click(loadMore());

		await waitFor(() =>
			expect(screen.getByText(COPY.supporters.loadMoreFailed).textContent).toBe(
				COPY.supporters.loadMoreFailed,
			),
		);
		expect(screen.getAllByRole("listitem")).toHaveLength(1);
		expect(loadMore()).not.toBeNull();
	});
});

/**
 * Cloudflare's answer to "did a person submit this?".
 *
 * The widget on the form hands the browser a token; this spends that token
 * against Turnstile's siteverify endpoint, which is the only party that can
 * say whether it is genuine. A token is single-use, so this runs once per
 * submission and its verdict is not cached.
 *
 * What the caller sees is a boolean. The endpoint URL, the form encoding, the
 * shape of Cloudflare's JSON and the fact that a secret is involved at all
 * stay in here — an endpoint that had to know those would be an endpoint that
 * breaks when Turnstile changes any of them.
 *
 * ## Why a failed request is not a `false`
 *
 * A rejected token and an unreachable siteverify are different facts, and the
 * signer should be told different things about them. A rejection is answered
 * with "we could not confirm a person is signing"; a network failure throws,
 * reaches the global error handler as a 500, and the form says "try again in a
 * moment" — which is what actually happened. Collapsing both into `false`
 * would tell somebody their browser looked like a robot because Cloudflare had
 * a bad minute.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileChallenge {
	/** From the Worker's secrets — never from a content or config file. */
	secret: string;
	/** What the widget produced in the signer's browser. */
	token: string;
	/**
	 * The signer's IP, when the platform reported one. Optional because
	 * siteverify treats it as corroborating evidence rather than as a
	 * requirement, and a request that reached the Worker without
	 * `CF-Connecting-IP` is still a request worth verifying.
	 */
	ip?: string | undefined;
}

/** Whether Turnstile vouches for this token. */
export async function verifyTurnstile({ secret, token, ip }: TurnstileChallenge): Promise<boolean> {
	const form = new URLSearchParams({ secret, response: token });
	if (ip) form.set("remoteip", ip);

	const response = await fetch(SITEVERIFY_URL, { method: "POST", body: form });
	const verdict = (await response.json()) as { success?: unknown };

	// Explicitly `=== true`: an error payload carries no `success` at all, and
	// a truthy check would read a missing field as a pass on some future shape.
	return verdict.success === true;
}

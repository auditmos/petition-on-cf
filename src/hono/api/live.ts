import { createHono } from "@/hono/factory";
import { liveCounter } from "@/live";

const liveEndpoint = createHono();

/**
 * The socket the page watches the count on.
 *
 * The handler does one thing — pick the deployment's counter and hand the
 * request to it — because a WebSocket upgrade is not a response this endpoint
 * can construct. The 101 and its socket come back from the Durable Object, and
 * everything after the handshake happens between the browser and the object
 * with no Worker in the middle.
 *
 * The request goes through unmodified, so the object sees the `Upgrade` header
 * and can refuse anything that is not one.
 */
liveEndpoint.get("/", (c) => liveCounter(c.env).fetch(c.req.raw));

export default liveEndpoint;

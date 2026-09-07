-- Demo signatures for the local database, so the page has something to draw.
--
-- Run it with `pnpm db:seed:dev`. Safe to run twice: every row carries a
-- deterministic id and e-mail, so `INSERT OR IGNORE` turns a second run into a
-- no-op rather than a unique-constraint error.
--
-- To get back to an empty petition — which is a state worth looking at, since
-- it is the one every fresh deployment opens in:
--
--   pnpm exec wrangler d1 execute DB --local --command "DELETE FROM signatures"
--
-- The shape of the data is chosen to exercise the map rather than to look
-- plentiful:
--
--   * Counts are lopsided, because real ones are. Mazowieckie at 48 against
--     Podlaskie at 1 is what makes the four shading steps visible at all; a
--     flat spread would render sixteen identical regions.
--   * Opolskie is deliberately absent. A voivodeship nobody has signed from is
--     drawn differently from one with a single signature, and that is the
--     distinction most easily broken without noticing.
--   * Seven rows carry no voivodeship at all. They count toward the total and
--     appear under the map as the unattributed bucket, which is what proves
--     the sixteen regions and the headline number still add up.
--   * Two in three consent to the public list, so the supporters list has both
--     something to show and something to leave out.
--   * Six of the rows are organisations rather than people, because the public
--     list writes those as a name with no town beside it and nothing else in
--     the seed exercises that.
--
-- Nothing here is a real person. The addresses are all under `.example.test`,
-- a reserved domain that cannot resolve or receive mail.

WITH RECURSIVE
	-- How many signatures each voivodeship gets, and the city they say they
	-- are from. Edit this table to reshape the demo; everything below is
	-- arithmetic over it.
	region(code, wanted, city) AS (
		VALUES
			('PL-MZ', 48, 'Warszawa'),
			('PL-SL', 31, 'Katowice'),
			('PL-MA', 24, 'Kraków'),
			('PL-WP', 19, 'Poznań'),
			('PL-DS', 16, 'Wrocław'),
			('PL-LD', 11, 'Łódź'),
			('PL-PM', 9, 'Gdańsk'),
			('PL-KP', 6, 'Bydgoszcz'),
			('PL-LU', 5, 'Lublin'),
			('PL-PK', 4, 'Rzeszów'),
			('PL-ZP', 3, 'Szczecin'),
			('PL-WN', 2, 'Olsztyn'),
			('PL-SK', 2, 'Kielce'),
			('PL-PD', 1, 'Białystok'),
			('PL-LB', 1, 'Zielona Góra'),
			-- Attributed to nowhere: the bucket the map reports separately.
			(NULL, 7, 'Sopot')
	),

	-- One row per signature within a region. The bound is the largest count
	-- above; each region joins only as far as it needs.
	seq(i) AS (
		SELECT 1
		UNION ALL
		SELECT i + 1 FROM seq WHERE i < 48
	),

	-- A small pool of names, cycled through. Twelve is enough that a page of
	-- supporters does not read as one family.
	person(slot, first_name, surname) AS (
		VALUES
			(0, 'Anna', 'Kowalska'),
			(1, 'Piotr', 'Nowak'),
			(2, 'Katarzyna', 'Wiśniewska'),
			(3, 'Marek', 'Wójcik'),
			(4, 'Agnieszka', 'Kowalczyk'),
			(5, 'Tomasz', 'Kamiński'),
			(6, 'Magdalena', 'Lewandowska'),
			(7, 'Paweł', 'Zieliński'),
			(8, 'Joanna', 'Szymańska'),
			(9, 'Michał', 'Woźniak'),
			(10, 'Ewa', 'Dąbrowska'),
			(11, 'Krzysztof', 'Mazur')
	)

INSERT OR IGNORE INTO signatures (
	id,
	first_name,
	surname,
	email,
	city,
	signer_type,
	voivodeship_code,
	consent_rodo,
	consent_public_list,
	consent_updates,
	created_at
)
SELECT
	'seed-' || coalesce(region.code, 'none') || '-' || seq.i,
	person.first_name,
	person.surname,
	lower('seed-' || coalesce(region.code, 'none') || '-' || seq.i || '@example.test'),
	region.city,
	'person',
	region.code,
	-- Mandatory at the boundary, so every stored row has it.
	1,
	CASE WHEN seq.i % 3 = 0 THEN 0 ELSE 1 END,
	CASE WHEN seq.i % 4 = 0 THEN 1 ELSE 0 END,
	-- Spread over the past fortnight rather than all landing this second, so
	-- anything that ever orders by date has something to order. Seven hours
	-- per step covers exactly two weeks across the largest region; the region
	-- name shifts each one by an hour or two so they interleave.
	unixepoch() - ((seq.i * 25200 + length(coalesce(region.code, '')) * 3600) % 1209600)
FROM region
JOIN seq ON seq.i <= region.wanted
JOIN person ON person.slot = seq.i % 12;

-- A handful of non-personal signers.
--
-- The public list renders these differently — the entity's name, and no town
-- beside it — so a seed made only of people would leave that format
-- unexercised, and it is the one most easily broken without noticing. Two of
-- the six decline publication, for the same reason a third of the people above
-- do. Three carry a role and three do not, because the role is a field a
-- deployment chooses to collect.
--
-- Nothing here is a real organisation either. The names are generic and the
-- addresses are under `.example.test`, the same reserved domain.
INSERT OR IGNORE INTO signatures (
	id,
	first_name,
	surname,
	email,
	city,
	signer_type,
	company_name,
	signer_role,
	voivodeship_code,
	consent_rodo,
	consent_public_list,
	consent_updates,
	created_at
)
VALUES
	('seed-org-1', 'Anna', 'Kowalska', 'seed-org-1@example.test', 'Warszawa', 'company',
	 'Fundacja Przykładowa', 'prezeska', 'PL-MZ', 1, 1, 1, unixepoch() - 43200),
	('seed-org-2', 'Marek', 'Wójcik', 'seed-org-2@example.test', 'Kraków', 'company',
	 'Stowarzyszenie Sąsiedzkie', 'sekretarz', 'PL-MA', 1, 1, 0, unixepoch() - 129600),
	('seed-org-3', 'Joanna', 'Szymańska', 'seed-org-3@example.test', 'Gdańsk', 'company',
	 'Spółdzielnia Socjalna Przykład', NULL, 'PL-PM', 1, 1, 0, unixepoch() - 216000),
	('seed-org-4', 'Paweł', 'Zieliński', 'seed-org-4@example.test', 'Poznań', 'company',
	 'Klub Sportowy Przykład', 'prezes', 'PL-WP', 1, 0, 0, unixepoch() - 302400),
	('seed-org-5', 'Ewa', 'Dąbrowska', 'seed-org-5@example.test', 'Wrocław', 'company',
	 'Przykładowa Spółka z o.o.', NULL, 'PL-DS', 1, 0, 1, unixepoch() - 388800),
	('seed-org-6', 'Katarzyna', 'Wiśniewska', 'seed-org-6@example.test', 'Kielce', 'company',
	 'Koło Gospodyń Przykładowych', 'przewodnicząca', NULL, 1, 1, 0, unixepoch() - 475200);
